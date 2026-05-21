import { randomUUID } from "crypto";
import { saveInspiration, getInspirations, deleteInspiration, clearInspirations } from "../utils/db.js";
import { normalizeAiConfig, requestChatCompletion } from "../utils/ai-client.js";
import { parseAiJsonObject } from "../utils/ai-json.js";

const AD_LINE_PATTERNS = [
  /公\s*[|/\\.[\]（）()【】]*\s*(?:众|主)\s*[|/\\.[\]（）()【】]*\s*号/i,
  /关\s*[|/\\.[\]（）()【】]*\s*注/i,
  /微\s*[|/\\.[\]（）()【】]*\s*信|薇\s*[|/\\.[\]（）()【】]*\s*信|v\s*x/i,
  /闲\s*[|/\\.[\]（）()【】*＊·\s-]*\s*闲|闲\s*[|/\\.[\]（）()【】*＊·\s-]*\s*书/i,
  /书荒|推文|后续|全文|完整版|资源|网盘|夸克|百度云|加群|群号|回复|搜索|菜单栏|阅读全文|番外|来源来自网络|下载后24小时内删除|版权归作者所有|侵犯了您的权益|通知我们及时删除/i,
  /[━─=＿_—\-]{3,}/
];

const CORRUPT_KNOWLEDGE_PATTERNS = [
  ...AD_LINE_PATTERNS,
  /爆款精选：由"[^"]{0,24}(?:公|主|号|闲|书|关注|推文|资源|[|/\\.[\]])[^"]{0,24}"引发/,
  /未知设定|精彩故事/
];

function normalizeObfuscatedText(text = "") {
  return String(text)
    .replace(/[|｜/\\.[\]【】（）(){}<>《》「」『』·*＊_\-—=~～!！^]+/g, "")
    .replace(/\s+/g, "");
}

function isAdLikeLine(line = "") {
  const raw = String(line || "").trim();
  if (!raw) return false;
  const normalized = normalizeObfuscatedText(raw);
  if (raw.length >= 6 && !/[A-Za-z0-9\u4e00-\u9fa5]/.test(raw)) return true;
  return AD_LINE_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(normalized))
    || /公众号|公主号|关注|微信|闲闲书|闲书|书坊|书荒|推文|后续|完整版|网盘|加群|回复|菜单栏|阅读全文|番外|西图澜娅|来源来自网络/.test(normalized);
}

function cleanImportedRawText(rawText = "") {
  const lines = String(rawText || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const kept = lines.filter((line) => !isAdLikeLine(line));
  const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned || String(rawText || "").trim();
}

function isCorruptKnowledgeText(value = "") {
  const raw = String(value || "");
  const normalized = normalizeObfuscatedText(raw);
  return CORRUPT_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(normalized));
}

function isValidDissection(result = {}) {
  const theme = String(result.theme || "").trim();
  const hook = String(result.hook || "").trim();
  const outline = String(result.outline || "").trim();
  if (!theme || !hook || !outline) return false;
  if (theme.length < 6 || hook.length < 10 || outline.length < 10) return false;
  return ![theme, hook, outline].some(isCorruptKnowledgeText);
}

function firstStoryLine(text = "") {
  return String(text || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && !isAdLikeLine(line))
    .find((line) => /[。！？?！]|我|她|他|主角|电话|手机|尸体|规则|丈夫|母亲|老板/.test(line))
    || "";
}

