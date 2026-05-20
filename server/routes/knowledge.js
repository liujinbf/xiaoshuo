import { retrieveSubjectKnowledge, formatKnowledgeForPrompt, invalidateKnowledgeCache } from "../utils/knowledge-retrieval-service.js";
import { getAllKnowledge, saveKnowledge } from "../utils/db.js";

export async function handleKnowledgeRoutes(request, response, url, { sendJson, readJson, getUserId }) {
  if (!url.pathname.startsWith("/api/knowledge")) return false;

  const userId = getUserId(request, {}, url);
  if (!userId) {
    sendJson(response, 401, { ok: false, message: "未授权访问，请提供 Token" });
    return true;
  }

  // POST /api/knowledge/retrieve - 匹配输入的主题返回常识卡
  if (url.pathname === "/api/knowledge/retrieve" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const { text, limit } = body;
      
      const matched = await retrieveSubjectKnowledge({ text, limit: limit || 3 });
      const promptConstraint = formatKnowledgeForPrompt(matched);

      sendJson(response, 200, {
        ok: true,
        matched,
        promptConstraint
      });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // GET /api/knowledge/list - 获取所有学科知识库列表
  if (url.pathname === "/api/knowledge/list" && request.method === "GET") {
    try {
      const list = await getAllKnowledge();
      sendJson(response, 200, { ok: true, list });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // POST /api/knowledge/add - 手动录入或抓取增量录入学科知识
  if (url.pathname === "/api/knowledge/add" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const { category, entity, content, alias } = body;
      
      if (!category || !entity || !content) {
        sendJson(response, 400, { ok: false, message: "参数不完整，请提供 category, entity, content" });
        return true;
      }

      await saveKnowledge(category.trim(), entity.trim(), content.trim(), alias || "");
      invalidateKnowledgeCache(); // 强制失效缓存
      sendJson(response, 200, { ok: true, message: "常识实体录入成功" });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // POST /api/knowledge/auto-expand - 联网/AI 自动提取并扩充常识知识
  if (url.pathname === "/api/knowledge/auto-expand" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const { entity, modelConfig } = body;
      
      if (!entity || !entity.trim()) {
        sendJson(response, 400, { ok: false, message: "参数不完整，请提供待扩充的实体 entity" });
        return true;
      }

      const { expandKnowledge } = await import("../utils/knowledge-expansion-service.js");
      const generated = await expandKnowledge({ entity, modelConfig });

      await saveKnowledge(generated.category, generated.entity, generated.content, generated.alias || "");
      invalidateKnowledgeCache(); // 强制失效缓存
      sendJson(response, 200, {
        ok: true,
        message: "常识知识库联网/AI 扩充成功",
        item: generated
      });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  return false;
}
