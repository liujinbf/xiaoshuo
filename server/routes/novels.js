import {
  getUserNovels, saveNovel, deleteNovel
} from "../utils/db.js";
import crypto from "node:crypto";
import {
  buildChapterSystemPrompt,
  buildChapterUserPrompt,
  buildChapterMemoryPrompt,
  buildChapterPolishSystemPrompt,
  buildChapterPolishUserPrompt
} from "../utils/prompts.js";

function parseChapterMemory(rawText) {
  const raw = String(rawText || "").trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const data = JSON.parse(raw);
    return {
      summary: String(data.summary || "").trim().slice(0, 220),
      openThreads: Array.isArray(data.openThreads) ? data.openThreads.map(String).slice(0, 3) : [],
      newFacts: Array.isArray(data.newFacts) ? data.newFacts.map(String).slice(0, 3) : [],
      characterUpdates: Array.isArray(data.characterUpdates) ? data.characterUpdates.map(String).slice(0, 4) : [],
      continuityChecks: Array.isArray(data.continuityChecks) ? data.continuityChecks.map(String).slice(0, 3) : [],
      nextHook: String(data.nextHook || "").trim().slice(0, 120)
    };
  } catch {
    return {
      summary: raw.slice(0, 220),
      openThreads: [],
      newFacts: [],
      characterUpdates: [],
      continuityChecks: [],
      nextHook: ""
    };
  }
}

function formatMemoryForRecall(chapter) {
  const memory = chapter.memory || {};
  const parts = [memory.summary || chapter.summary].filter(Boolean);
  if (Array.isArray(memory.openThreads) && memory.openThreads.length) {
    parts.push(`伏笔：${memory.openThreads.join("；")}`);
  }
  if (Array.isArray(memory.characterUpdates) && memory.characterUpdates.length) {
    parts.push(`人物：${memory.characterUpdates.join("；")}`);
  }
  if (memory.nextHook) parts.push(`钩子：${memory.nextHook}`);
  return parts.join("；");
}

async function polishChapterContent({ baseUrl, apiKey, modelName, chapterContent }) {
  try {
    const polishRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: buildChapterPolishSystemPrompt() },
          { role: "user", content: buildChapterPolishUserPrompt(chapterContent) }
        ],
        max_tokens: 4200,
        temperature: 0.55
      })
    });
    const polishData = await polishRes.json();
    if (!polishRes.ok) return chapterContent;
    const polished = (polishData?.choices?.[0]?.message?.content || "").trim();
    return polished || chapterContent;
  } catch {
    return chapterContent;
  }
}