function fallbackDissection(cleanText = "", genre = "suspense") {
  const line = firstStoryLine(cleanText);
  const premise = line
    ? line.replace(/[""\"]/g, "").split(/[。！？!?]/)[0].replace(/^(我|她|他)(第一次)?/, "主角").slice(0, 24)
    : "主角遭遇异常线索并被迫反击";
  const genreTheme = {
    suspense: `${premise}背后的反转谜案`,
    revenge: `${premise}引爆的复仇反击`,
    heroine: `${premise}后的强势翻盘`,
    family: `${premise}撕开的家庭真相`,
    folklore: `${premise}牵出的民俗旧案`,
    rules: `${premise}触发的诡异规则`,
    history: `${premise}造成的历史错位危机`,
    workplace: `${premise}暴露的职场黑幕`
  };
  return {
    theme: genreTheme[genre] || genreTheme.suspense,
    hook: "当【主角】第一次发现【异常线索】时，所有人都以为那只是意外，只有【主角】意识到真正的危险已经开始。",
    outline: "起：主角在日常场景中撞见异常线索，处境迅速失控；承：主角保持冷静，围绕线索调查并发现第一层谎言；转：亲近者或权威证词出现矛盾，真相被故意引向错误方向；合：主角抓住关键证据反向设局，逼出幕后人的真实动机",
    fingerprint: null
  };
}

function localMockDissect(rawText, genre) {
  const text = cleanImportedRawText(rawText || "");
  let detected = genre;

  if (text.includes("周明瑞") || text.includes("红月") || text.includes("绯红")) {
    detected = (genre === "auto" || !genre) ? "rules" : genre;
    return {
      theme: "克苏鲁神秘学穿梭：诡秘之主超凡序列与灰雾之王",
      hook: "当【周明瑞】在剧痛中醒来并看见【太阳穴上的焦黑弹孔】时，【窗外高悬的绯红满月】已悄然拉开诡秘超凡的帷幕。",
      outline: "起：周明瑞离奇穿越并在头部枪伤的剧痛中惊醒；承：冷静观察旧书桌上的左轮手枪与斑驳镜中的弹孔，惊觉原主死于离奇自杀；转：翻开带有血手印的日记本，目睹‘所有人都会死，包括我’的绝望遗言；合：接纳全新身份，利用跨越红月的塔罗灰雾空间开启超凡序列的晋升谱系。",
      detectedGenre: detected,
      fingerprint: {
        openingSpeed: 5,
        voiceStyle: "第三人称近视角",
        dialogueRatio: 30,
        sentenceStyle: "短长混合",
        firstConflictAt: 1,
        pressureType: "规则代价+生命威胁",
        emotionTone: "悲凉沉郁",
        sceneType: "维多利亚式单人房",
        endingHook: "动作断章",
        powerPhrases: ["“绯红的月光穿透窗棂，犹如一只巨大的神灵巨眼。”", "“桌上的左轮手枪还带着温热，暗示着刚才发生的惨烈自裁。”"],
        uniqueVocab: ["绯红", "满月", "左轮", "枪眼", "穿越"],
        rawSample: "剧痛，无与伦比的剧痛。周明瑞从混沌中苏醒，额头冰凉，伸手一摸竟是个致命的凹陷弹孔，而窗外正悬挂着一轮诡异庞大的赤色满月…"
      }
    };
  }
  if (text.includes("萧炎") || text.includes("斗之力") || text.includes("测验魔石碑")) {
    detected = (genre === "auto" || !genre) ? "revenge" : genre;
    return {
      theme: "斗破苍穹：三十年河东的陨落天才与三年之约",
      hook: "当【测验魔石碑】冰冷宣布【萧炎】只有斗之力三段时，【周围族人的冷眼与嘲讽】已将昔日天才少年的尊严彻底踩碎。",
      outline: "起：萧炎在测验石碑前被公布斗之力仅三段，惨遭冷落；承：周围同龄人及族人群起嘲讽落井下石，回忆三年来的痛苦落差；转：未婚妻纳兰嫣然突然带队登门高调退婚，将家族尊严践踏至谷底；合：萧炎铮铮铁骨立下三年之约，誓言三十年河东三十年河西，隐忍咬牙开启绝地反击的崛起逆袭。",
      detectedGenre: detected,
      fingerprint: {
        openingSpeed: 5,
        voiceStyle: "第三人称全知",
        dialogueRatio: 50,
        sentenceStyle: "短长混合",
        firstConflictAt: 2,
        pressureType: "名声+情感",
        emotionTone: "张扬浓烈",
        sceneType: "家族测验广场",
        endingHook: "动作断章",
        powerPhrases: ["“三十年河东，三十年河西，莫欺少年穷！”", "“斗之力，三段！魔石碑上的五个大字犹如耳光抽在众人脸上。”"],
        uniqueVocab: ["斗之力", "嘲讽", "少年", "天赋", "退婚"],
        rawSample: "“萧炎，斗之力，三段！级别：低级！”望着测验魔石碑上闪亮的字迹，黑衣少年自嘲一笑，紧握的双拳指甲深深掐入了掌心肉中…"
      }
    };
  }
  if (text.includes("韩立") || text.includes("二愣子") || text.includes("韩铸")) {
    detected = (genre === "auto" || !genre) ? "history" : genre;
    return {
      theme: "凡人修仙传：凡骨逆天与稳字当头的修仙之路",
      hook: "当【农家少年韩立】因资质平平只被收为记名弟子时，【七玄门中残酷的弱肉强食】已逼迫他踏上如履薄冰的修仙之旅。",
      outline: "起：韩立因肤黑质朴被称二愣子，为谋出路离家参加七玄门考核；承：考核落选却意外因体质被墨大夫收为记名弟子，学习长春功；转：发现墨大夫背后包藏祸心，甚至意图对自己进行‘夺舍’；合：凭借超出常人的稳健与神秘绿瓶加速催熟药草，反杀强敌，正式走出山门踏入凡骨逆天修仙界。",
      detectedGenre: detected,
      fingerprint: {
        openingSpeed: 2,
        voiceStyle: "第三人称近视角",
        dialogueRatio: 15,
        sentenceStyle: "长句为主",
        firstConflictAt: 6,
        pressureType: "生命威胁+规则代价",
        emotionTone: "克制冷静",
        sceneType: "偏远山村土屋",
        endingHook: "情感余韵",
        powerPhrases: ["“修仙之途，凡骨逆天，唯稳字当头。”", "“既然出了大山，那这辈子就没打算再窝窝囊囊地回去。”"],
        uniqueVocab: ["二愣子", "修仙", "出路", "灵根", "苟道"],
        rawSample: "韩立虽然被称为二愣子，但脑瓜却比一般同龄人灵活得多。韩立躺在土炕上，看着房梁漏下的水滴，暗暗发誓要混出个人样来…"
      }
    };
  }
  return fallbackDissection(text, genre);
}

// ─── 合并版 AI 拆解：同时返回 theme/hook/outline + 指纹参数 ───
async function callOpenAIDissect({ rawText, genre, modelConfig }) {
  const cleanedRawText = cleanImportedRawText(rawText);
  const aiConfig = normalizeAiConfig(modelConfig);

  if (!aiConfig.hasApiKey) {
    throw new Error("检测到 AI 密钥未配置或使用的是默认 Placeholder 密钥。请先在系统设置中配置有效的 API Key，本地模板已被禁用。");
  }

  const genreFocusMap = {
    suspense:  "该文为【悬疑反转】，重点提炼'核心反转诡计'、'叙述性诡计'与'制造信息差的悬念'。",
    revenge:   "该文为【婚恋复仇】，重点提炼'背叛痛点/绝望感'与'打脸爽点机制'。",
    heroine:   "该文为【大女主爽文】，重点提炼'女主核心光环'、'独立反杀手段'以及'打破传统偏见的设定'。",
    history:   "该文为【历史错位爽文】，重点提炼'现代文明降维打击点'与'历史人物的认知震撼'。",
    rules:     "该文为【规则怪谈】，重点提炼'核心诡异规则设定'、'生路与死路逻辑'以及'主角破局的关键脑洞'。",
    folklore:  "该文为【中式志怪】，重点提炼'中式恐怖民俗元素'、'因果报应逻辑'与'诡异氛围的白描手法'。",
  };
  const genreFocus = genreFocusMap[genre] || "重点提炼文章的'核心卖点'与'情绪拉扯节奏'。";

  // 🆕 一次请求同时返回拆解三要素 + 写作指纹
  const systemPrompt = `你是一名拥有十年经验的顶级网文拆解大师。请对给定的爆款文章进行逆向工程深度拆解。
${genreFocus}

清洗规则：忽略公众号、书荒推广、网盘资源、加群等广告内容。

请严格输出以下 JSON（不要加 markdown 包裹，所有字段必填）：
{
  "theme": "核心矛盾/选题定位（30字内）",
  "hook": "开篇钩子公式（含【主角】【秘密】等占位符，60字内）",
  "outline": "起承转合骨架，用分号分隔，每步点明情绪价值",
  "fingerprint": {
    "openingSpeed": "1-5整数（5=第一句就切入冲突）",
    "voiceStyle": "第一人称沉浸/第三人称近视角/第三人称全知",
    "dialogueRatio": "0-100整数（对话占比%）",
    "sentenceStyle": "极短句主导/短长混合/长句为主",
    "firstConflictAt": "整数（第几句出现第一个冲突）",
    "pressureType": "金钱/名声/情感/职权/规则代价/生命威胁（多选用+连接）",
    "emotionTone": "克制冷静/张扬浓烈/幽默讽刺/悲凉沉郁/轻松甜蜜",
    "sceneType": "最常见场景（如：家庭餐桌/职场会议室/古代宫廷）",
    "endingHook": "动作断章/台词断章/发现断章/悬念留白/情感余韵",
    "powerPhrases": ["原文中最有冲击力的2-3句话，必须原文摘抄"],
    "uniqueVocab": ["这篇文特有的高频核心词，最多5个"],
    "rawSample": "原文最精彩的一段（150字内，必须原文）"
  }
}`;

  const userPrompt = `【文章题材】${genre}\n【爆款原文】\n${cleanedRawText.slice(0, 6000)}`;

  try {
    const { text } = await requestChatCompletion({
      modelConfig,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 1800,
      temperature: 0.4,
      responseFormat: { type: "json_object" },
      timeoutMs: 60000
    });
    const parsed = parseAiJsonObject(text);
    if (!isValidDissection(parsed)) {
      throw new Error("AI 拆解结果未通过内容合规校验（可能包含广告噪音、空白字段或格式异常）");
    }
    return parsed;
  } catch (err) {
    console.warn(`[DB Dissect] AI 失败: ${err.message}`);
    throw new Error(`AI模型链接或调用失败！请检查 API 密钥、接口地址（Base URL: ${aiConfig.baseUrl}）是否正确，或网络是否通畅。错误详情: ${err.message}`);
  }
}

export async function handleInspirationsRoutes(request, response, url, { sendJson, readJson, getUserId }) {
  if (!url.pathname.startsWith("/api/inspirations")) return false;

  const userId = getUserId(request, {}, url);
  if (!userId) {
    sendJson(response, 401, { ok: false, message: "未授权访问，请提供 Token" });
    return true;
  }

  // POST /api/inspirations/dissect — AI 拆解（现在同时返回 fingerprint）
  if (url.pathname === "/api/inspirations/dissect" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const { rawText, genre, modelConfig } = body;
      if (!rawText) {
        sendJson(response, 400, { ok: false, message: "原文不能为空" });
        return true;
      }
      const cleanedRawText = cleanImportedRawText(rawText);
      const dissected = await callOpenAIDissect({ rawText: cleanedRawText, genre, modelConfig });
      sendJson(response, 200, { ok: true, ...dissected });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // GET /api/inspirations — 获取素材列表
  if (request.method === "GET") {
    try {
      const inspirations = await getInspirations(userId);
      sendJson(response, 200, { ok: true, inspirations });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // POST /api/inspirations — 保存拆解结果（现在支持 fingerprint）
  if (request.method === "POST") {
    try {
      const body = await readJson(request);
      const { genre, theme, hook, outline, rawText, fingerprint } = body;

      if (!theme || !hook || !outline) {
        sendJson(response, 400, { ok: false, message: "参数不完整" });
        return true;
      }
      const cleaned = {
        theme: String(theme || "").trim(),
        hook: String(hook || "").trim(),
        outline: String(outline || "").trim()
      };
      if (!isValidDissection(cleaned)) {
        sendJson(response, 422, { ok: false, message: "拆解结果疑似包含广告或无效素材，已拒绝入库。请清洗原文后重试。" });
        return true;
      }

      const id = randomUUID();
      // 🆕 同时保存 fingerprint 指纹（如果有的话）
      await saveInspiration(
        id, userId, genre || "suspense",
        cleaned.theme, cleaned.hook, cleaned.outline,
        cleanImportedRawText(rawText || ""),
        fingerprint ? JSON.stringify(fingerprint) : null
      );

      sendJson(response, 200, { ok: true, id, message: "学习成功" });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // DELETE /api/inspirations/clear-all — 一键清空
  if (url.pathname === "/api/inspirations/clear-all" && request.method === "DELETE") {
    try {
      const body = await readJson(request);
      const includeAdmin = body?.includeAdmin === true && userId === "admin";
      const deleted = await clearInspirations(userId, includeAdmin);
      sendJson(response, 200, { ok: true, deleted, message: `已清空 ${deleted} 条素材记录` });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // DELETE /api/inspirations?id=xxx — 单条删除
  if (request.method === "DELETE") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        sendJson(response, 400, { ok: false, message: "缺少必要参数 id" });
        return true;
      }
      await deleteInspiration(userId, id);
      sendJson(response, 200, { ok: true, message: "删除成功" });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  return false;
}
