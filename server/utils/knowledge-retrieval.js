// ============================================================
// 模块: knowledge-retrieval.js — 指纹增强版素材召回
// 升级：集成 genre_statistics 统计规律 + 指纹降维注入
// ============================================================

import { getInspirations } from "./db.js";

const NOISE_PATTERN = /[━─=＿_—\-]{3,}|未知设定|精彩故事|公\s*[|/\\.[\]（）()【】]*\s*(?:众|主)\s*[|/\\.[\]（）()【】]*\s*号|闲\s*[|/\\.[\]（）()【】*＊·\s-]*\s*书|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|来源来自网络/;
const COMPACT_NOISE_PATTERN = /公众号|公主号|闲闲书|闲书|书坊|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|西图澜娅|来源来自网络/;

function compactText(value = "") {
  return String(value)
    .replace(/[|｜/\\.[\]【】（）(){}<>《》「」『』·*＊_\-—=~～!！^]+/g, "")
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
  if (/妈|父母|弟弟|妹妹|赡养|拆迁|家里|亲戚/.test(text)) return "亲情、金钱和道德绑定同时施压";
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

/**
 * 🆕 从 fingerprint 字段提炼写作策略（核心升级）
 * 不再直接粘贴 hook 文本，改为注入"参数化风格指令"
 */
function buildFingerprintStrategy(item) {
  let fp = null;
  try {
    fp = item.fingerprint ? JSON.parse(item.fingerprint) : null;
  } catch { fp = null; }

  if (!fp) return null;

  const lines = [];

  // 开篇速度指令
  if (fp.openingSpeed >= 4) {
    lines.push(`开篇节奏：极快切入，第1-2句必须出现冲突或异常（参考该书开篇速度评分 ${fp.openingSpeed}/5）`);
  } else if (fp.openingSpeed <= 2) {
    lines.push(`开篇节奏：克制铺垫，用环境/人物细节建立紧张感，前3段才爆发冲突`);
  } else {
    lines.push(`开篇节奏：3-5句内进入第一个矛盾，不要先解释背景`);
  }

  // 对话比例指令
  if (fp.dialogueRatio >= 50) {
    lines.push(`对话密度：高频对话推进（约 ${fp.dialogueRatio}%），每段尽量包含台词，用对话展现压力`);
  } else if (fp.dialogueRatio <= 20) {
    lines.push(`对话密度：叙述为主（约 ${fp.dialogueRatio}%），少量精准台词，台词必须有分量`);
  }

  // 句式风格指令
  const sentenceGuide = {
    "极短句主导": "大量使用 5-10 字的短句，制造节奏感，避免复合长句",
    "短长混合": "短句制造冲击，长句描写情绪，节奏错落有致",
    "长句为主": "使用绵密的长句建立情绪积累，在关键处突然用短句切断",
  };
  if (fp.sentenceStyle && sentenceGuide[fp.sentenceStyle]) {
    lines.push(`句式要求：${sentenceGuide[fp.sentenceStyle]}`);
  }

  // 情感基调指令
  const toneGuide = {
    "克制冷静": "叙事者保持冷静旁观，用具体细节传递情绪，禁止直接说出'我很愤怒/悲伤'",
    "张扬浓烈": "情绪外露、台词有力度，允许大段内心呐喊但要有细节支撑",
    "幽默讽刺": "用轻描淡写讽刺对方的荒谬，主角的冷幽默是武器",
    "悲凉沉郁": "苦中作乐，用生活细节而非哭泣传递重量",
    "轻松甜蜜": "节奏明快，冲突化解迅速，情感升温自然",
  };

  if (fp.emotionTone && toneGuide[fp.emotionTone]) {
    lines.push(`情感基调：${toneGuide[fp.emotionTone]}`);
  }

  // 压力来源指令
  if (fp.pressureType) {
    lines.push(`施压方式：对抗者通过 ${fp.pressureType} 逼迫主角，不要只写口头争吵，要写出具体的现实代价`);
  }

  // 结尾断章指令
  const endGuide = {
    "动作断章": "结尾必须用一个具体动作收尾，不要有任何解释或总结",
    "台词断章": "结尾用一句出乎意料的台词直接断章",
    "发现断章": "结尾用主角发现一件异常物品或信息断章",
    "悬念留白": "结尾停在问题抛出的一瞬间，不给答案",
    "情感余韵": "结尾留一处余温，让读者回味情感而不是剧情",
  };
  if (fp.endingHook && endGuide[fp.endingHook]) {
    lines.push(`断章方式：${endGuide[fp.endingHook]}`);
  }

  // 真实金句（原文摘抄，最多2条）
  if (Array.isArray(fp.powerPhrases) && fp.powerPhrases.length > 0) {
    lines.push(`\n参考原文高冲击写法（只学节奏，不复制）：`);
    fp.powerPhrases.slice(0, 2).forEach(p => {
      lines.push(`  「${p.slice(0, 80)}」`);
    });
  }

  // 场景类型
  if (fp.sceneType) {
    lines.push(`\n场景建议：优先使用"${fp.sceneType}"类场景，让对抗有物理空间感`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * 构建传统策略 Prompt（无 fingerprint 时的降级方案）
 */
function buildStrategyPrompt(item) {
  // 优先使用指纹策略
  const fingerprintStrategy = buildFingerprintStrategy(item);
  if (fingerprintStrategy) {
    return [
      `素材主题：${item.theme}`,
      `\n【从该爆款书学到的写作参数指令】`,
      fingerprintStrategy,
      `\n使用要求：严格按照上述参数生成，禁止复用原书人物名、原句和原剧情。`,
    ].join("\n");
  }

  // 降级：传统策略
  const beats = splitOutline(item.outline);
  const evidence = inferEvidence(item.raw_text, item.outline);
  const scene = inferScene(item.raw_text, item.theme);
  const pressure = inferPressure(item.raw_text, item.outline);
  return [
    `素材主题：${item.theme}`,
    `可学习开篇：${item.hook}`,
    `场景策略：优先从"${scene}"这类具体地点切入，不要先解释背景。`,
    `人物压迫：${pressure}。`,
    evidence.length ? `证据推进：用${evidence.join("、")}等可见物件推动情节。` : "",
    beats.length ? `节奏骨架：${beats.map((beat, index) => `${index + 1}. ${beat}`).join("；")}` : "",
    "使用要求：只学习冲突密度、证据推进和段落节奏，禁止复用原人物名、原句、原剧情和广告信息。",
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
  
  // 题材匹配加分
  let score = item.genre === input.genre ? 40 : 0;
  
  // 关键词命中加分
  queryWords.forEach((word) => {
    if (haystack.includes(word.toLowerCase())) score += word.length >= 4 ? 12 : 7;
  });
  
  // 用户自己导入的素材优先（更具个性化参考价值）
  if (item.user_id && item.user_id !== "admin") score += 8;
  
  // 🆕 有指纹数据的素材优先（质量更高）
  if (item.fingerprint) score += 15;
  
  // 🆕 有原文样本的素材优先
  if (item.raw_text && item.raw_text.length > 200) score += 5;
  
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

/**
 * 🆕 获取题材统计规律，用于动态 Prompt 生成
 * @param {object} db - 数据库实例
 * @param {string} genre - 题材
 * @returns {object|null}
 */
export async function getGenreStatistics(db, genre) {
  try {
    const row = await db.get(
      "SELECT stats, sample_count FROM genre_statistics WHERE genre = ?",
      [genre]
    );
    if (!row) return null;
    const stats = JSON.parse(row.stats);
    const n = row.sample_count || 1;
    
    // 计算平均值
    return {
      sampleCount: n,
      avgOpeningSpeed: (stats.openingSpeedSum / n).toFixed(1),
      avgDialogueRatio: (stats.dialogueRatioSum / n).toFixed(0),
      avgFirstConflictAt: (stats.firstConflictAtSum / n).toFixed(0),
      dominantVoiceStyle: topKey(stats.voiceStyles),
      dominantSentenceStyle: topKey(stats.sentenceStyles),
      dominantEmotionTone: topKey(stats.emotionTones),
      dominantPressureType: topKey(stats.pressureTypes),
      dominantEndingHook: topKey(stats.endingHooks),
      topSceneTypes: topN(stats.sceneTypes, 3),
      powerPhrases: (stats.powerPhrases || []).slice(0, 20),
      uniqueVocabs: (stats.uniqueVocabs || []).slice(0, 30),
    };
  } catch {
    return null;
  }
}

function topKey(obj = {}) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function topN(obj = {}, n = 3) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
}
