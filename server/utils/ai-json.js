function extractJsonCore(text) {
  let clean = String(text || "").trim();
  clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  const startBrace = clean.indexOf("{");
  const startBracket = clean.indexOf("[");
  if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
    const endBrace = clean.lastIndexOf("}");
    if (endBrace !== -1) clean = clean.slice(startBrace, endBrace + 1);
  } else if (startBracket !== -1) {
    const endBracket = clean.lastIndexOf("]");
    if (endBracket !== -1) clean = clean.slice(startBracket, endBracket + 1);
  }
  return clean;
}

function repairJsonText(text) {
  return text
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
      if (match === "\n" || match === "\r" || match === "\t") return match;
      return "";
    });
}

export function parseAiJson(text) {
  const clean = extractJsonCore(text);
  try {
    return JSON.parse(clean);
  } catch {
    return JSON.parse(repairJsonText(clean));
  }
}

export function parseAiJsonObject(text) {
  const value = parseAiJson(text);
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("AI 返回内容不是合法 JSON 对象");
  }
  return value;
}

export function parseAiJsonArray(text) {
  const value = parseAiJson(text);
  if (!Array.isArray(value)) {
    throw new Error("AI 返回内容不是合法 JSON 数组");
  }
  return value;
}
