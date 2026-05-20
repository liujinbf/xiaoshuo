// ============================================================
// 模块: server/utils/prompts.js — AI Prompt 构建器 + API 调用
// 升级 v2.0：两步大纲生成 + 指纹参数化注入 + 前文滑动窗口 + 强制断章
// ============================================================

export { callOpenAI } from "./draft-prompts.js";
import { extractChatText } from "./vector.js";
import { formatKnowledgeForPrompt } from "./knowledge-retrieval-service.js";


// ─── System Prompt ──────────────────────────────────────────
export function buildChapterSystemPrompt() {
  return [
    "你是一名网文创作大师，专长是知乎盐选风格的商业短篇连载。",
    "写作目标：强开篇钩子、现实情绪、人物动机可信、每章结尾必有悬念或反转。",
    "【去 AI 味核心指令】（必须严格遵守）：",
    "1. 禁用 AI 常用虚词：禁止使用'总之'、'不可否认'、'然而'、'在这座繁华的城市里'、'随着时间的推移'、'仿佛命运的齿轮'等空泛词汇。",
    "2. 禁用说教与总结：每章结尾绝对不能出现对当前章节的回顾总结，禁止道德升华，必须用一句反常的台词或动作制造悬念直接断章。",
    "3. 句式要求：使用口语化第一人称（或第三人称视角限制），多用白描，拒绝书面语感太强的词汇堆砌。",
    "禁止直接复制现有平台作品；只生成原创内容。",
    "不要输出任何提示语或说明，直接输出可用的正文。"
  ].join("\n");
}

// ─── 章节记忆格式化 ──────────────────────────────────────────
function formatChapterMemory(chapter) {
  const memory = chapter?.memory || {};
  const lines = [];
  if (memory.summary || chapter?.summary) lines.push(`核心转折：${memory.summary || chapter.summary}`);
  if (Array.isArray(memory.openThreads) && memory.openThreads.length) {
    lines.push(`未回收伏笔：${memory.openThreads.join("；")}`);
  }
  if (Array.isArray(memory.newFacts) && memory.newFacts.length) {
    lines.push(`新增事实：${memory.newFacts.join("；")}`);
  }
  if (Array.isArray(memory.characterUpdates) && memory.characterUpdates.length) {
    lines.push(`人物状态：${memory.characterUpdates.join("；")}`);
  }
  if (Array.isArray(memory.continuityChecks) && memory.continuityChecks.length) {
    lines.push(`连续性检查：${memory.continuityChecks.join("；")}`);
  }
  if (memory.nextHook) lines.push(`下一章钩子：${memory.nextHook}`);
  return lines.join("\n") || "暂无前情提要";
}

