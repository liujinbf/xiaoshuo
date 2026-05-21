import { getAllKnowledge, saveKnowledge } from "./db.js";
import { fetchEmbedding, cosineSimilarity, extractChatText } from "./vector.js";
import { expandKnowledge } from "./knowledge-expansion-service.js";


const getChatUrl = (baseUrl) => {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
};

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
 * 辅助函数：智能从文本中检测出潜在的历史人物、历史真实事件或科学物理化学专有常识词
 */
async function detectEntitiesInText(text, apiKey, baseUrl, modelName) {
  if (!text || text.trim().length < 5) return [];
  try {
    const systemPrompt = `你是一个网络小说常识实体提取专家。请从给定的文本（可能是小说题材、大纲或生成的段落）中，提取出【最核心的 1-2 个真实发生的历史朝代、历史著名人物、历史真实事件、或者核心科学/物理/化学客观常识概念】。
例如，如果文本涉及唐朝朱雀街、李世民、玄武门之变、秦始皇、砒霜测毒、真空重力等，请精准把它们作为实体词提取出来。
请直接输出一个合法的 JSON 数组，例如：["李世民", "玄武门之变"]。禁止使用 markdown 代码块包裹，也不要有任何前言后语。如果没有提取到，输出空数组：[]。`;
    const res = await fetch(getChatUrl(baseUrl), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text.slice(0, 1200) } // 取前 1200 字以防超出限制并保障速度
        ],
        temperature: 0.0,
        max_tokens: 60
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) return [];
    const data = await res.json();
    let responseText = extractChatText(data);
    if (!responseText) return [];
    
    responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(responseText);
    return Array.isArray(parsed) ? parsed.map(s => String(s).trim()).filter(Boolean) : [];
  } catch (e) {
    console.error("[Subject Knowledge Entity Detection] Error detecting entities:", e);
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
    let allKnowledge = await getOrUpdateKnowledgeCache();
    
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

    // 3. 核心机制升级（🆕）：自动检测并联网获取缺席的相关历史/科学常识
    const cfg = modelConfig || {};
    const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
    const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
    const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
    const hasApiKey = apiKey && apiKey !== "sk-your-api-key" && !apiKey.includes("your-api-key");

    if (hasApiKey && cleanText.length >= 6) {
      console.log(`[RAG Auto Expand] Analyzing text for potential history/science entities...`);
      const detected = await detectEntitiesInText(cleanText, apiKey, baseUrl, modelName);
      
      if (detected.length > 0) {
        console.log(`[RAG Auto Expand] Detected entities: ${JSON.stringify(detected)}`);
        let cacheInvalidated = false;

        for (const entity of detected) {
          // 检查该实体是否已存在本地常识库中
          const isExisting = allKnowledge.some(item => {
            const nameMatch = item.entity && item.entity.toLowerCase() === entity.toLowerCase();
            const aliasMatch = item.processedAliases && item.processedAliases.some(a => a.toLowerCase() === entity.toLowerCase());
            return nameMatch || aliasMatch;
          });

          if (!isExisting) {
            console.log(`[RAG Auto Expand] Entity "${entity}" is missing from database. Automatically pulling knowledge...`);
            try {
              // 自动联网并使用 AI 强力扩充生成具有硬逻辑约束的百科词条
              const generated = await expandKnowledge({ entity, modelConfig });
              if (generated && generated.entity && generated.content) {
                await saveKnowledge(generated.category, generated.entity, generated.content, generated.alias || "");
                cacheInvalidated = true;
                console.log(`[RAG Auto Expand] Successfully expanded and saved: ${generated.entity}`);
              }
            } catch (err) {
              console.error(`[RAG Auto Expand] Failed to expand entity "${entity}":`, err);
            }
          }
        }

        if (cacheInvalidated) {
          invalidateKnowledgeCache();
          allKnowledge = await getOrUpdateKnowledgeCache();
          
          // 重新根据最新加载的缓存，跑一遍精准关键词匹配追加
          for (const item of allKnowledge) {
            if (matchedIds.has(item.id)) continue;
            let isHit = false;
            if (item.entity && cleanText.includes(item.entity)) {
              isHit = true;
            }
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
        }
      }
    }

    // 4. 第二阶段：如果匹配数量不足，且配置了有效的 API 密钥，使用语义向量相似度进行补充匹配
    const needMore = limit - matched.length;
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

    // 5. 返回最终合并的最相关常识实体
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
