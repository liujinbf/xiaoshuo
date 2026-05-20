import { getAllKnowledge } from "./db.js";
import { fetchEmbedding, cosineSimilarity } from "./vector.js";

// 全局内存常识索引缓存
let cachedKnowledgeList = null;

/**
 * 主动失效内存缓存（供添加/扩充常识后调用）
 */
export function invalidateKnowledgeCache() {
  console.log("[Knowledge Cache] Invalidated in-memory knowledge store.");
  cachedKnowledgeList = null;
}

/**
 * 获取或更新内存储备的常识卡片
 */
async function getOrUpdateKnowledgeCache() {
  if (cachedKnowledgeList) {
    return cachedKnowledgeList;
  }
  try {
    const list = await getAllKnowledge();
    // 预处理别名数组，避免匹配时重复解析
    cachedKnowledgeList = (list || []).map(item => {
      const aliases = String(item.alias || "")
        .split(/[,，、|]/)
        .map(a => a.trim())
        .filter(a => a.length >= 2);
      return {
        ...item,
        processedAliases: aliases
      };
    });
    console.log(`[Knowledge Cache] Loaded ${cachedKnowledgeList.length} items into memory.`);
    return cachedKnowledgeList;
  } catch (e) {
    console.error("[Knowledge Cache] Failed to load store:", e);
    return [];
  }
}

/**
 * 根据作者的输入信息（大纲主题、流派、人设定向等），智能匹配并召回学科百科常识库
 * @param {object} params
 * @param {string} params.text - 需要提取实体的文本（通常是主题 theme、notes、或大纲）
 * @param {number} [params.limit] - 返回条数限制，默认 3 条
 * @param {object} [params.modelConfig] - 客户端模型配置，用于辅助向量计算
 * @returns {Promise<Array<{category: string, entity: string, content: string, alias: string}>>}
 */
export async function retrieveSubjectKnowledge({ text = "", limit = 3, modelConfig = null }) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return [];

  try {
    // 1. 获取全局内存储备，免去每次请求查 SQLite 的开销
    const allKnowledge = await getOrUpdateKnowledgeCache();
    if (!allKnowledge || allKnowledge.length === 0) return [];

    // 2. 第一阶段：关键词和别名匹配（Rule-based Keyword Search）
    const matched = [];
    const matchedIds = new Set();

    for (const item of allKnowledge) {
      let isHit = false;
      
      // 2.1 实体名精确包含
      if (item.entity && cleanText.includes(item.entity)) {
        isHit = true;
      }
      
      // 2.2 别名拆分匹配
      if (!isHit && item.processedAliases && item.processedAliases.length > 0) {
        for (const alias of item.processedAliases) {
          if (cleanText.includes(alias)) {
            isHit = true;
            break;
          }
        }
      }

      if (isHit) {
        matched.push(item);
        matchedIds.add(item.id);
      }
    }

    // 3. 第二阶段：如果匹配数量不足，且配置了有效的 API 密钥，使用语义向量相似度进行补充匹配
    const needMore = limit - matched.length;
    const cfg = modelConfig || {};
    const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
    const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");

    const hasApiKey = apiKey && apiKey !== "sk-your-api-key" && !apiKey.includes("your-api-key");

    if (needMore > 0 && hasApiKey && cleanText.length >= 8) {
      console.log(`[RAG Hybrid Search] Rule-based matched ${matched.length}/${limit}. Performing vector query for remaining slots...`);
      
      // 仅对未被精准命中的候选项进行相似度检索
      const candidates = allKnowledge.filter(item => !matchedIds.has(item.id));
      
      if (candidates.length > 0) {
        const textVec = await fetchEmbedding(cleanText, baseUrl, apiKey);
        if (textVec) {
          const scoredCandidates = [];
          
          for (const item of candidates) {
            let itemVec = null;
            if (item.embedding) {
              try {
                itemVec = JSON.parse(item.embedding);
              } catch (e) {
                itemVec = null;
              }
            }
            
            // 如果常识本身没有向量，则在内存中动态懒加载一次并可回写（此处直接计算）
            if (!itemVec) {
              itemVec = await fetchEmbedding(item.entity + "：" + item.content, baseUrl, apiKey);
              if (itemVec) {
                // 异步在数据库中回写，不阻断本次搜索
                const { saveKnowledge } = await import("./db.js");
                saveKnowledge(item.category, item.entity, item.content, item.alias || "", itemVec).catch(err => {
                  console.error("[RAG DB Update] Lazy writing embedding failed:", err);
                });
                item.embedding = JSON.stringify(itemVec); // 缓存回内存
              }
            }

            if (itemVec) {
              const similarity = cosineSimilarity(textVec, itemVec);
              scoredCandidates.push({ item, score: similarity });
            }
          }

          // 按照相似度降序排序，过滤低相关度（例如小于 0.35）的结果
          scoredCandidates.sort((a, b) => b.score - a.score);
          const qualified = scoredCandidates
            .filter(c => c.score >= 0.35)
            .map(c => c.item);

          for (const item of qualified) {
            if (matched.length >= limit) break;
            if (!matchedIds.has(item.id)) {
              matched.push(item);
              matchedIds.add(item.id);
            }
          }
        }
      }
    }

    // 4. 返回最终合并的最相关常识实体
    return matched.slice(0, limit);
  } catch (error) {
    console.error("[Knowledge Retrieval Service] Error retrieving subject knowledge:", error);
    return [];
  }
}

/**
 * 格式化召回的常识库为 AI Prompt 约束文本
 * @param {Array<{category: string, entity: string, content: string}>} items
 * @returns {string}
 */
export function formatKnowledgeForPrompt(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "";

  const parts = ["【硬性现实逻辑与常识约束】（故事设定如果涉及以下实体，必须严格符合这些常识，绝对不许虚构违背）："];
  items.forEach((item, idx) => {
    parts.push(`${idx + 1}. [${item.category}] 关于“${item.entity}”的真实设定：${item.content}`);
  });
  parts.push("（再次强调：AI 在扩写大纲或生成章节正文时，必须完全符合上述硬常识。例如如果涉及秦朝，不可出现辣椒、西红柿、棉布衣等设定；如果涉及砒霜，不可采用银针测出纯毒等桥段）");
  
  return parts.join("\n");
}