// ─── 章节生成 User Prompt（核心升级）──────────────────────────
export function buildChapterUserPrompt(novel, relevantMemory = "", matchedInspirations = [], matchedSubjectKnowledge = []) {
  const idx = novel.chapters.length + 1;
  const lastChapter = novel.chapters[novel.chapters.length - 1];
  const lastSummary = lastChapter
    ? formatChapterMemory(lastChapter)
    : "第一章，暂无前情提要，请直接开局。";
  const memorySection = relevantMemory ? `\n【相关历史记忆】\n${relevantMemory}` : "";

  // 🆕 前文滑动窗口：取前2章最后1000字（参考 Python 脚本方案）
  let slidingWindow = "";
  if (novel.chapters.length >= 1) {
    const combined = novel.chapters.slice(-2).map(c => c.content || "").join("\n\n");
    slidingWindow = combined.slice(-1000);
  }

  // 🆕 强制承接上一章钩子
  const chapterMission = lastChapter?.memory?.nextHook
    ? `【强制承接】上一章结尾钩子："${lastChapter.memory.nextHook}"。本章第一句必须直接处理这个悬念，不重讲背景。`
    : "本章必须完成一个明确事件：调查、对峙、试探、反击或暴露，不写散文化过渡。";

  // 🆕 指纹参数化风格注入（替代直接粘贴 hook 文本）
  const inspirationSection = [];
  if (Array.isArray(matchedInspirations) && matchedInspirations.length > 0) {
    inspirationSection.push("\n【爆款指纹库写作参数（必须遵守，禁止复制原书内容）】");
    matchedInspirations.slice(0, 2).forEach((ins, i) => {
      if (ins.strategyPrompt) {
        inspirationSection.push(`\n参考书 ${i + 1}：`);
        inspirationSection.push(ins.strategyPrompt);
      } else {
        inspirationSection.push(`\n参考风格 ${i + 1}：选题"${ins.theme}"，开篇参考：${ins.hook}`);
      }
    });
    inspirationSection.push("");
  }

  // 知识库常识约束
  const knowledgeSection = [];
  if (Array.isArray(matchedSubjectKnowledge) && matchedSubjectKnowledge.length > 0) {
    const constraint = formatKnowledgeForPrompt(matchedSubjectKnowledge);
    if (constraint) knowledgeSection.push(constraint);
  }

  // 🆕 随机切入角度（防止每章结构相同）
  const ANGLES = [
    "内心独白切入，用感受带动读者进入场景",
    "外部冲突切入，第一句就有人物动作或对话",
    "物件发现切入，从一件具体的东西打开场景",
    "时间压迫切入，让读者感受到紧迫感",
    "反差切入，用平静描写铺垫即将到来的爆发",
  ];
  const randomAngle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

  return [
    `《${novel.title}》第 ${idx} 章`,
    `【故事类型】${novel.genre}`,
    `【核心大纲】${novel.outline}`,
    knowledgeSection.join("\n"),
    `【人物志】${novel.characters}`,
    `【前情提要】${lastSummary}${memorySection}`,
    slidingWindow ? `\n【前文衔接段落（直接续写，不要重复）】\n${slidingWindow}` : "",
    inspirationSection.join("\n"),
    `【本章任务】${chapterMission}`,
    `【本章切入角度建议】${randomAngle}`,
    "",
    `请直接创作第 ${idx} 章正文，要求：`,
    "1. 前三句制造强烈悬念或冲突，不解释背景。",
    "2. 口语化叙事（知乎盐选风格），多用短句与白描，严禁'总之'、'不得不说'、'命运的齿轮'等 AI 腔。",
    `3. 字数控制在 ${novel.chapterLength || 2000} 字左右。`,
    "4. 中段必须出现一次信息变化：新证据、新证词、人物立场反转或规则代价升级。",
    "5. 【强制断章】结尾必须是以下之一：①一个具体动作停住 ②出乎意料的一句台词 ③发现异常信息的瞬间。绝对禁止总结性结尾！",
    "6. 直接输出正文，不带任何提示语。"
  ].filter(Boolean).join("\n");
}

// ─── 章节记忆提取 Prompt ─────────────────────────────────────
export function buildChapterMemoryPrompt() {
  return [
    "你是连载剧情记忆整理器。请只输出 JSON，不要 Markdown，不要解释。",
    "从本章中提炼下一章创作需要的记忆，字段如下：",
    "{",
    '  "summary": "100字以内核心剧情转折",',
    '  "openThreads": ["尚未回收的伏笔或悬念，最多3条"],',
    '  "newFacts": ["本章新增事实/人物关系/关键证据，最多3条"],',
    '  "characterUpdates": ["已出场人物的新状态、立场或关系变化，最多4条"],',
    '  "continuityChecks": ["下一章必须保持一致的设定、时间线或因果，最多3条"],',
    '  "nextHook": "下一章必须承接的一句话钩子（必须具体，禁止泛泛而谈）"',
    "}"
  ].join("\n");
}

// ─── 润色 System Prompt ───────────────────────────────────────
export function buildChapterPolishSystemPrompt() {
  return [
    "你是一名中文网文编辑，只负责把章节正文改得更自然、更像人工编辑后的盐言故事。",
    "必须保留原剧情事实、人物关系、伏笔、结尾悬念，不得改写主线走向。",
    "重点处理：删掉总结性发言、解释腔、翻译腔、空泛形容词；让段落长短错落，台词更短，动作更具体。",
    "禁止添加'以下是''本章''总结''由此可见'等提示语或点评。",
    "直接输出润色后的正文。"
  ].join("\n");
}

// ─── 润色 User Prompt ─────────────────────────────────────────
export function buildChapterPolishUserPrompt(chapterContent) {
  return [
    "请对下面章节做二次编辑润色，要求：",
    "1. 前三句必须保留强钩子，不要慢热解释背景。",
    "2. 删除或改写明显 AI 腔：总之、不得不说、命运的齿轮、随着时间推移、在这座城市里、令人深思。",
    "3. 每段尽量只承载一个动作、一个发现或一句关键台词，移动端阅读要轻。",
    "4. 结尾停在动作或台词上，不要做心理总结和主题升华。",
    "",
    "【待润色正文】",
    chapterContent
  ].join("\n");
}

