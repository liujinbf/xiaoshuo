// ============================================================
// 模块: server/utils/vector.js — 向量嵌入工具
// 职责: fetchEmbedding（调用 OpenAI Embeddings API）
//       cosineSimilarity（余弦相似度计算）
//       extractChatText（OpenAI Chat Completions 响应解析）
// 单文件行数上限: 100 行
// ============================================================

const getEmbeddingsUrl = (baseUrl) => {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/embeddings` : `${clean}/v1/embeddings`;
};

/**
 * 从 OpenAI 兼容接口获取文本嵌入向量
 * @param {string} text - 待嵌入的文本
 * @param {string} baseUrl - API Base URL（不含尾部斜杠）
 * @param {string} apiKey - Bearer Token
 * @returns {Promise<number[]|null>} 嵌入向量，失败时返回 null
 */
export async function fetchEmbedding(text, baseUrl, apiKey) {
  try {
    const res = await fetch(getEmbeddingsUrl(baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch {
    return null; // 容错，不阻断主流程
  }
}

/**
 * 计算两个向量的余弦相似度
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} 0~1 之间的相似度，异常时返回 0
 */
export function cosineSimilarity(vecA, vecB) {
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

/**
 * 从 OpenAI Chat Completions 响应中提取文本内容
 * @param {object} data - API 响应 JSON
 * @returns {string} 提取到的文本，失败返回空字符串
 */
export function extractChatText(data) {
  return (data?.choices?.[0]?.message?.content || "").trim();
}
