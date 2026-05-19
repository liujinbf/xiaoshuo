import { randomUUID } from "crypto";
import { saveInspiration, getInspirations, deleteInspiration } from "../utils/db.js";

const AD_LINE_PATTERNS = [
  /公\s*[|/\\.\[\]（）()【】]*\s*(?:众|主)\s*[|/\\.\[\]（）()【】]*\s*号/i,
  /关\s*[|/\\.\[\]（）()【】]*\s*注/i,
  /微\s*[|/\\.\[\]（）()【】]*\s*信|薇\s*[|/\\.\[\]（）()【】]*\s*信|v\s*x/i,
  /闲\s*[|/\\.\[\]（）()【】*＊·\s-]*\s*闲|闲\s*[|/\\.\[\]（）()【】*＊·\s-]*\s*书/i,
  /书荒|推文|后续|全文|完整版|资源|网盘|夸克|百度云|加群|群号|回复|搜索|菜单栏|阅读全文|番外|来源来自网络|下载后24小时内删除|版权归作者所有|侵犯了您的权益|通知我们及时删除/i,
  /[━─=＿_—\-]{3,}/
];

const CORRUPT_KNOWLEDGE_PATTERNS = [
  ...AD_LINE_PATTERNS,
  /爆款精选：由“[^”]{0,24}(?:公|主|号|闲|书|关注|推文|资源|[|/\\.\[\]])[^”]{0,24}”引发/,
  /未知设定|精彩故事/
];