// ─── 人物设定生成 Prompt（v4.0 新增）────────────────────────────

/**
 * 自动生成立体人物设定
 * 对应 Python v4.0 的 generate_characters()，temperature 0.9
 */
export function buildCharacterGenPrompt(params) {
  const { title, genre, style, brainstorm, characterCount = {} } = params;
  const protagonist = characterCount.protagonist ?? 1;
  const maleLead   = characterCount.male_lead   ?? 1;
  const villain    = characterCount.villain      ?? 1;
  const supporting = characterCount.supporting   ?? 2;
  return `你是一位顶级网文人物策划师，专精商业化爽文角色设计。

【任务】为以下小说设计完整的人物体系
书名：${title}
类型：${genre}
风格：${style || "知乎盐选短篇"}
故事核心创意：${brainstorm || "暂无，请发挥创意设计有张力的人物关系"}

【需要设计的人物】
- 女主角：${protagonist}人
- 男主角：${maleLead}人
- 反派：${villain}人
- 重要配角：${supporting}人

【每个人物必须包含】
1. 基本信息：姓名、年龄、外貌（要具体，有画面感）
2. 性格特点：至少3个正面特质 + 2个负面特质
3. 背景故事：家庭背景、成长经历、核心创伤
4. 核心目标：短期目标 → 长期目标
5. 人物弧线：开始状态 → 经历转变 → 最终状态
6. 口头禅：1-2句标志性台词
7. 致命弱点：会被反派利用的弱点
8. 与其他人物的关系：至少关联2位其他人物

【设计原则】
- 人物之间必须有强冲突、强羁绊
- 反派不要脸谱化，要有自己的动机和苦衷
- 配角也要有独立的故事线，不只是工具人
- 人物名字好听、符合性格人设

【输出格式（Markdown）】

## 🎭 女主角：[姓名]
- 外貌：[具体描写]
- 性格：[正面x3 + 负面x2]
- 背景：[家庭 + 成长经历 + 核心创伤]
- 目标：[短期] → [长期]
- 弧线：[开始] → [转变] → [最后]
- 口头禅：[1-2句]
- 弱点：[致命弱点]
- 关系：[与其他人的关系]

## 🎭 男主角：[姓名]
（以此类推，输出全部人物，每个都要饱满立体）

直接输出，不要有任何说明或前言。`;
}

// ─── 两步大纲 Prompt（核心功能）────────────────────────────────

/**
 * 第一步：生成核心设定（人物 + 三幕结构 + 爽点清单）
 */
export function buildOutlineStep1Prompt(params) {
  const { title, genre, targetChapters, chapterLength, brainstorm, characters } = params;
  const totalWords = targetChapters * chapterLength;
  return `你是一位顶级网文策划编辑，精通商业化爽文结构。

【任务】为一部网络小说生成核心设定和整体框架。

【基本信息】
书名：${title}
类型：${genre}
预计章节：${targetChapters} 章，每章约 ${chapterLength} 字（共约 ${totalWords} 字）
初步想法：${brainstorm || "暂时没有，请你大胆创意"}
${characters ? `
【已有人物设定（请基于此创作，不要改动姓名和弧线）】
${characters}` : ""}

【要求】请用 Markdown 格式输出以下内容：

## 一、核心创意
一句话概括小说核心卖点（爽点 + 冲突 + 身份设定）

## 二、故事简介
300字以内，含开场困境、核心矛盾、结局走向

## 三、核心冲突
主要矛盾是什么？对抗双方的利益为何无法调和？

## 四、三幕结构
- 第一幕（前25%）：开场困境 → 冲突引爆 → 主角被迫行动
- 第二幕（25-75%）：步步升级 → 主角受挫 → 关键反转
- 第三幕（后25%）：决战准备 → 最终对决 → 结局收尾

## 五、爽点清单（至少15个，层层递进）
按出场顺序排列，每个爽点注明大概在第几章触发

## 六、伏笔设计（至少5个）
格式：伏笔内容 → 在哪里埋下 → 在哪里回收

语言专业清晰，避免废话，直接输出。`;
}

