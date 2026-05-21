import "./server/utils/env.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import jwt from "jsonwebtoken";
import { handleAccountRoutes } from "./server/routes/account.js";
import { handleNovelRoutes } from "./server/routes/novels.js";
import { handleAuthRoutes } from "./server/routes/auth.js";
import { handlePayRoutes } from "./server/routes/pay.js";
import { handleAdminRoutes } from "./server/routes/admin.js";
import { handleInspirationsRoutes } from "./server/routes/inspirations.js";
import { handleKnowledgeRoutes } from "./server/routes/knowledge.js";
import { handleTrendsRoutes } from "./server/routes/trends.js";
import { callOpenAI } from "./server/utils/prompts.js";
import { retrieveKnowledgeForDraft, retrieveHotTrendsForDraft } from "./server/utils/knowledge-retrieval.js";
import { retrieveSubjectKnowledge } from "./server/utils/knowledge-retrieval-service.js";
import { clientIp, throttle } from "./server/utils/security.js";

const rootDir = resolve(".");

const port = Number(process.env.PORT || 4173);
const model = process.env.OPENAI_MODEL || "gpt-5.2";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

const allowedStaticFiles = new Set(["/", "/index.html", "/admin.html", "/app.js"]);
const allowedStaticPrefixes = ["/css/", "/js/", "/images/", "/assets/fonts/", "/templates/"];

function isStaticPathAllowed(pathname) {
  if (allowedStaticFiles.has(pathname)) return true;
  return allowedStaticPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    ...extra
  };
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders()
  });
  response.end(JSON.stringify(data));
}