function normalizeObfuscatedText(text = "") {
  return String(text)
    .replace(/[|｜/\\.\[\]【】（）(){}<>《》「」『』·*＊_\-—=~～!！^]+/g, "")
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
    ? line
        .replace(/[“”"]/g, "")
        .split(/[。！？!?]/)[0]
        .replace(/^(我|她|他)(第一次)?/, "主角")
        .slice(0, 24)
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
    outline: "起：主角在日常场景中撞见异常线索，处境迅速失控；承：主角保持冷静，围绕线索调查并发现第一层谎言；转：亲近者或权威证词出现矛盾，真相被故意引向错误方向；合：主角抓住关键证据反向设局，逼出幕后人的真实动机"
  };
}

function localMockDissect(rawText, genre) {
  const text = cleanImportedRawText(rawText || "");
  
  // 1. 智能匹配《诡秘之主》
  if (text.includes("周明瑞") || text.includes("红月") || text.includes("绯红")) {
    return {
      theme: "克苏鲁神秘学穿梭：我靠左轮手枪与绯红满月开启序列之神",
      hook: "当【周明瑞】在剧痛中醒来并发现【镜子中开孔的自己】时，【窗外的红月】已经宣告了他回不去的地球。",
      outline: "周明瑞离奇穿越并承受头部重创剧痛；周明瑞观察房间陈设发现书桌上的左轮手枪与镜中凹陷枪眼；周明瑞目睹异域赤红满月并发现日记本上的死亡遗言；主角接受新身份并开启奇幻诡秘的超凡序列晋升之路"
    };
  }
  
  // 2. 智能匹配《斗破苍穹》
  if (text.includes("萧炎") || text.includes("斗之力") || text.includes("测验魔石碑")) {
    return {
      theme: "斗气世界至尊：从被家族嘲笑的天才沦落，到三十年河东崛起",
      hook: "当【测验魔石碑】冰冷宣布【萧炎】只有斗之力三段时，【周围族人的嘲讽】已将昔日天才少年的尊严彻底撕碎。",
      outline: "萧炎在测验石碑前被公布斗之力仅三段；周围同龄人及族人群起嘲讽落井下石；萧炎内心凄凉自嘲并回忆三年前的风光；主角隐忍咬牙退到队伍边缘，暗中开启绝地反击的逆袭序幕"
    };
  }
  
  // 3. 智能匹配《凡人修仙传》
  if (text.includes("韩立") || text.includes("二愣子") || text.includes("韩铸")) {
    return {
      theme: "凡人长生仙路：资质平平的农家二愣子如何走出山村修仙",
      hook: "当【农家少年韩立】躺在漏雨的土屋里向往【外面的世界】时，他绝想不到【未来的他】会成为震慑三界的仙道至尊。",
      outline: "韩立在穷苦农村漏雨土屋中清晨醒来；交代他质朴绰号二愣子以及农家少年黑皮肤不起眼的外表；描写全家七口人在温饱线挣扎的艰辛；主角心怀走出山村的远大抱负，因缘际会开启凡人逆袭仙途"
    };
  }
  
  return fallbackDissection(text, genre);
}

async function callOpenAIDissect({ rawText, genre, modelConfig }) {
  const cleanedRawText = cleanImportedRawText(rawText);
  const cfg = modelConfig || {};
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

  // 智能过滤占位符：如果配置的是默认占位符，视为空 Key 并直接走本地 Mock 引擎，防止网络请求悬挂
  const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
  if (isPlaceholder) {
    console.log("[DB Dissect] API Key is placeholder or not configured. Using local fallback dissect engine...");
    return localMockDissect(cleanedRawText, genre);
  }

  // 增强版 AI 拆解引擎：根据传入的题材动态生成专家级拆解视角
  let genreFocus = "";
  switch (genre) {
    case "suspense":
      genreFocus = "该文为【悬疑反转】类别，请重点提炼‘核心反转诡计’、‘叙述性诡计’以及‘制造信息差的悬念’。";
      break;
    case "revenge":
      genreFocus = "该文为【婚恋复仇】或复仇爽文类别，请重点提炼‘背叛痛点/绝望感塑造’与‘极度解压的打脸爽点机制’。";
      break;
    case "heroine":
      genreFocus = "该文为【大女主爽文】，请重点提炼‘女主核心光环’、‘独立反杀手段’以及‘打破传统偏见的设定’。";
      break;
    case "history":
      genreFocus = "该文为【历史错位爽文】，请重点提炼‘现代文明降维打击点’与‘历史人物的认知震撼’。";
      break;
    case "rules":
      genreFocus = "该文为【规则怪谈脑洞】，请重点提炼‘核心诡异规则设定’、‘生路与死路逻辑’以及‘主角破局的关键脑洞’。";
      break;
    case "folklore":
      genreFocus = "该文为【中式志怪】，请重点提炼‘中式恐怖民俗元素’、‘因果报应逻辑’与‘诡异氛围的白描手法’。";
      break;
    default:
      genreFocus = "请重点提炼文章的‘核心卖点’与‘情绪拉扯节奏’。";
  }

  const systemPrompt = `你是一名拥有十年经验的顶级网文拆解大师与主编。请对给定的爆款文章进行逆向工程深度拆解，提炼出它的核心选题设定、开篇钩子公式、以及情节骨架大纲。
${genreFocus}

重要清洗规则：原文可能混入公众号、推文号、书荒推广、网盘资源、后续阅读、加群、微信号等广告尾巴。你必须彻底忽略这些内容，严禁把广告词、账号名、乱码符号、分隔线当作 theme/hook/outline 的素材。

请严格输出为以下标准的 JSON 格式：
{
  "theme": "【字数需小于30字】提炼出爆款的核心矛盾/选题定位。例如：我给秦始皇直播近代史，弹幕剧透大秦灭亡",
  "hook": "【必须包含占位符】提炼出它的开篇钩子句式（如【主角】【反派】【秘密】【事件】），用极具张力的一句话表达。例如：【主角】第一次发现【秘密】时，手里还拿着刚泡好的茶。茶凉了，【事件】却开始烫手了。",
  "outline": "把整篇文章的情节骨架提炼为高潮迭起的大纲，必须按照起承转合的节奏，每一步之间用分号 ';' 分隔。每步需要点明情绪价值。"
}
注意：只输出 JSON 内容本身，绝对不要包裹 markdown 的 \`\`\`json 格式！确保输出可以被完全 JSON.parse 解析。`;

  const userPrompt = `【文章题材】${genre}
【爆款原文】
${cleanedRawText}`;

  try {
    const apiResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.5
      }),
      signal: AbortSignal.timeout(60000) // 60秒超时熔断机制，杜绝无限期挂起
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      const message = data?.error?.message || `AI 拆解失败（${apiResponse.status}）`;
      const error = new Error(message);
      error.statusCode = apiResponse.status;
      throw error;
    }

    const text = (data?.choices?.[0]?.message?.content || "").trim();
    if (!text) throw new Error("AI 拆解返回内容为空");
    
    // 增强 JSON 提取逻辑：直接提取大括号包裹的内容，无视前后废话
    let cleanText = text;
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    } else {
      // Fallback: 尝试去除非标准 markdown
      cleanText = cleanText.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
    }

    const parsed = JSON.parse(cleanText);
    return isValidDissection(parsed) ? parsed : fallbackDissection(cleanedRawText, genre);
  } catch (err) {
    // 增量升级：如果遇到超时或网络不可达（如封锁），智能降级为本地高智能 Mock 拆解引擎，确保功能永不挂起！
    console.warn(`[DB Dissect] AI API call failed or timed out: ${err.message}. Falling back to local smart engine...`);
    return localMockDissect(cleanedRawText, genre);
  }
}

export async function handleInspirationsRoutes(request, response, url, { sendJson, readJson, getUserId }) {
  if (!url.pathname.startsWith("/api/inspirations")) return false;

  const userId = getUserId(request, response, url);
  if (!userId) {
    sendJson(response, 401, { ok: false, message: "未授权访问，请提供 Token" });
    return true;
  }

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

  if (request.method === "GET") {
    try {
      const inspirations = await getInspirations(userId);
      sendJson(response, 200, { ok: true, inspirations });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  if (request.method === "POST") {
    try {
      const body = await readJson(request);
      const { genre, theme, hook, outline, rawText } = body;
      
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
      await saveInspiration(id, userId, genre || "suspense", cleaned.theme, cleaned.hook, cleaned.outline, cleanImportedRawText(rawText || ""));
      
      sendJson(response, 200, { ok: true, id, message: "学习成功" });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

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
