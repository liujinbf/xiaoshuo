import {
  getUserNovels, saveNovel, deleteNovel,
  saveChapterEmbedding, deleteChapterEmbeddings
} from "../utils/db.js";
import crypto from "node:crypto";
import {
  buildChapterSystemPrompt,
  buildChapterUserPrompt,
  buildChapterMemoryPrompt,
  buildChapterPolishSystemPrompt,
  buildChapterPolishUserPrompt,
  buildOutlineStep1Prompt,
  buildOutlineStep2Prompt,
  buildCharacterGenPrompt
} from "../utils/prompts.js";
import { fetchEmbedding, cosineSimilarity, extractChatText } from "../utils/vector.js";
import { retrieveKnowledgeForDraft, retrieveHotTrendsForDraft } from "../utils/knowledge-retrieval.js";
import { retrieveSubjectKnowledge } from "../utils/knowledge-retrieval-service.js";


const getChatUrl = (baseUrl) => {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
};


function parseChapterMemory(rawText) {
  const raw = String(rawText || "").trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const data = JSON.parse(raw);
    return {
      summary: String(data.summary || "").trim().slice(0, 220),
      openThreads: Array.isArray(data.openThreads) ? data.openThreads.map(String).slice(0, 3) : [],
      newFacts: Array.isArray(data.newFacts) ? data.newFacts.map(String).slice(0, 3) : [],
      characterUpdates: Array.isArray(data.characterUpdates) ? data.characterUpdates.map(String).slice(0, 4) : [],
      continuityChecks: Array.isArray(data.continuityChecks) ? data.continuityChecks.map(String).slice(0, 3) : [],
      nextHook: String(data.nextHook || "").trim().slice(0, 120)
    };
  } catch {
    return {
      summary: raw.slice(0, 220),
      openThreads: [],
      newFacts: [],
      characterUpdates: [],
      continuityChecks: [],
      nextHook: ""
    };
  }
}

function formatMemoryForRecall(chapter) {
  const memory = chapter.memory || {};
  const parts = [memory.summary || chapter.summary].filter(Boolean);
  if (Array.isArray(memory.openThreads) && memory.openThreads.length) {
    parts.push(`伏笔：${memory.openThreads.join("；")}`);
  }
  if (Array.isArray(memory.characterUpdates) && memory.characterUpdates.length) {
    parts.push(`人物：${memory.characterUpdates.join("；")}`);
  }
  if (memory.nextHook) parts.push(`钩子：${memory.nextHook}`);
  return parts.join("；");
}

async function polishChapterContent({ baseUrl, apiKey, modelName, chapterContent }) {
  try {
    const polishRes = await fetch(getChatUrl(baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: buildChapterPolishSystemPrompt() },
          { role: "user", content: buildChapterPolishUserPrompt(chapterContent) }
        ],
        max_tokens: 4200,
        temperature: 0.55
      }),
      signal: AbortSignal.timeout(35000)
    });
    const polishData = await polishRes.json();
    if (!polishRes.ok) return chapterContent;
    const polished = extractChatText(polishData);
    return polished || chapterContent;
  } catch {
    return chapterContent;
  }
}

/**
 * 提取章节摘要结构化记忆
 * @returns {Promise<{memory: object, summary: string}>}
 */
async function extractChapterMemory({ baseUrl, apiKey, modelName, chapterContent }) {
  try {
    const sumRes = await fetch(getChatUrl(baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: buildChapterMemoryPrompt() },
          { role: "user", content: chapterContent }
        ],
        max_tokens: 600,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(25000)
    });
    const sumData = await sumRes.json();
    const memory = parseChapterMemory(extractChatText(sumData));
    return { memory, summary: memory.summary };
  } catch {
    return { memory: null, summary: "" };
  }
}


