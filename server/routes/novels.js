import {
  getUserNovels, saveNovel, deleteNovel,
  saveChapterEmbedding, deleteChapterEmbeddings
} from "../utils/db.js";
import crypto from "node:crypto";
import {
  buildChapterSystemPrompt,
  buildChapterUserPrompt,
  buildChapterMemoryPrompt,
  buildChapterPolishSystemPrompt,
  buildChapterPolishUserPrompt,
  buildOutlineStep1Prompt,
  buildOutlineStep2Prompt,
  buildCharacterGenPrompt
} from "../utils/prompts.js";
import { fetchEmbedding, cosineSimilarity, extractChatText } from "../utils/vector.js";
import { retrieveKnowledgeForDraft } from "../utils/knowledge-retrieval.js";
import { retrieveSubjectKnowledge } from "../utils/knowledge-retrieval-service.js";


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
      }),
      signal: AbortSignal.timeout(35000)
    });
    const polishData = await polishRes.json();
    if (!polishRes.ok) return chapterContent;
    const polished = extractChatText(polishData);
    return polished || chapterContent;
  } catch {
    return chapterContent;
  }
}

/**
 * 提取章节摘要结构化记忆
 * @returns {Promise<{memory: object, summary: string}>}
 */
async function extractChapterMemory({ baseUrl, apiKey, modelName, chapterContent }) {
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
      }),
      signal: AbortSignal.timeout(25000)
    });
    const sumData = await sumRes.json();
    const memory = parseChapterMemory(extractChatText(sumData));
    return { memory, summary: memory.summary };
  } catch {
    return { memory: null, summary: "" };
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
    // 联动清理向量嵌入，防止孤儿数据累积
    await deleteChapterEmbeddings(novelId).catch(() => {});
    sendJson(response, 200, { ok: true });
    return true;
  }

  // ─── POST /api/novels/:id/characters/generate — AI 自动生成人物设定（v4.0）───
  const genCharMatch = url.pathname.match(/^\/api\/novels\/([^/]+)\/characters\/generate$/);
  if (genCharMatch && request.method === "POST") {
    const novelId = genCharMatch[1];
    try {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }

      const cfg = payload.modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
      if (!apiKey) { sendJson(response, 412, { ok: false, message: "缺少 API Key" }); return true; }

      const userNovels = await getUserNovels(userId);
      const novel = userNovels.find(n => n.id === novelId);
      if (!novel) { sendJson(response, 404, { ok: false, message: "小说不存在" }); return true; }

      const charRes = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: buildCharacterGenPrompt({
            title: novel.title,
            genre: novel.genre,
            style: payload.style || "",
            brainstorm: payload.brainstorm || "",
            characterCount: payload.characterCount || {}
          }) }],
          max_tokens: 5000,
          temperature: 0.9   // 人物创意最高
        }),
        signal: AbortSignal.timeout(90000)
      });
      const charData = await charRes.json();
      if (!charRes.ok) throw new Error(charData?.error?.message || "人物生成失败");
      const characters = extractChatText(charData);

      // 将生成的人物设定存回小说记录
      novel.generatedCharacters = characters;
      novel.updatedAt = new Date().toISOString();
      await saveNovel(userId, novel);

      sendJson(response, 200, { ok: true, characters, message: "人物设定生成完成" });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { ok: false, message: error.message });
    }
    return true;
  }

  // ─── POST /api/novels/:id/outline/generate — 两步大纲生成（🆕）───
  const genOutlineMatch = url.pathname.match(/^\/api\/novels\/([^/]+)\/outline\/generate$/);
  if (genOutlineMatch && request.method === "POST") {
    const novelId = genOutlineMatch[1];
    try {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }

      const cfg = payload.modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
      if (!apiKey) { sendJson(response, 412, { ok: false, message: "缺少 API Key" }); return true; }

      const userNovels = await getUserNovels(userId);
      const novel = userNovels.find(n => n.id === novelId);
      if (!novel) { sendJson(response, 404, { ok: false, message: "小说不存在" }); return true; }

      const params = {
        title: novel.title,
        genre: novel.genre,
        targetChapters: novel.targetChapters || 10,
        chapterLength: novel.chapterLength || 2000,
        brainstorm: payload.brainstorm || novel.outline || "",
        characters: novel.characters || novel.generatedCharacters || ""
      };

      // 第一步：核心设定（temperature 0.85，创意优先）
      const step1Res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: buildOutlineStep1Prompt(params) }],
          max_tokens: 3000,
          temperature: 0.85
        }),
        signal: AbortSignal.timeout(60000)
      });
      const step1Data = await step1Res.json();
      if (!step1Res.ok) throw new Error(step1Data?.error?.message || "第一步大纲生成失败");
      const step1Result = extractChatText(step1Data);

      // 第二步：章节大纲（temperature 0.7，结构优先）
      const step2Res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: buildOutlineStep2Prompt(params, step1Result) }],
          max_tokens: 4000,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(90000)
      });
      const step2Data = await step2Res.json();
      if (!step2Res.ok) throw new Error(step2Data?.error?.message || "第二步大纲生成失败");
      const step2Result = extractChatText(step2Data);

      // 把生成的大纲存回小说记录
      novel.generatedSetting = step1Result;
      novel.generatedOutline = step2Result;
      novel.updatedAt = new Date().toISOString();
      await saveNovel(userId, novel);

      sendJson(response, 200, {
        ok: true,
        setting: step1Result,
        chapterOutlines: step2Result,
        message: "大纲生成完成，请确认后复制到小说大纲字段"
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { ok: false, message: error.message });
    }
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

      // --- 1. 向量记忆召回（从独立表读取） ---
      let relevantMemory = "";
      if (novel.chapters.length >= 2) {
        try {
          const { getChapterEmbeddings } = await import("../utils/db.js");
          const allEmbeddings = await getChapterEmbeddings(novel.id);
          const embMap = Object.fromEntries(allEmbeddings.map(e => [e.chapterIndex, e.embedding]));
          const lastChapter = novel.chapters[novel.chapters.length - 1];
          const lastEmb = embMap[lastChapter.index];
          if (lastEmb) {
            const scoredChapters = novel.chapters
              .slice(0, -1)
              .map(ch => ({
                chapter: ch,
                score: cosineSimilarity(lastEmb, embMap[ch.index])
              }))
              .filter(item => item.score > 0.6)
              .sort((a, b) => b.score - a.score)
              .slice(0, 2);
            if (scoredChapters.length > 0) {
              relevantMemory = scoredChapters.map(sc => `第${sc.chapter.index}章：${formatMemoryForRecall(sc.chapter)}`).join("\n");
            }
          }
        } catch { /* 容错，向量召回不阻断生成 */ }
      }

      // --- 1.5 召回本地素材库策略 (RAG) ---
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
      const matchedInspirations = await retrieveKnowledgeForDraft({
        userId,
        limit: 5,
        input: {
          genre: genreEnMap[novel.genre] || novel.genre,
          title: novel.title,
          theme: novel.outline,
          notes: novel.characters,
          tags: []
        }
      });

      // --- 1.6 召回学科公开知识库 (历史、物理、化学等) ---
      const combinedText = `${novel.title} ${novel.outline} ${novel.characters}`;
      const matchedSubjectKnowledge = await retrieveSubjectKnowledge({
        text: combinedText,
        limit: 3
      });

      // --- 2. 生成章节正文 ---
      const contentRes = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: buildChapterSystemPrompt() },
            { role: "user", content: buildChapterUserPrompt(novel, relevantMemory, matchedInspirations, matchedSubjectKnowledge) }
          ],
          max_tokens: 4000,
          temperature: 0.88,
          frequency_penalty: 0.3,
          presence_penalty: 0.1
        }),
        signal: AbortSignal.timeout(60000)
      });
      const contentData = await contentRes.json();
      if (!contentRes.ok) throw new Error(extractChatText(contentData) || contentData?.error?.message || `AI 请求失败（${contentRes.status}）`);
      let chapterContent = extractChatText(contentData);
      if (!chapterContent) throw new Error("AI 返回内容为空");

      // --- 3. 润色 + 摘要提取 并行执行 ---
      const [polishedContent, { memory, summary }] = await Promise.all([
        polishChapterContent({ baseUrl, apiKey, modelName, chapterContent }),
        extractChapterMemory({ baseUrl, apiKey, modelName, chapterContent })
      ]);
      chapterContent = polishedContent;
      const finalMemory = memory || { summary, openThreads: [], newFacts: [], characterUpdates: [], continuityChecks: [], nextHook: "" };

      // --- 4. 生成并单独存储嵌入向量 ---
      if (summary) {
        fetchEmbedding(summary, baseUrl, apiKey).then(emb => {
          if (emb) saveChapterEmbedding(novel.id, novel.chapters.length + 1, emb).catch(() => {});
        }).catch(() => {});
      }

      const chapter = {
        index: novel.chapters.length + 1,
        content: chapterContent,
        summary,
        memory: finalMemory,
        // summaryEmbedding 已迁移至 chapter_embeddings 表，不再存入 JSON
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