export async function handleNovelRoutes(request, response, url, helpers) {
  const { sendJson, readJson, getUserId, fetchEmbedding, cosineSimilarity } = helpers;

  // GET /api/novels - 获取用户的小说列表
  if (url.pathname === "/api/novels" && request.method === "GET") {
    const userId = getUserId(request, {}, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    const novels = await getUserNovels(userId);
    sendJson(response, 200, { ok: true, novels });
    return true;
  }

  // POST /api/novels - 创建小说
  if (url.pathname === "/api/novels" && request.method === "POST") {
    const payload = await readJson(request);
    const userId = getUserId(request, payload, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    
    const novel = {
      id: `NV${crypto.randomUUID()}`,
      userId,
      title: String(payload.title || "未命名小说").trim(),
      genre: String(payload.genre || "悬疑反转").trim(),
      outline: String(payload.outline || "").trim(),
      characters: String(payload.characters || "").trim(),
      targetChapters: Math.min(100, Math.max(1, Number(payload.targetChapters) || 10)),
      chapterLength: [1500, 2000, 3000].includes(Number(payload.chapterLength))
        ? Number(payload.chapterLength) : 2000,
      chapters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveNovel(userId, novel);
    sendJson(response, 200, { ok: true, novel });
    return true;
  }

  // DELETE /api/novels/:id
  const novelIdMatch = url.pathname.match(/^\/api\/novels\/([^/]+)$/);
  if (novelIdMatch && request.method === "DELETE") {
    const payload = await readJson(request);
    const userId = getUserId(request, payload, url);
    const novelId = novelIdMatch[1];
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    
    await deleteNovel(userId, novelId);
    sendJson(response, 200, { ok: true });
    return true;
  }

  // POST /api/novels/:id/chapters/generate - 生成下一章
  const genChapterMatch = url.pathname.match(/^\/api\/novels\/([^/]+)\/chapters\/generate$/);
  if (genChapterMatch && request.method === "POST") {
    const novelId = genChapterMatch[1];
    try {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
      
      const userNovels = await getUserNovels(userId);
      const novel = userNovels.find((n) => n.id === novelId);
      if (!novel) { sendJson(response, 404, { ok: false, message: "小说不存在" }); return true; }

      // 解析模型配置
      const cfg = payload.modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
      if (!apiKey) { sendJson(response, 412, { ok: false, message: "缺少 API Key，请在模型配置面板填写" }); return true; }

      // --- 1. 向量记忆召回 ---
      let relevantMemory = "";
      if (novel.chapters.length >= 2) {
        const lastChapter = novel.chapters[novel.chapters.length - 1];
        if (lastChapter.summaryEmbedding) {
          const scoredChapters = novel.chapters
            .slice(0, -1) // 排除自己
            .map(ch => ({
              chapter: ch,
              score: cosineSimilarity(lastChapter.summaryEmbedding, ch.summaryEmbedding)
            }))
            .filter(item => item.score > 0.6) // 相似度阈值
            .sort((a, b) => b.score - a.score)
            .slice(0, 2); // 取 Top 2
            
          if (scoredChapters.length > 0) {
            relevantMemory = scoredChapters.map(sc => `第${sc.chapter.index}章：${formatMemoryForRecall(sc.chapter)}`).join("\n");
          }
        }
      }

      // --- 1.5 召回已学爆款模版 (RAG) ---
      let matchedInspirations = [];
      try {
        const { getInspirations } = await import("../utils/db.js");
        const inspirations = await getInspirations(userId);
        const genreEnMap = {
          "悬疑反转": "suspense",
          "婚恋复仇": "revenge",
          "大女主爽文": "heroine",
          "世情家庭": "family",
          "中式志怪": "folklore",
          "历史错位爽文": "history",
          "规则怪谈脑洞": "rules",
          "职场内幕": "workplace"
        };
        const enGenre = genreEnMap[novel.genre];
        if (enGenre) {
          let matched = inspirations.filter(ins => ins.genre === enGenre);
          if (matched.length > 0) {
            // 用小说的标题和大纲分词作为 Query，智能筛选爆款模版
            const queryWords = [];
            if (novel.title) queryWords.push(...novel.title.split(/[，。！？、\s]+/));
            if (novel.outline) queryWords.push(...novel.outline.split(/[，。！？、；\s]+/));
            const validQueries = queryWords.filter(w => w.length >= 2);

            matched.forEach(ins => {
              let score = 0;
              const contentToSearch = (ins.theme + " " + ins.hook + " " + (ins.outline||"")).toLowerCase();
              validQueries.forEach(q => {
                if (contentToSearch.includes(q.toLowerCase())) score += 10;
              });
              ins._score = score + Math.random() * 5; 
            });

            matched.sort((a, b) => b._score - a._score);
            matchedInspirations = matched.slice(0, 3);
          }
        }
      } catch (_) { /* 容错 */ }

      // --- 2. 生成章节正文 ---
      const contentRes = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: buildChapterSystemPrompt() },
            { role: "user", content: buildChapterUserPrompt(novel, relevantMemory, matchedInspirations) }
          ],
          max_tokens: 4000,
          temperature: 0.78
        })
      });
      const contentData = await contentRes.json();
      if (!contentRes.ok) throw new Error(contentData?.error?.message || `AI 请求失败（${contentRes.status}）`);
      let chapterContent = (contentData?.choices?.[0]?.message?.content || "").trim();
      if (!chapterContent) throw new Error("AI 返回内容为空");
      chapterContent = await polishChapterContent({ baseUrl, apiKey, modelName, chapterContent });

      // --- 3. 提取摘要与向量特征 ---
      let summary = "";
      let memory = null;
      let summaryEmbedding = null;
      try {
        const sumRes = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: buildChapterMemoryPrompt() },
              { role: "user", content: chapterContent }
            ],
            max_tokens: 600,
            temperature: 0.3
          })
        });
        const sumData = await sumRes.json();
        memory = parseChapterMemory(sumData?.choices?.[0]?.message?.content || "");
        summary = memory.summary;
        
        if (summary) {
           summaryEmbedding = await fetchEmbedding(summary, baseUrl, apiKey);
        }
      } catch (_) { /* 容错 */ }
      if (!memory) {
        memory = { summary, openThreads: [], newFacts: [], characterUpdates: [], continuityChecks: [], nextHook: "" };
      }

      const chapter = {
        index: novel.chapters.length + 1,
        content: chapterContent,
        summary,
        memory,
        summaryEmbedding,
        wordCount: chapterContent.replace(/\s/g, "").length,
        createdAt: new Date().toISOString()
      };
      novel.chapters.push(chapter);
      novel.updatedAt = new Date().toISOString();
      await saveNovel(userId, novel);
      sendJson(response, 200, { ok: true, chapter, novel });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { ok: false, message: error.message || "生成失败" });
    }
    return true;
  }

  return false;
}
