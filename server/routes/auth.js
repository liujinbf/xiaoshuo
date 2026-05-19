import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import {
  getUserByUsername,
  updateUserPassword,
  getUserSyncData,
  saveUserSyncData,
  getDb
} from "../utils/db.js";

import { clientIp, throttle, clearThrottle } from "../utils/security.js";

const JWT_SECRET = process.env.JWT_SECRET || "yanxuan-secret-key-123";

const SCRYPT_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 128;

function normalizeUsername(value) {
  return String(value || "").trim();
}

function normalizePassword(value) {
  return String(value || "");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}:${salt}:${hash}`;
}

function legacyHashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;

  if (storedPassword.startsWith(`${SCRYPT_PREFIX}:`)) {
    const [, salt, storedHash] = storedPassword.split(":");
    if (!salt || !storedHash) return false;
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);
    const stored = Buffer.from(storedHash, "hex");
    return stored.length === hash.length && crypto.timingSafeEqual(stored, hash);
  }

  return storedPassword === legacyHashPassword(password);
}

function shouldUpgradePassword(storedPassword) {
  return !storedPassword?.startsWith(`${SCRYPT_PREFIX}:`);
}

function sanitizeSyncData(syncData = {}) {
  const next = { ...syncData };
  if (next.modelConfig && typeof next.modelConfig === "object") {
    const { presetId, baseUrl, model } = next.modelConfig;
    next.modelConfig = { presetId, baseUrl, model };
  }
  return next;
}

export async function handleAuthRoutes(request, response, url, helpers) {
  const { sendJson, readJson } = helpers;

  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    try {
      const payload = await readJson(request);
      const username = normalizeUsername(payload.username);
      const password = normalizePassword(payload.password);
      const registerKey = `reg:${clientIp(request)}`;
      const registerLimit = throttle(registerKey, { limit: 5, windowMs: 60 * 60 * 1000 });
      if (registerLimit.blocked) {
        sendJson(response, 429, { ok: false, message: `注册尝试过于频繁，请 ${registerLimit.retryAfter} 秒后再试` });
        return true;
      }
      
      if (!username || !password || username.length < 3 || username.length > 32 || password.length < 6 || password.length > MAX_PASSWORD_LENGTH) {
        sendJson(response, 400, { ok: false, message: "用户名需为3-32位，密码需为6-128位" });
        return true;
      }
      
      const existing = await getUserByUsername(username);
      if (existing) {
        sendJson(response, 400, { ok: false, message: "该用户名已被注册" });
        return true;
      }

      const id = `U${crypto.randomUUID()}`;
      const db = await getDb();
      const countRow = await db.get("SELECT COUNT(*) as count FROM users");
      const role = countRow.count === 0 ? "admin" : "user";

      await db.run(
        "INSERT INTO users (id, username, password, created_at, role) VALUES (?, ?, ?, ?, ?)",
        [id, username, hashPassword(password), new Date().toISOString(), role]
      );
      clearThrottle(registerKey);
      
      const token = jwt.sign({ userId: id, username, role }, JWT_SECRET, { expiresIn: "7d" });
      sendJson(response, 200, { ok: true, token, userId: id, username, role });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: "注册失败: " + e.message });
    }
    return true;
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    try {
      const payload = await readJson(request);
      const username = normalizeUsername(payload.username);
      const password = normalizePassword(payload.password);
      const loginKey = `login:${clientIp(request)}:${username.toLowerCase()}`;
      const loginLimit = throttle(loginKey, { limit: 10, windowMs: 10 * 60 * 1000 });
      if (loginLimit.blocked) {
        sendJson(response, 429, { ok: false, message: `登录尝试过于频繁，请 ${loginLimit.retryAfter} 秒后再试` });
        return true;
      }
      if (!username || !password || password.length > MAX_PASSWORD_LENGTH) {
        sendJson(response, 401, { ok: false, message: "用户名或密码错误" });
        return true;
      }
      
      const user = await getUserByUsername(username);
      if (!user || !verifyPassword(password, user.password)) {
        sendJson(response, 401, { ok: false, message: "用户名或密码错误" });
        return true;
      }

      if (shouldUpgradePassword(user.password)) {
        await updateUserPassword(user.id, hashPassword(password));
      }

      clearThrottle(loginKey);
      const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      sendJson(response, 200, { ok: true, token, userId: user.id, username: user.username, role: user.role });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: "登录失败: " + e.message });
    }
    return true;
  }

  if (url.pathname === "/api/auth/sync") {
    // 鉴权
    const authHeader = request.headers?.authorization;
    let auth = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        auth = jwt.verify(token, JWT_SECRET);
      } catch (e) {}
    }

    if (!auth || !auth.userId) {
      sendJson(response, 401, { ok: false, message: "请先登录" });
      return true;
    }

    if (request.method === "POST") {
      try {
        const { syncData } = await readJson(request);
        await saveUserSyncData(auth.userId, sanitizeSyncData(syncData));
        sendJson(response, 200, { ok: true, message: "同步成功" });
      } catch (e) {
        sendJson(response, 500, { ok: false, message: "同步失败: " + e.message });
      }
      return true;
    }

    if (request.method === "GET") {
      try {
        const syncData = await getUserSyncData(auth.userId);
        sendJson(response, 200, { ok: true, syncData });
      } catch (e) {
        sendJson(response, 500, { ok: false, message: "读取同步数据失败: " + e.message });
      }
      return true;
    }
  }

  return false;
}