/**
 * 第二步：基于第一步设定，生成每章详细大纲（含强制结尾钩子）
 */
export function buildOutlineStep2Prompt(params, step1Result) {
  const { targetChapters, chapterLength, characters } = params;
  return `你是一位网文章节规划师。基于以下核心设定，生成 ${targetChapters} 章的详细章节大纲。

【核心设定】
${step1Result}
${characters ? `
【人物设定（写章节时人物行为须与此一致）】
${characters.slice(0, 800)}` : ""}

【章节规划要求】
- 每章约 ${chapterLength} 字
- 每 3 章一个小高潮，每 10 章一个大高潮
- 伏笔在前 1/3 埋下，后 2/3 回收
- 感情线和主线并行推进，人物要有成长弧线
- 每章结尾必须有强钩子，不能平淡收尾

【输出格式（严格遵守，每章6行要素）】

## 第1章：[章节标题]
- 核心事件：1.[事件1] 2.[事件2] 3.[事件3]
- 出场人物：[人物列表及各自的行动]
- 本章爽点：[具体的情绪爆发点]
- 本章伏笔：[埋下什么伏笔，或回收哪条伏笔]
- 结尾钩子：[用一句具体台词或动作断章，禁止写'留下悬念'这种废话]

## 第2章：[章节标题]
...

严格按格式输出全部 ${targetChapters} 章，不要省略任何章节。`;
}

// ─── 短剧脚本 Prompt ─────────────────────────────────────────
export function buildScriptSystemPrompt() {
  return [
    "你是一名资深短剧编剧，专长是将小说正文转化为高冲突、快节奏的分镜脚本。",
    "脚本格式要求：",
    "1. 【场景】：明确环境（如：张家客厅、雨夜巷口）和时间（日/夜）。",
    "2. 【画面】：动作描述要具体、视觉化，少用形容词，多用动词。禁止心理描写，所有情绪必须通过动作、眼神或道具呈现。",
    "3. 【台词】：短小精悍，带有情绪张力，拒绝废话。格式为：人物名：台词内容。",
    "4. 【悬念】：每场结束必须留有视觉钩子。",
    "直接输出脚本内容，不要带有任何提示词或总结。"
  ].join("\n");
}

export function buildScriptUserPrompt(payload) {
  return [
    `请将以下小说章节转化为短剧脚本。`,
    `小说标题：${payload.novelTitle || "未命名"}`,
    `章节：第 ${payload.chapterIndex || 1} 章`,
    "",
    "【小说正文】",
    payload.content,
    "",
    "请直接输出脚本，格式参考：",
    "【第 X 场】",
    "场景：室内/室外  时间：日/夜",
    "[画面] 描述具体动作",
    "人物名：台词内容"
  ].join("\n");
}

function localMockScript(payload) {
  const title = payload.novelTitle || "未命名";
  const chapter = payload.chapterIndex || 1;
  const content = payload.content || "";
  const lines = content.split(/[\n\r]+/).filter(l => l.trim().length > 10).slice(0, 5);
  let scriptContent = "";
  if (lines.length > 0) {
    scriptContent = lines.map((l, i) => {
      return `【第 ${i + 1} 场】\n场景：写字楼/走廊  时间：夜\n[画面] 角色神色紧张，快步走过，脚步声在空旷走廊回荡。\n旁白：${l.slice(0, 50)}...\n主角："我们没时间了，快走！"`;
    }).join("\n\n");
  } else {
    scriptContent = `【第 1 场】\n场景：神秘密室  时间：夜\n[画面] 烛光摇曳，主角缓缓睁开眼，发现双手被缚。\n神秘人："你终于醒了，游戏现在正式开始。"`;
  }
  return `（已自动启用本地高仿真短剧分镜转化模拟器）\n\n《${title}》第 ${chapter} 章 黄金分镜脚本\n\n${scriptContent}`;
}

export async function callOpenAIForScript(payload) {
  const cfg = payload.modelConfig || {};
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

  const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
  if (isPlaceholder) return localMockScript(payload);

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: buildScriptSystemPrompt() },
        { role: "user", content: buildScriptUserPrompt(payload) }
      ],
      temperature: 0.65
    }),
    signal: AbortSignal.timeout(25000)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "AI 请求失败");
  return extractChatText(data);
}
