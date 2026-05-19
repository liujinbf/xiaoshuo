import {
  getUserAccount, saveUserAccount,
  getUserProjects, saveUserProjects,
  getOrders, saveOrder, getSetting
} from "../utils/db.js";
import crypto from "node:crypto";

function normalizeAmount(value, fallback) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999) return fallback;
  return Math.round(amount * 100) / 100;
}

// helper methods that will be passed into the route handlers to avoid circular dependencies
export async function handleAccountRoutes(request, response, url, helpers) {
  const { sendJson, readJson, getUserId, normalizeAccount } = helpers;

  if (url.pathname === "/api/account" && request.method === "GET") {
    const userId = getUserId(request, {}, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    let account = await getUserAccount(userId);
    if (!account) account = normalizeAccount(null, userId);
    else account = normalizeAccount(account, userId);
    await saveUserAccount(userId, account);
    
    const projects = await getUserProjects(userId);
    const orders = await getOrders(userId);
    
    sendJson(response, 200, { ok: true, account, projects, orders });
    return true;
  }

  if (url.pathname === "/api/account/sync" && request.method === "POST") {
    const payload = await readJson(request);
    const userId = getUserId(request, payload, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    
    // 获取云端现有账户状态，防止被客户端意外降级
    const existing = await getUserAccount(userId);
    let account = normalizeAccount(payload.billing, userId);
    
    if (existing && existing.tier === "pro") {
      // 云端是 Pro，客户端是 Free/Trial -> 维持云端 Pro 状态
      if (account.tier !== "pro") {
        account.tier = "pro";
        account.proEndsAt = existing.proEndsAt;
      } else {
        // 两边都是 Pro，取最晚过期时间
        const clientEnd = account.proEndsAt ? new Date(account.proEndsAt) : new Date(0);
        const serverEnd = existing.proEndsAt ? new Date(existing.proEndsAt) : new Date(0);
        if (serverEnd > clientEnd) {
          account.proEndsAt = existing.proEndsAt;
        }
      }
    }

    await saveUserAccount(userId, { ...account, userId, syncedAt: new Date().toISOString() });
    
    const projects = Array.isArray(payload.projects) ? payload.projects.slice(0, 50) : [];
    await saveUserProjects(userId, projects);
    
    const orders = await getOrders(userId);
    sendJson(response, 200, { ok: true, account, projects, orders });
    return true;
  }

  if (url.pathname === "/api/account/trial" && request.method === "POST") {
    const payload = await readJson(request);
    const userId = getUserId(request, payload, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    let account = await getUserAccount(userId);
    account = normalizeAccount(account, userId);
    account.tier = "trial";
    account.trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await saveUserAccount(userId, account);
    sendJson(response, 200, { ok: true, account });
    return true;
  }

  if (url.pathname === "/api/orders" && request.method === "POST") {
    const payload = await readJson(request);
    const userId = getUserId(request, payload, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    const plan = payload.plan === "yearly" ? "yearly" : "monthly";
    const payConfig = await getSetting("pay_config") || {};
    const order = {
      id: `YX${crypto.randomUUID()}`,
      userId,
      plan,
      amount: plan === "yearly"
        ? normalizeAmount(payConfig.yearly_amount ?? process.env.PRO_YEARLY_AMOUNT, 199)
        : normalizeAmount(payConfig.monthly_amount ?? process.env.PRO_MONTHLY_AMOUNT, 29),
      status: "draft",
      createdAt: new Date().toISOString()
    };
    await saveOrder(order);
    sendJson(response, 200, { ok: true, order });
    return true;
  }

  if (url.pathname === "/api/projects" && request.method === "POST") {
    const payload = await readJson(request);
    const userId = getUserId(request, payload, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    const projects = await getUserProjects(userId);
    const incoming = payload.project;
    if (!incoming || !incoming.id) { sendJson(response, 400, { ok: false, message: "缺少 project" }); return true; }
    const newProjects = [incoming, ...projects.filter((project) => project.id !== incoming.id)].slice(0, 50);
    await saveUserProjects(userId, newProjects);
    sendJson(response, 200, { ok: true, projects: newProjects });
    return true;
  }

  return false;
}