function todayKey() {
  return new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function defaultAccount(userId) {
  return {
    userId,
    tier: "free",
    day: todayKey(),
    usage: { ideas: 0, saves: 0, ai: 0 },
    trialEndsAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeAccount(account, userId) {
  const next = {
    ...defaultAccount(userId),
    ...(account || {}),
    usage: { ideas: 0, saves: 0, ai: 0, ...((account && account.usage) || {}) }
  };
  if (next.day !== todayKey()) {
    next.day = todayKey();
    next.usage = { ideas: 0, saves: 0, ai: 0 };
  }
  if (next.tier === "trial" && next.trialEndsAt && new Date(next.trialEndsAt) < new Date()) {
    next.tier = "free";
    next.trialEndsAt = "";
  }
  if (next.tier === "pro" && next.proEndsAt && new Date(next.proEndsAt) < new Date()) {
    next.tier = "free";
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

const JWT_SECRET = process.env.JWT_SECRET || "yanxuan-secret-key-123";
if (!process.env.JWT_SECRET) {
  console.warn("警告：当前使用默认 JWT_SECRET，仅适合本地开发。公网部署前必须在 .env 中配置强随机密钥。");
}

function getUserId(request, payload = {}, url = new URL("http://localhost")) {
  const auth = getUserAuth(request);
  if (auth && auth.userId) return auth.userId;
  const bodyUserId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
  if (bodyUserId) return bodyUserId;
  const queryUserId = url.searchParams.get("userId") || "";
  if (queryUserId.trim()) return queryUserId.trim();
  return "";
}

function getUserAuth(request) {
  const authHeader = request.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      return jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  const maxBodySize = 2 * 1024 * 1024;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodySize) {
      const error = new Error("请求体过大");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};
  return JSON.parse(raw);
}

const getEmbeddingsUrl = (baseUrl) => {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/embeddings` : `${clean}/v1/embeddings`;
};

// === 向量记忆（Vector Memory）工具 ===
async function fetchEmbedding(text, baseUrl, apiKey) {
  try {
    const res = await fetch(getEmbeddingsUrl(baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-3-small", // 默认兼容 OpenAI 的嵌入模型
        input: text
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e) {
    return null; // 容错处理
  }
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===== 核心 API 路由 =====
async function handleApi(request, response, url) {
  if (url.pathname === "/api/health" && request.method === "GET") {
    const rawKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
    const isPlaceholder = !rawKey || rawKey === "sk-your-api-key" || rawKey.includes("your-api-key");
    const envModel = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
    const envBaseUrl = process.env.AI_BASE_URL || "https://api.openai.com";
    sendJson(response, 200, {
      ok: true,
      hasApiKey: !isPlaceholder,
      model: envModel,
      baseUrl: envBaseUrl
    });
    return;
  }

  if (url.pathname === "/api/models" && request.method === "POST") {
    try {
      const payload = await readJson(request);
      const { baseUrl, apiKey } = payload;

      const finalBaseUrl = (baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const finalApiKey = apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";

      const isPlaceholder = !finalApiKey || finalApiKey === "sk-your-api-key" || finalApiKey.includes("your-api-key");
      if (isPlaceholder) {
        // ⚠️ 不返回任何假模型名，让客户端知道需要配置 key
        sendJson(response, 200, {
          ok: false,
          message: "未配置 API Key，请先填写并保存您的 API Key，再点击刷新列表",
          source: "no-key"
        });
        return;
      }

      let fetchUrl = finalBaseUrl;
      if (!fetchUrl.endsWith("/v1") && !fetchUrl.endsWith("/v1/")) {
        fetchUrl = `${fetchUrl}/v1`;
      }
      fetchUrl = `${fetchUrl}/models`;

      let res = await fetch(fetchUrl, {
        headers: {
          Authorization: `Bearer ${finalApiKey}`
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        const altUrl = `${finalBaseUrl}/models`;
        res = await fetch(altUrl, {
          headers: {
            Authorization: `Bearer ${finalApiKey}`
          },
          signal: AbortSignal.timeout(10000)
        });
      }

      if (!res.ok) {
        throw new Error(`获取模型列表失败，状态码: ${res.status}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        const models = data.data.map((item) => item.id).filter(Boolean);
        if (models.length === 0) throw new Error("该供应商 API 返回了空的模型列表");
        sendJson(response, 200, { ok: true, models, source: "api" });
      } else {
        throw new Error("返回的数据格式不符合 OpenAI 规范（缺少 data 数组）");
      }
    } catch (error) {
      // ⚠️ 重要：失败时绝不返回任何假模型名，只返回错误原因
      // 客户端应保留已知的有效模型，而不是被假名污染
      sendJson(response, 200, {
        ok: false,
        message: error.message || "联网获取模型失败",
        source: "error"
      });
    }
    return;
  }

  if (url.pathname === "/api/test-connection" && request.method === "POST") {
    try {
      const payload = await readJson(request);
      const { baseUrl, apiKey, model } = payload;

      const finalBaseUrl = (baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const finalApiKey = apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const finalModel = model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

      const isPlaceholder = !finalApiKey || finalApiKey === "sk-your-api-key" || finalApiKey.includes("your-api-key");
      if (isPlaceholder) {
        sendJson(response, 200, {
          ok: true,
          message: "（本地沙箱模拟成功）已成功验证本地内置的本地模型规则，离线模式可用！"
        });
        return;
      }

      let fetchUrl = finalBaseUrl;
      if (!fetchUrl.endsWith("/v1") && !fetchUrl.endsWith("/v1/")) {
        fetchUrl = `${fetchUrl}/v1`;
      }
      fetchUrl = `${fetchUrl}/chat/completions`;

      const res = await fetch(fetchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${finalApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: finalModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `HTTP 错误码: ${res.status}`;
        throw new Error(errMsg);
      }

      sendJson(response, 200, {
        ok: true,
        message: "连接成功！当前选中的大模型服务正常响应，您可以开始放心进行创作。"
      });
    } catch (error) {
      sendJson(response, 200, {
        ok: false,
        message: error.message || "请求超时或网络未连接"
      });
    }
    return;
  }

  if (await handleAuthRoutes(request, response, url, { sendJson, readJson })) {
    return;
  }

  if (await handleAdminRoutes(request, response, url, { sendJson, readJson, getUserAuth })) {
    return;
  }

  if (await handlePayRoutes(request, response, url, { sendJson, readJson, getUserId })) {
    return;
  }

  if (await handleAccountRoutes(request, response, url, { sendJson, readJson, getUserId, normalizeAccount })) {
    return;
  }

  if (url.pathname === "/api/generate" && request.method === "POST") {
    const ip = clientIp(request);
    const limit = throttle(`gen:${ip}`, { limit: 30, windowMs: 60 * 1000 });
    if (limit.blocked) {
      sendJson(response, 429, { ok: false, message: `请求过于频繁，请 ${limit.retryAfter} 秒后再试` });
      return;
    }

    try {
      const payload = await readJson(request);

      const userId = getUserId(request, payload, url);
      if (userId) {
        payload.matchedInspirations = await retrieveKnowledgeForDraft({
          userId,
          input: payload.input,
          limit: 5
        });
      }

      // 🆕 召回同品类的最新全网爆款趋势，供大纲方案起名及故事板设计参考
      if (payload.input?.genre) {
        payload.matchedTrends = await retrieveHotTrendsForDraft({
          genre: payload.input.genre,
          limit: 3
        });
      }

      // 🆕 召回学科百科常识，并执行缺席常识自动检测与联网/AI智能扩增
      const searchSubjectText = `${payload.input?.title || ""} ${payload.input?.theme || ""} ${payload.input?.notes || ""}`;
      payload.matchedSubjectKnowledge = await retrieveSubjectKnowledge({
        text: searchSubjectText,
        limit: 3,
        modelConfig: payload.modelConfig
      });

      const text = await callOpenAI(payload);

      // 🔍 实时诊断：如果生成的是大纲方案，将 AI 返回的原始文本写入本地排查日志，并在控制台两端打印以供定位
      if (payload.mode === "plan") {
        console.log(`[AI Plan Response Debug] Received text. Length: ${text ? text.length : 0}`);
        if (text) {
          console.log(`[AI Plan Response Start]: ${text.slice(0, 300)}`);
          console.log(`[AI Plan Response End]: ${text.slice(-300)}`);
          try {
            const fs = await import("node:fs/promises");
            await fs.writeFile("scripts/last_ai_response.txt", text, "utf-8");
            console.log(`[AI Plan Response Debug] Successfully logged full AI text to scripts/last_ai_response.txt`);
          } catch (logErr) {
            console.error("[AI Plan Response Debug] Failed to write scripts/last_ai_response.txt:", logErr);
          }
        }
      }

      sendJson(response, 200, {
        ok: true,
        text,
        model,
        knowledgeUsed: (payload.matchedInspirations || []).map((item) => ({
          id: item.id,
          theme: item.theme,
          score: Math.round(item._score || 0)
        }))
      });
    } catch (error) {
      console.error("[API Generate Error] Detailed stack trace:", error);
      sendJson(response, error.statusCode || 500, {
        ok: false,
        message: error.message || "生成失败"
      });
    }
    return;
  }

  if (url.pathname === "/api/generate/script" && request.method === "POST") {
    const ip = clientIp(request);
    const limit = throttle(`script:${ip}`, { limit: 10, windowMs: 60 * 1000 });
    if (limit.blocked) {
      sendJson(response, 429, { ok: false, message: `脚本转换过于频繁，请 ${limit.retryAfter} 秒后再试` });
      return;
    }

    try {
      const payload = await readJson(request);
      const { callOpenAIForScript } = await import("./server/utils/prompts.js");
      const script = await callOpenAIForScript(payload);
      sendJson(response, 200, { ok: true, script });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || "脚本转换失败" });
    }
    return;
  }

  // ===== 连载小说 API =====

  if (await handleNovelRoutes(request, response, url, { sendJson, readJson, getUserId, fetchEmbedding, cosineSimilarity })) {
    return;
  }

  if (await handleInspirationsRoutes(request, response, url, { sendJson, readJson, getUserId })) {
    return;
  }

  if (await handleKnowledgeRoutes(request, response, url, { sendJson, readJson, getUserId })) {
    return;
  }

  if (await handleTrendsRoutes(request, response, url, { sendJson, readJson, getUserId })) {
    return;
  }

  sendJson(response, 404, { ok: false, message: "接口不存在" });
}

async function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  if (!isStaticPathAllowed(url.pathname)) {
    response.writeHead(404, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    response.end("Not found");
    return;
  }

  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(rootDir, safePath));

  if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
    response.writeHead(404, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    response.end("Not found");
    return;
  }

  const body = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
    ...securityHeaders()
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    await serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error.message || "服务器错误"
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`盐选故事工作台已启动：http://127.0.0.1:${port}`);
  console.log(`AI 模型：${model}；API Key：${process.env.OPENAI_API_KEY ? "已配置" : "未配置，本地模板可用"}`);
});