function localMockOutline(params) {
  const { title, genre, targetChapters = 10, brainstorm = "", matchedTrends = [] } = params;
  
  // 提取首个爆款书名
  let refBook = "我以凡人之躯逆天改命";
  if (matchedTrends.length > 0) {
    refBook = matchedTrends[0].novel_title.replace(/[《》]+/g, "");
  }

  // 1. 拟定第一步：核心设定 (Step 1 Result)
  const isHistory = genre.includes("历史") || genre === "history";
  
  let setting = "";
  let chapterOutlines = "";

  if (isHistory) {
    setting = `## 一、核心创意
参考爆款《${refBook}》后，本作将现代科技图纸和国运直播投射到古代，朱元璋等古人通过天幕观看现代工业，从而开启了强烈的时代割裂感与科技降维打击。

## 二、故事简介
现代青年李明无意间将直播画面投射到了贞观十七年的大明宫/洪武朝太极殿。朱元璋和文武百官被迫观看现代工业母机、杂交水稻的制造全过程。李明利用信息差，与古代帝王展开了跨越时空的国运博弈，最终帮助华夏大航海时代提前五百年爆发。

## 三、核心冲突
关陇门阀/传统勋贵死守利益，指责天幕直播为妖言惑众；而朱元璋为强化皇权、强盛国力，誓要通过天幕获取全部现代技术，新旧势力围绕“未来技术”展开殊死对抗。

## 四、三幕结构
- 第一幕：天幕突降，朱元璋惊睹大明覆灭惨状，李明首次连线，投下杂交水稻图纸。
- 第二幕：勋贵联合百官绝食逼宫，称水稻是妖术；李明开启工业直播，现场炼钢打脸，朱元璋铁腕大清洗。
- 第三幕：大明神机营装备现代火器，远洋巨轮起航，门阀彻底灰飞烟灭，神华盛世永存。

## 五、爽点清单
1. 第1章：朱元璋亲眼目睹崇祯上吊，天幕降下工业图纸！
2. 第2章：朝堂百官弹劾水稻是妖术，朱元璋怒斩造谣御史！
3. 第3章：现代高炉炼铁技术曝光，大明精钢产量暴涨十倍！
4. 第5章：朱元璋御驾亲征，用现代火药降维打击塞外敌军！

## 六、伏笔设计
1. 崇祯上吊的绳子 → 第1章埋下朱元璋的心魔 → 第8章朱元璋御笔改写大明历法时回收。`;

    // 2. 拟定第二步：章节大纲 (Step 2 Result)
    const episodes = [];
    for (let i = 1; i <= targetChapters; i++) {
      if (i === 1) {
        episodes.push(`## 第1章：暴君朱元璋目睹崇祯上吊，我连夜递上工业图纸
- 核心事件：1.太极殿上空突然出现神秘天幕，朱元璋亲眼目睹大明末代皇帝在煤山上吊 2.百官惊恐大乱，怒斥此为妖邪 3.主角李明在天幕的另一端，缓缓扔下第一份工业高炉炼铁与水稻图纸
- 出场人物：朱元璋（震怒心惊）、胡惟庸（惶恐暗算）、李明（高深莫测）
- 本章爽点：对古代帝王的国运剧透与降维科学大震撼，逼格拉满
- 本章伏笔：胡惟庸眼神里的异样闪烁，暗示他私藏了半张图纸残页
- 结尾钩子：朱元璋指着天幕上的图纸，声音嘶哑下令：“来人，把制造这天铁的人，封为国师！若敢怠慢，诛九族！”`);
      } else if (i === 2) {
        episodes.push(`## 第2章：满朝文武的吃人弹劾，朱元璋血染太极殿
- 核心事件：1.胡惟庸联合满朝儒臣绝食逼宫，弹劾天幕图纸是蛊惑人心的妖术 2.主角在天幕中直播展示现代工业高纯度钢刀砍断大明祖传神兵 3.朱元璋暴怒，当场大开杀戒
- 出场人物：朱元璋（杀伐决断）、李明（冷眼旁观）、胡惟庸（阴谋败露）
- 本章爽点：朝堂当场断刀打脸，贪官儒生被血腥清洗，极度舒适
- 本章伏笔：李明注意到天幕背后的电量提示，预示直播有能量限制
- 结尾钩子：朱元璋手提滴血的御剑，冷冷看着瘫软在地的百官：“还有谁，觉得这钢刀是妖法？”`);
      } else if (i === 3) {
        episodes.push(`## 第3章：神农稻谷现世，勋贵集团的绝户计
- 核心事件：1.主角李明利用天幕向灾区投放大批现代杂交水稻种子 2.江南勋贵地主为了维持高粮价，暗中派人放火烧毁官仓种子 3.主角提前通过卫星监控对朱元璋进行画面同步
- 出场人物：朱清章（杀意滔天）、李明（运筹帷幄）、地主死士
- 本章爽点：利用卫星天眼降维打击纵火死士，让地主集团当场崩溃
- 本章伏笔：江南沈家的幕后现身，引出更大的海禁冲突
- 结尾钩子：朱元璋看着屏幕里正在偷偷倒煤油的死士，狞笑道：“老天保佑，沈家这回自己把九族送上了断头台。”`);
      } else {
        episodes.push(`## 第${i}章：参考爆款【${refBook}】的惊天逆袭
- 核心事件：1.李明在天幕中揭开古代大洋彼岸的财富版图，开启大航海时代 2.朱元璋御笔钦点远洋舰队，胡惟庸等残余势力勾结倭寇试图拦截 3.神机营装备高精度燧发枪列阵迎敌
- 出场人物：朱元璋、李明、胡惟庸
- 本章爽点：热兵器对冷兵器的降维平推，海权与皇权的绝对收割
- 本章伏笔：远洋船队发现新大陆的标志矿石
- 结尾钩子：随着万炮齐鸣，大明龙旗在巨舰桅杆上迎风高扬，宣告一个全新纪元的降临。`);
      }
    }
    chapterOutlines = episodes.join("\n\n");
  } else {
    // 现代都市/世情家庭/复仇题材
    setting = `## 一、核心创意
参考爆款《${refBook}》的情绪撕扯和悬念后置节奏，本作聚焦于“三十万拆迁款被私吞”的家庭背叛，主角隐忍反击，在婚礼现场亮出笔迹鉴定与指纹原件，完成合法痛快的自我拯救。

## 二、故事简介
李小歌无意中发现父母联合妹妹李雅雅，伪造自己的签名领走了属于自己的三十万老屋拆迁款，甚至逼迫自己为妹妹的豪门婚礼做八十六万的垫款担保。李小歌没有歇斯底里，而是暗中走访银行和中介，搜集齐全笔迹鉴定与转账原件，在除夕婚礼家宴上当众打脸，依法送虚荣的妹妹与偏心的父母接受制裁。

## 三、核心冲突
偏心父母视“牺牲姐姐偏袒妹妹”为天理，甚至用亲情绑架作为剥削的筹码；而主角李小歌坚决用法治与清醒的冷酷，拿回本属于自己的一切。

## 四、三幕结构
- 第一幕：婚礼前夕，主角撞破母亲让其背负八十六万账单的密谋，发现三十万拆迁款已被冒领。
- 第二幕：主角隐忍不发，暗中联系鉴定机构做笔迹鉴定；老中介被林姨用钱封口倒戈，主角陷入危机。
- 第三幕：妹妹得意宣布将主角赶出家门，主角在家宴婚礼现场带律师法警入场，甩出鉴定报告与银行铁证，送妹妹入狱。

## 五、爽点清单
1. 第1章：主角撞破全家吃人算盘，拿到八十六万垫付确认单！
2. 第2章：林姨当众道德绑架，主角冷笑收起账单暗中录音！
3. 第3章：拿走银行冒签原件，前往司法中心做笔迹鉴定！
4. 第5章：除夕大宴，妹妹高高在上，主角带着传票和法警踢馆！

## 六、伏笔设计
1. 泛黄的磨损旧账本 → 第1章埋下李小歌的财务贡献证明 → 第6章作为法庭财产审计铁证回收。`;

    const episodes = [];
    for (let i = 1; i <= targetChapters; i++) {
      if (i === 1) {
        episodes.push(`## 第1章：不速之客的婚礼账单，全家人的吃人算盘
- 核心事件：1.李小歌在妹妹婚礼前夕来到酒店，意外被前台塞了一张八十六万的垫付账单 2.撞破母亲林姨和妹妹的密谋，得知父母早已暗中模仿自己的签名，领走了自己名下的三十万老宅拆迁款 3.小歌冷静地录下音频，并收起账单
- 出场人物：李小歌（决绝清醒）、林姨（市侩偏心）、李雅雅（虚荣骄横）
- 本章爽点：主角当场撞破阴谋，没有无脑争吵而是录音保留证据，极度智商在线
- 本章伏笔：林姨手中的老旧账本，记录了多年来克扣李小歌存款的明细
- 结尾钩子：林姨突然伸出涂满红色指甲油的手，面目扭曲地朝我扑过来：“李小歌！把你手里的单子还给我！今天要是雅雅的婚礼砸了，我死给你看！”`);
      } else if (i === 2) {
        episodes.push(`## 第2章：一家人的吃人算盘，我冷眼看小人得志
- 核心事件：1.父亲李大国出面和稀泥，试图以“大家庭的面子”逼迫小歌当场签字垫付 2.李雅雅一身名牌，冷嘲热讽姐姐小歌“穷酸计较” 3.小歌顺水推舟没有当场翻脸，而是暗中将银行卡限额降为零
- 出场人物：李小歌、李大国（软弱偏心）、李雅雅
- 本章爽点：主角以退为进，暗中操作降额让反派的信用卡当众刷卡失败，尴尬至极
- 本章伏笔：李雅雅脖子上的那条假南洋珍珠项链，暗示她所谓的豪门婆家是个假空壳
- 结尾钩子：李雅雅满脸笑容地把我的信用卡递给前台，两秒钟后，前台神色微妙地抬起头：“不好意思，李小姐，这张卡……额度不足，支付失败。”`);
      } else if (i === 3) {
        episodes.push(`## 第3章：被收买的证人，老屋拆迁里的致命猫腻
- 核心事件：1.小歌前往拆迁办调取当年的签名底单，发现经办人老陈神色慌张 2.得知林姨早已花了两万元买通老陈，试图销毁原件 3.小歌利用法律警告老陈作伪证的代价，成功拿走关键指纹原件
- 出场人物：李小歌、老陈（胆小动摇）
- 本章爽点：逻辑碾压，法治降维打击收买的证人，顺利取得核心物证
- 本章伏笔：老陈无意中提到的当年签字笔，是专门的“消色笔”
- 结尾钩子：老陈哆哆嗦嗦地从铁皮柜最深处掏出一张压扁的牛皮信封，低声求饶：“李小姐，我只是一时糊涂……这是你妈当年签字的按手印原件，你千万别报警！”`);
      } else {
        episodes.push(`## 第${i}章：参考爆款【${refBook}】的惊天逆袭
- 核心事件：1.在妹妹的大婚宴席上，主角李小歌在众人瞩目下走上主席台 2.当众展示假签名笔迹司法鉴定意见书和林姨亲口承认冒签的录音 3.法警直接入场将妹妹李雅雅和林姨带走调查
- 出场人物：李小歌、李雅雅、林姨、法警
- 本章爽点：婚礼秒变庭审现场，全家在豪门婆家和众亲友面前面子踩在地上，爽快反击
- 本章伏笔：追回的三十万拆迁款用于购买主角梦寐以求的写字楼首付
- 结尾钩子：警车鸣笛渐行渐远，我转过身，迎着冬日里难得的暖阳，第一次觉得连空气都是甜的。`);
      }
    }
    chapterOutlines = episodes.join("\n\n");
  }

  return { setting, chapterOutlines };
}


