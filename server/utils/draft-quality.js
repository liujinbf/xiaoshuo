// ============================================================
// 模块: draft-quality.js — 正文生成质量闸门
// ============================================================

const BAD_PHRASES = [
  "事情发生在",
  "那时我还不知道",
  "那时她还不知道",
  "真正的局",
  "只是一个幌子",
  "命运的齿轮",
  "随着时间的推移",
  "总之",
  "不可否认"
];

function compact(value = "") {
  return String(value).replace(/\s+/g, "");
}

function splitParagraphs(text = "") {
  return String(text)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findRepeatedTitle(text = "", title = "") {
  const cleanTitle = compact(title);
  if (!cleanTitle || cleanTitle.length < 8) return false;
  return compact(text).includes(cleanTitle);
}

function countConcreteSignals(text = "") {
  const signals = ["手机", "录音", "监控", "合同", "账本", "照片", "短信", "门", "桌", "镜头", "电话", "签字", "房间", "走廊", "客厅", "医院", "酒店"];
  return signals.filter((word) => text.includes(word)).length;
}

export function assessDraftQuality(text = "", input = {}) {
  const paragraphs = splitParagraphs(text);
  const issues = [];
  BAD_PHRASES.forEach((phrase) => {
    if (text.includes(phrase)) issues.push(`出现模板腔：${phrase}`);
  });
  if (findRepeatedTitle(text, input.title)) issues.push("正文直接复述标题，像简介而不是场景");
  if (paragraphs.length < 5) issues.push("段落过少，移动端阅读节奏不足");
  if (paragraphs[0] && paragraphs[0].length > 220) issues.push("第一段过长，开篇进入场景太慢");
  if (countConcreteSignals(text) < 2) issues.push("可见证据和场景物件不足");
  if (!/[“”"].{2,40}[“”"]/.test(text)) issues.push("缺少短对话，人物压迫感不够");
  return {
    ok: issues.length === 0,
    issues,
    paragraphs: paragraphs.length
  };
}
