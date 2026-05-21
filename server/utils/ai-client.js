import { extractChatText } from "./vector.js";

export function getChatUrl(baseUrl) {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

export function isPlaceholderApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  return !key || key === "sk-your-api-key" || key.includes("your-api-key");
}

export function normalizeAiConfig(modelConfig = {}) {
  const cfg = modelConfig || {};
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
  return {
    apiKey,
    baseUrl,
    modelName,
    hasApiKey: !isPlaceholderApiKey(apiKey)
  };
}

export async function requestChatCompletion({
  modelConfig = {},
  messages,
  temperature,
  maxTokens,
  responseFormat,
  extraBody = {},
  timeoutMs = 30000
}) {
  const { apiKey, baseUrl, modelName } = normalizeAiConfig(modelConfig);
  if (isPlaceholderApiKey(apiKey)) {
    const error = new Error("缺少有效 API Key");
    error.statusCode = 412;
    throw error;
  }

  const body = {
    model: modelName,
    messages,
    ...extraBody
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  if (responseFormat) body.response_format = responseFormat;

  const response = await fetch(getChatUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = extractChatText(data) || data?.error?.message || `AI 服务请求失败（${response.status}）`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const text = extractChatText(data);
  if (!text) throw new Error("AI 返回内容为空");
  return { data, text };
}
