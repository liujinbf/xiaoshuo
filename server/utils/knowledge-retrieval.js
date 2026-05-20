// ============================================================
// 模块: knowledge-retrieval.js — 本地素材知识库召回与写作策略提炼
// ============================================================

import { getInspirations } from "./db.js";

const NOISE_PATTERN = /[━─=＿_—\-]{3,}|未知设定|精彩故事|公\s*[|/\\.\[\]（）()【】]*\s*(?:众|主)\s*[|/\\.\[\]（）()【】]*\s*号|闲\s*[|/\\.\[\]（）()【】*＊·\s-]*\s*书|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|来源来自网络/;
const COMPACT_NOISE_PATTERN = /公众号|公主号|闲闲书|闲书|书坊|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|西图澜娅|来源来自网络/;

function compactText(value = "") {
  return String(value)
    .replace(/[|｜/\\.\[\]【】（）(){}<>《》「」『』·*＊_\-—=~～!！^]+/g, "")
    .replace(/\s+/g, "");
}

function tokenize(value = "") {
  return String(value)
    .split(/[，。！？、；：\s,.;!?]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 18);
}

function isUsableKnowledge(item) {
  const theme = String(item?.theme || "");
  const hook = String(item?.hook || "");
  const outline = String(item?.outline || "");
  if (theme.length < 6 || hook.length < 10 || outline.length < 10) return false;
  const text = `${theme} ${hook} ${outline}`;
  return !NOISE_PATTERN.test(text) && !COMPACT_NOISE_PATTERN.test(compactText(text));
}

function inferEvidence(raw = "", outline = "") {
  const text = `${raw}\n${outline}`;
  const candidates = ["账本", "录音", "监控", "合同", "转账", "病历", "照片", "短信", "聊天记录", "欠款单", "房产证", "日记", "规则", "报告"];
  return candidates.filter((word) => text.includes(word)).slice(0, 3);
}

function inferScene(raw = "", theme = "") {
  const text = `${raw}\n${theme}`;
  const scenes = ["婚礼", "餐桌", "病房", "酒店", "会议室", "办公室", "祠堂", "村口", "朝堂", "军帐", "电梯", "门口", "客厅", "警局", "监控室"];
  return scenes.find((scene) => text.includes(scene)) || "一个能直接承载冲突和证据的具体地点";
}

function inferPressure(raw = "", outline = "") {
  const text = `${raw}\n${outline}`;
  if (/妈|父母|弟弟|妹妹|赡养|拆迁|家里|亲戚/.test(text)) return "亲情、金钱和道德绑架同时施压";
  if (/丈夫|婆婆|离婚|出轨|孩子|婚/.test(text)) return "亲密关系、名声和财产共同施压";
  if (/经理|公司|项目|辞职|审计|合同/.test(text)) return "职权压迫和利益链封口";
  if (/规则|守则|禁忌|不能|必须/.test(text)) return "规则代价立刻压到主角身上";
  return "让反派用现实利益逼主角马上表态";
}

function splitOutline(outline = "") {
  return String(outline)
    .split(/[;；→\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function buildStrategyPrompt(item) {
  const beats = splitOutline(item.outline);
  const evidence = inferEvidence(item.raw_text, item.outline);
  const scene = inferScene(item.raw_text, item.theme);
  const pressure = inferPressure(item.raw_text, item.outline);
  return [
    `素材主题：${item.theme}`,
    `可学习开篇：${item.hook}`,
    `场景策略：优先从“${scene}”这类具体地点切入，不要先解释背景。`,
    `人物压迫：${pressure}。`,
    evidence.length ? `证据推进：用${evidence.join("、")}等可见物件推动情节。` : "",
    beats.length ? `节奏骨架：${beats.map((beat, index) => `${index + 1}. ${beat}`).join("；")}` : "",
    "使用要求：只学习冲突密度、证据推进和段落节奏，禁止复用原人物名、原句、原剧情和广告信息。"
  ].filter(Boolean).join("\n");
}

function scoreKnowledge(input, item) {
  const queryWords = [
    ...tokenize(input.title),
    ...tokenize(input.theme),
    ...tokenize(input.topic),
    ...tokenize(input.notes),
    ...(Array.isArray(input.tags) ? input.tags : [])
  ];
  const haystack = `${item.theme} ${item.hook} ${item.outline} ${item.raw_text || ""}`.toLowerCase();
  let score = item.genre === input.genre ? 40 : 0;
  queryWords.forEach((word) => {
    if (haystack.includes(word.toLowerCase())) score += word.length >= 4 ? 12 : 7;
  });
  if (item.user_id && item.user_id !== "admin") score += 8;
  return score;
}

export async function retrieveKnowledgeForDraft({ userId, input = {}, limit = 5 }) {
  if (!userId || !input.genre) return [];
  const inspirations = await getInspirations(userId);
  return inspirations
    .filter(isUsableKnowledge)
    .map((item) => ({
      ...item,
      _score: scoreKnowledge(input, item),
      strategyPrompt: buildStrategyPrompt(item)
    }))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}