export async function handleNovelRoutes(request, response, url, helpers) {
  const { sendJson, readJson, getUserId, fetchEmbedding, cosineSimilarity } = helpers;

  // GET /api/novels - 获取用户的小说列表
  if (url.pathname === "/api/novels" && request.method === "GET") {
    const userId = getUserId(request, {}, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    const novels = await getUserNovels(userId);
    sendJson(response, 200, { ok: true, novels });
    return true;
  }

  // POST /api/novels - 创建小说
  if (url.pathname === "/api/novels" && request.method === "POST") {
    const payload = await readJson(request);
    const userId = getUserId(request, payload, url);
    if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
    
    const novel = {
      id: `NV${crypto.randomUUID()}`,
      userId,
      title: String(payload.title || "未命名小说").trim(),
      genre: String(payload.genre || "悬疑反转").trim(),
      outline: String(payload.outline || "").trim(),
      characters: String(payload.characters || "").trim(),
      targetChapters: Math.min(100, Math.max(1, Number(payload.targetChapters) || 10)),
      chapterLength: [1500, 2000, 3000].includes(Number(payload.chapterLength))
        ? Number(payload.chapterLength) : 2000,
      chapters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveNovel(userId, novel);
    sendJson(response, 200, { ok: true, novel });
    return true;
  }

  // DELETE & PUT /api/novels/:id
  const novelIdMatch = url.pathname.match(/^\/api\/novels\/([^/]+)$/);
  if (novelIdMatch) {
    const novelId = novelIdMatch[1];
    if (request.method === "DELETE") {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
      
      await deleteNovel(userId, novelId);
      // 联动清理向量嵌入，防止孤儿数据累积
      await deleteChapterEmbeddings(novelId).catch(() => {});
      sendJson(response, 200, { ok: true });
      return true;
    } else if (request.method === "PUT") {
      try {
        const payload = await readJson(request);
        const userId = getUserId(request, payload, url);
        if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }

        const userNovels = await getUserNovels(userId);
        const novel = userNovels.find(n => n.id === novelId);
        if (!novel) { sendJson(response, 404, { ok: false, message: "小说不存在" }); return true; }

        // 更新字段
        if (payload.outline !== undefined) novel.outline = String(payload.outline || "").trim();
        if (payload.characters !== undefined) novel.characters = String(payload.characters || "").trim();
        if (payload.title !== undefined) novel.title = String(payload.title || "").trim();
        if (payload.genre !== undefined) novel.genre = String(payload.genre || "").trim();
        
        novel.updatedAt = new Date().toISOString();
        await saveNovel(userId, novel);

        sendJson(response, 200, { ok: true, novel, message: "更新成功" });
      } catch (error) {
        sendJson(response, 500, { ok: false, message: error.message });
      }
      return true;
    }
  }

  // ─── POST /api/novels/:id/characters/generate — AI 自动生成人物设定（v4.0）───
  const genCharMatch = url.pathname.match(/^\/api\/novels\/([^/]+)\/characters\/generate$/);
  if (genCharMatch && request.method === "POST") {
    const novelId = genCharMatch[1];
    try {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }

      const cfg = payload.modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
      if (!apiKey) { sendJson(response, 412, { ok: false, message: "缺少 API Key" }); return true; }

      const userNovels = await getUserNovels(userId);
      const novel = userNovels.find(n => n.id === novelId);
      if (!novel) { sendJson(response, 404, { ok: false, message: "小说不存在" }); return true; }

      const charRes = await fetch(getChatUrl(baseUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: buildCharacterGenPrompt({
            title: novel.title,
            genre: novel.genre,
            style: payload.style || "",
            brainstorm: payload.brainstorm || "",
            characterCount: payload.characterCount || {}
          }) }],
          max_tokens: 5000,
          temperature: 0.9   // 人物创意最高
        }),
        signal: AbortSignal.timeout(90000)
      });
      const charData = await charRes.json();
      if (!charRes.ok) throw new Error(charData?.error?.message || "人物生成失败");
      const characters = extractChatText(charData);

      // 将生成的人物设定存回小说记录
      novel.generatedCharacters = characters;
      novel.updatedAt = new Date().toISOString();
      await saveNovel(userId, novel);

      sendJson(response, 200, { ok: true, characters, message: "人物设定生成完成" });
    } catch (error) {
      console.error("[API Generate Characters Error] Detailed stack trace:", error);
      sendJson(response, error.statusCode || 500, { ok: false, message: error.message });
    }
    return true;
  }

  // ─── POST /api/novels/:id/outline/generate — 两步大纲生成（🆕）───
  const genOutlineMatch = url.pathname.match(/^\/api\/novels\/([^/]+)\/outline\/generate$/);
  if (genOutlineMatch && request.method === "POST") {
    const novelId = genOutlineMatch[1];
    try {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }

      const cfg = payload.modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
      if (!apiKey) { sendJson(response, 412, { ok: false, message: "缺少 API Key" }); return true; }

      const userNovels = await getUserNovels(userId);
      const novel = userNovels.find(n => n.id === novelId);
      if (!novel) { sendJson(response, 404, { ok: false, message: "小说不存在" }); return true; }

      // 🆕 召回同品类的最新全网爆款趋势，供起名与大纲悬念设置参考
      const genreEnMap = {
        "悬疑反转": "suspense",
        "婚恋复仇": "revenge",
        "大女主爽文": "heroine",
        "世情家庭": "family",
        "中式志怪": "folklore",
        "历史错位爽文": "history",
        "规则怪谈脑洞": "rules",
        "职场内幕": "workplace"
      };
      const mappedGenre = genreEnMap[novel.genre] || novel.genre;
      const matchedTrends = await retrieveHotTrendsForDraft({
        genre: mappedGenre,
        limit: 3
      });

      // 🆕 召回学科百科常识，并执行检测与联网自动扩增
      const searchSubjectText = `${novel.title} ${payload.brainstorm || novel.outline || ""} ${novel.characters || ""}`;
      const matchedSubjectKnowledge = await retrieveSubjectKnowledge({
        text: searchSubjectText,
        limit: 3,
        modelConfig: payload.modelConfig
      });

      const params = {
        title: novel.title,
        genre: novel.genre,
        targetChapters: novel.targetChapters || 10,
        chapterLength: novel.chapterLength || 2000,
        brainstorm: payload.brainstorm || novel.outline || "",
        characters: novel.characters || novel.generatedCharacters || "",
        matchedTrends, // 注入爆款趋势案例
        matchedSubjectKnowledge // 🆕 注入百科常识
      };

      // 🆕 检测是否为占位符 API Key，若是则进行本地高仿真沙箱降级
      const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
      if (isPlaceholder) {
        const { setting, chapterOutlines } = localMockOutline(params);
        novel.generatedSetting = setting;
        novel.generatedOutline = chapterOutlines;
        novel.updatedAt = new Date().toISOString();
        await saveNovel(userId, novel);

        sendJson(response, 200, {
          ok: true,
          setting,
          chapterOutlines,
          message: "（本地沙箱模拟成功）大纲生成完成，请确认后复制到小说大纲字段"
        });
        return true;
      }

      // 第一步：核心设定（temperature 0.85，创意优先）
      const step1Res = await fetch(getChatUrl(baseUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: buildOutlineStep1Prompt(params) }],
          max_tokens: 3000,
          temperature: 0.85
        }),
        signal: AbortSignal.timeout(60000)
      });
      const step1Data = await step1Res.json();
      if (!step1Res.ok) throw new Error(step1Data?.error?.message || "第一步大纲生成失败");
      const step1Result = extractChatText(step1Data);

      // 第二步：章节大纲（temperature 0.7，结构优先）
      const step2Res = await fetch(getChatUrl(baseUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: buildOutlineStep2Prompt(params, step1Result) }],
          max_tokens: 4000,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(90000)
      });
      const step2Data = await step2Res.json();
      if (!step2Res.ok) throw new Error(step2Data?.error?.message || "第二步大纲生成失败");
      const step2Result = extractChatText(step2Data);

      // 把生成的大纲存回小说记录
      novel.generatedSetting = step1Result;
      novel.generatedOutline = step2Result;
      novel.updatedAt = new Date().toISOString();
      await saveNovel(userId, novel);

      sendJson(response, 200, {
        ok: true,
        setting: step1Result,
        chapterOutlines: step2Result,
        message: "大纲生成完成，请确认后复制到小说大纲字段"
      });
    } catch (error) {
      console.error("[API Generate Outline Error] Detailed stack trace:", error);
      sendJson(response, error.statusCode || 500, { ok: false, message: error.message });
    }
    return true;
  }

  // POST /api/novels/:id/chapters/generate - 生成下一章
  const genChapterMatch = url.pathname.match(/^\/api\/novels\/([^/]+)\/chapters\/generate$/);
  if (genChapterMatch && request.method === "POST") {
    const novelId = genChapterMatch[1];
    try {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "请先登录" }); return true; }
      
      const userNovels = await getUserNovels(userId);
      const novel = userNovels.find((n) => n.id === novelId);
      if (!novel) { sendJson(response, 404, { ok: false, message: "小说不存在" }); return true; }

      // 解析模型配置
      const cfg = payload.modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
      if (!apiKey) { sendJson(response, 412, { ok: false, message: "缺少 API Key，请在模型配置面板填写" }); return true; }

      // --- 1. 向量记忆召回（从独立表读取） ---
      let relevantMemory = "";
      if (novel.chapters.length >= 2) {
        try {
          const { getChapterEmbeddings } = await import("../utils/db.js");
          const allEmbeddings = await getChapterEmbeddings(novel.id);
          const embMap = Object.fromEntries(allEmbeddings.map(e => [e.chapterIndex, e.embedding]));
          const lastChapter = novel.chapters[novel.chapters.length - 1];
          const lastEmb = embMap[lastChapter.index];
          if (lastEmb) {
            const scoredChapters = novel.chapters
              .slice(0, -1)
              .map(ch => ({
                chapter: ch,
                score: cosineSimilarity(lastEmb, embMap[ch.index])
              }))
              .filter(item => item.score > 0.6)
              .sort((a, b) => b.score - a.score)
              .slice(0, 2);
            if (scoredChapters.length > 0) {
              relevantMemory = scoredChapters.map(sc => `第${sc.chapter.index}章：${formatMemoryForRecall(sc.chapter)}`).join("\n");
            }
          }
        } catch { /* 容错，向量召回不阻断生成 */ }
      }

      // --- 1.5 召回本地素材库策略 (RAG) ---
      const genreEnMap = {
        "悬疑反转": "suspense",
        "婚恋复仇": "revenge",
        "大女主爽文": "heroine",
        "世情家庭": "family",
        "中式志怪": "folklore",
        "历史错位爽文": "history",
        "规则怪谈脑洞": "rules",
        "职场内幕": "workplace"
      };
      const matchedInspirations = await retrieveKnowledgeForDraft({
        userId,
        limit: 5,
        input: {
          genre: genreEnMap[novel.genre] || novel.genre,
          title: novel.title,
          theme: novel.outline,
          notes: novel.characters,
          tags: []
        }
      });

      // --- 1.6 召回学科公开知识库 (历史、物理、化学等) ---
      const combinedText = `${novel.title} ${novel.outline} ${novel.characters}`;
      const matchedSubjectKnowledge = await retrieveSubjectKnowledge({
        text: combinedText,
        limit: 3
      });

      // --- 2. 生成章节正文 ---
      const contentRes = await fetch(getChatUrl(baseUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: buildChapterSystemPrompt() },
            { role: "user", content: buildChapterUserPrompt(novel, relevantMemory, matchedInspirations, matchedSubjectKnowledge) }
          ],
          max_tokens: 4000,
          temperature: 0.88,
          frequency_penalty: 0.3,
          presence_penalty: 0.1
        }),
        signal: AbortSignal.timeout(60000)
      });
      const contentData = await contentRes.json();
      if (!contentRes.ok) throw new Error(extractChatText(contentData) || contentData?.error?.message || `AI 请求失败（${contentRes.status}）`);
      let chapterContent = extractChatText(contentData);
      if (!chapterContent) throw new Error("AI 返回内容为空");

      // --- 3. 润色 + 摘要提取 并行执行 ---
      const [polishedContent, { memory, summary }] = await Promise.all([
        polishChapterContent({ baseUrl, apiKey, modelName, chapterContent }),
        extractChapterMemory({ baseUrl, apiKey, modelName, chapterContent })
      ]);
      chapterContent = polishedContent;
      const finalMemory = memory || { summary, openThreads: [], newFacts: [], characterUpdates: [], continuityChecks: [], nextHook: "" };

      // --- 4. 生成并单独存储嵌入向量 ---
      if (summary) {
        fetchEmbedding(summary, baseUrl, apiKey).then(emb => {
          if (emb) saveChapterEmbedding(novel.id, novel.chapters.length + 1, emb).catch(() => {});
        }).catch(() => {});
      }

      const chapter = {
        index: novel.chapters.length + 1,
        content: chapterContent,
        summary,
        memory: finalMemory,
        // summaryEmbedding 已迁移至 chapter_embeddings 表，不再存入 JSON
        wordCount: chapterContent.replace(/\s/g, "").length,
        createdAt: new Date().toISOString()
      };
      novel.chapters.push(chapter);
      novel.updatedAt = new Date().toISOString();
      await saveNovel(userId, novel);
      sendJson(response, 200, { ok: true, chapter, novel });
    } catch (error) {
      console.error("[API Generate Chapter Error] Detailed stack trace:", error);
      sendJson(response, error.statusCode || 500, { ok: false, message: error.message || "生成失败" });
    }
    return true;
  }

  return false;
}
