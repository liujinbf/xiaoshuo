// ============================================================
// 模块: server/utils/prompts.js — AI Prompt 构建器 + API 调用
// 单文件行数上限: 250 行
// ============================================================

// 解析 OpenAI chat/completions 响应
function extractChatText(data) {
  return (data?.choices?.[0]?.message?.content || "").trim();
}

export function buildSystemPrompt() {
  return [
    "你是一名中文短篇故事主编，专长是知乎盐选、盐言故事风格的商业短篇。",
    "写作目标：强开篇钩子、现实情绪、清晰反转、人物动机可信、适合移动端阅读。",
    "【去 AI 味核心指令】（必须严格遵守）：",
    "1. 禁用 AI 常用虚词：禁止使用“总之”、“不可否认”、“然而”、“在这座繁华的城市里”、“随着时间的推移”、“仿佛命运的齿轮”、“不仅...而且”、“令人深思”等空泛词汇。",
    "2. 禁用说教与总结：结尾禁止做任何道德升华、人生哲理总结或回顾前文，用人物的具体动作或对话直接切断。",
    "3. 句式要求：使用口语化表达，多用短句和动词，减少长定语和形容词堆砌，拒绝翻译腔。",
    "禁止直接复制任何现有平台作品；只生成原创内容。",
    "不要输出解释，不要输出创作方法，只输出可直接放进工具结果区的正文内容。"
  ].join("\n");
}

function buildGenreWritingRules(input = {}) {
  if (input.genre === "history") {
    return [
      "【历史错位爽文硬规则】",
      "1. 开篇 300 字内必须出现历史人物名、现代信息差和一个可验证危机；禁止慢热解释项目背景。",
      "2. 第一段禁止使用“事情发生在……”“那时我还不知道……”“真正的局……”等模板句。",
      "3. 禁止把标题或核心矛盾原样塞进正文，例如不要写“给秦始皇直播近代史只是一个幌子”。",
      "4. 场景必须清楚：如果是天幕直播，就写清楚主角在现代端、古人在朝堂端；不要把会议室和秦朝桌案混成同一空间。",
      "5. 历史资料必须剧情化：不要整段百科罗列，用秦始皇追问、臣子反应、赵高失态来呈现。",
      "6. 弹幕最多出现 3 组，每组最多 3 条；弹幕必须推动紧张感，禁止无意义玩梗。",
      "7. 本篇第一章只解决一个爽点：历史人物第一次相信天幕，并开始验证关键人物或制度死局。"
    ].join("\n");
  }
  if (input.genre === "rules") {
    return [
      "【规则怪谈脑洞硬规则】",
      "1. 开篇 100 字内必须出现异常规则、代价或不可删除的物件。",
      "2. 规则不能只做氛围，必须在本段剧情里立刻造成后果。",
      "3. 禁止解释世界观超过 3 句，优先用动作和错误选择呈现。"
    ].join("\n");
  }
  return "";
}

// 连载章节生成的 System Prompt
export function buildChapterSystemPrompt() {
  return [
    "你是一名网文创作大师，专长是知乎盐选风格的商业短篇连载。",
    "写作目标：强开篇钩子、现实情绪、人物动机可信、每章结尾必有悬念或反转。",
    "【去 AI 味核心指令】（必须严格遵守）：",
    "1. 禁用 AI 常用虚词：禁止使用“总之”、“不可否认”、“然而”、“在这座繁华的城市里”、“随着时间的推移”、“仿佛命运的齿轮”等空泛词汇。",
    "2. 禁用说教与总结：每章结尾绝对不能出现对当前章节的回顾总结，禁止道德升华，必须用一句反常的台词或动作制造悬念直接断章。",
    "3. 句式要求：使用口语化第一人称（或第三人称视角限制），多用白描，拒绝书面语感太强的词汇堆砌。",
    "禁止直接复制现有平台作品；只生成原创内容。",
    "不要输出任何提示语或说明，直接输出可用的正文。"
  ].join("\n");
}

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

export function buildChapterUserPrompt(novel, relevantMemory = "", matchedInspirations = []) {
  const idx = novel.chapters.length + 1;
  const lastChapter = novel.chapters[novel.chapters.length - 1];
  const lastSummary = lastChapter
    ? formatChapterMemory(lastChapter)
    : "第一章，暂无前情提要，请直接开局。";
  const memorySection = relevantMemory ? `\n【相关历史记忆】\n${relevantMemory}` : "";
  const chapterMission = lastChapter?.memory?.nextHook
    ? `承接上一章钩子“${lastChapter.memory.nextHook}”，不要重讲背景，直接处理这处悬念。`
    : "本章必须完成一个明确事件：调查、对峙、试探、反击或暴露，不写散文化过渡。";

  const inspirationSection = [];
  if (Array.isArray(matchedInspirations) && matchedInspirations.length > 0) {
    inspirationSection.push("\n【可参考的已学爆款写作风格与黄金开篇】");
    matchedInspirations.slice(0, 3).forEach((ins, idx) => {
      inspirationSection.push(`模版 ${idx + 1}：`);
      inspirationSection.push(`- 选题核心矛盾：${ins.theme}`);
      inspirationSection.push(`- 黄金开篇钩子句式：${ins.hook}`);
      if (ins.raw_text) {
        inspirationSection.push(`- 黄金模仿语段（参考其情绪张力、语言节奏与大白话叙事，不要生搬硬套剧情）：\n${ins.raw_text.slice(0, 600)}...`);
      }
      inspirationSection.push("");
    });
    inspirationSection.push("特别提示：如果这是第一章，请模仿上述爆款模版的开篇钩子写法，前三句迅速切入冲突；如果是后续章节，请参考上述语段的白描手法与强烈的对峙节奏进行叙事！\n");
  }

  return [
    `《${novel.title}》第 ${idx} 章`,
    `【故事类型】${novel.genre}`,
    `【核心大纲】${novel.outline}`,
    `【人物志】${novel.characters}`,
    `【前情提要】${lastSummary}${memorySection}`,
    `【本章任务】${chapterMission}`,
    "",
    `请直接创作第 ${idx} 章正文，要求：`,
    "1. 前三句必须制造强烈悬念或冲突，吸引读者继续阅读。",
    "2. 【去AI味】：使用口语化第一人称叙事（知乎盐选风格），多用短句和白描，严禁出现“总之”、“不得不说”、“在这座城市”等 AI 翻译腔词汇。",
    `3. 字数控制在 ${novel.chapterLength || 2000} 字左右。`,
    "4. 中段必须出现一次信息变化：新证据、新证词、人物立场反转或规则代价升级。",
    "5. 结尾必须用人物的具体动作或一句意外的台词直接断章，绝对禁止添加任何总结性结尾或心理升华！",
    "6. 直接输出正文，不要带有任何提示语。"
  ].join("\n");
}

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
    '  "nextHook": "下一章必须承接的一句话钩子"',
    "}"
  ].join("\n");
}

export function buildChapterPolishSystemPrompt() {
  return [
    "你是一名中文网文编辑，只负责把章节正文改得更自然、更像人工编辑后的盐言故事。",
    "必须保留原剧情事实、人物关系、伏笔、结尾悬念，不得改写主线走向。",
    "重点处理：删掉总结性发言、解释腔、翻译腔、空泛形容词；让段落长短错落，台词更短，动作更具体。",
    "禁止添加“以下是”“本章”“总结”“由此可见”等提示语或点评。",
    "直接输出润色后的正文。"
  ].join("\n");
}

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
      return `【第 ${i + 1} 场】\n场景：写字楼/走廊  时间：夜\n[画面] 角色神色紧张，快步走过，脚步声在空旷走廊回荡。\n旁白：${l.slice(0, 50)}...\n主角：“我们没时间了，快走！”`;
    }).join("\n\n");
  } else {
    scriptContent = `【第 1 场】\n场景：神秘密室  时间：夜\n[画面] 烛光摇曳，主角缓缓睁开眼，发现双手被缚。\n神秘人：“你终于醒了，游戏现在正式开始。”`;
  }
  
  return `（已自动启用本地高仿真短剧分镜转化模拟器）\n\n《${title}》第 ${chapter} 章 黄金分镜脚本\n\n${scriptContent}`;
}

export async function callOpenAIForScript(payload) {
  const cfg = payload.modelConfig || {};
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

  const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
  if (isPlaceholder) {
    return localMockScript(payload);
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: buildScriptSystemPrompt() },
        { role: "user", content: buildScriptUserPrompt(payload) }
      ],
      temperature: 0.65
    }),
    signal: AbortSignal.timeout(25000) // 25秒超时防挂起
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "AI 请求失败");
  return extractChatText(data);
}

function buildDraftPolishSystemPrompt(input = {}) {
  const genreRules = buildGenreWritingRules(input);
  return [
    "你是一名盐言故事资深编辑。请把 AI 初稿改成更适合读者继续读的正文。",
    "必须保留原故事设定、主要人物、核心冲突和结尾钩子，不要改题材，不要写点评。",
    "重点删除：模板开头、解释腔、总结腔、百科式资料罗列、无意义弹幕、空泛心理描写。",
    genreRules,
    "直接输出修改后的正文。"
  ].filter(Boolean).join("\n");
}

function buildDraftPolishUserPrompt(input = {}, text = "") {
  return [
    "请按以下标准编辑正文：",
    "1. 前 300 字必须先给冲突场面，不要先解释背景。",
    "2. 主角身份和场景关系必须清楚，读者不能困惑主角在哪里、用什么和对方连接。",
    "3. 所有资料信息都要通过人物反应、追问、证据展示来呈现，不要像百科摘要。",
    "4. 段落长短错落，台词短一点，动作具体一点。",
    "5. 结尾停在一个新问题、动作或台词上。",
    "",
    `【题材】${input.genre || ""}`,
    `【核心矛盾】${input.theme || ""}`,
    "",
    "【待编辑正文】",
    text
  ].join("\n");
}

async function polishGeneratedDraft({ baseUrl, apiKey, modelName, payload, text }) {
  if (payload.mode === "polish") return text;
  try {
    const polishResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: buildDraftPolishSystemPrompt(payload.input) },
          { role: "user", content: buildDraftPolishUserPrompt(payload.input, text) }
        ],
        max_tokens: payload.mode === "rewrite" ? 1300 : 2800,
        temperature: 0.55
      }),
      signal: AbortSignal.timeout(20000) // 20秒超时防挂起
    });
    const data = await polishResponse.json();
    if (!polishResponse.ok) return text;
    const polished = extractChatText(data);
    return polished || text;
  } catch {
    return text;
  }
}

export function buildUserPrompt(payload) {
  const modeText = {
    draft: "请基于以下创作方案，写一段 1200 到 1800 字的短篇开篇正文。要求第一段直接抛出冲突，后续逐步揭示证据和人物关系。",
    rewrite: `请按“${payload.direction || "更强反转"}”方向续写 500 到 800 字。要求不重复前文，不解释设定，用具体行动推进冲突。`,
    polish: "请润色以下故事方案，让语言更像高转化短篇故事，保留原结构但增强钩子、台词和反转力度。"
  };

  const inspirationSection = [];
  if (Array.isArray(payload.matchedInspirations) && payload.matchedInspirations.length > 0) {
    inspirationSection.push("\n【重点参考：已学智能匹配爆款模版】");
    payload.matchedInspirations.slice(0, 3).forEach((ins, idx) => {
      inspirationSection.push(`模版 ${idx + 1}：`);
      inspirationSection.push(`- 选题核心矛盾：${ins.theme}`);
      inspirationSection.push(`- 黄金开篇钩子公式：${ins.hook}`);
      inspirationSection.push(`- 情节骨架节奏：${ins.outline}`);
      if (ins.raw_text) {
        inspirationSection.push(`- 写作风格与句式模仿片段（仅供语言张力和白描写法参考，不要抄袭剧情）：\n${ins.raw_text.slice(0, 600)}...`);
      }
      inspirationSection.push("");
    });
    inspirationSection.push("请在满足【创作参数】的前提下，深度模仿和借用上述已学模版在“开篇强制造冲突”、“去AI说教说理”以及“白描快速切入”方面的写作技巧，提升正文的水准！\n");
  }

  return [
    modeText[payload.mode] || modeText.draft,
    buildGenreWritingRules(payload.input),
    inspirationSection.join("\n"),
    "",
    "【创作参数】",
    JSON.stringify(payload.input || {}, null, 2),
    "",
    "【已有方案】",
    payload.prompt || "",
    "",
    payload.existingDraft ? `【已有正文】\n${payload.existingDraft}` : ""
  ].join("\n");
}

function localMockGenerate(payload) {
  const input = payload.input || {};
  const theme = input.theme || "我的爆款故事";
  const genre = input.genre || "suspense";
  const matched = payload.matchedInspirations || [];
  
  let content = "";
  if (matched.length > 0 && matched[0].raw_text) {
    let baseText = matched[0].raw_text;
    if (Array.isArray(input.tags) && input.tags.length > 0) {
      baseText = baseText.replace(/主角/g, input.tags[0]);
    }
    content = baseText;
  } else {
    content = `【本地高仿真生成器模拟结果】\n\n大雾笼罩了整条街道，街灯忽明忽暗。\n我捏紧了手中的黑色皮夹，呼吸略微急促。这是规则生效的第三天，如果规则是真，那么当十二点钟声响起时，我就必须踏入那扇门。\n“咔哒。”身后的门锁突然动了一下，门缝里溢出幽暗的红光……`;
  }
  
  return `（系统检测到您尚未配置真实 API Key，已自动为您启用本地高仿真创作模拟器，参考匹配模版：${matched.map(m => m.theme).join("、") || "系统预置"}）\n\n《${theme}》正文：\n\n${content}`;
}

export async function callOpenAI(payload) {
  // 优先使用请求携带的客户端配置，其次回退到环境变量
  const cfg = payload.modelConfig || {};
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

  const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
  if (isPlaceholder) {
    return localMockGenerate(payload);
  }

  const apiResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(payload) }
      ],
      max_tokens: payload.mode === "rewrite" ? 1200 : 2600,
      temperature: 0.75
    }),
    signal: AbortSignal.timeout(120000) // 120秒超时防挂起
  });

  const data = await apiResponse.json();
  if (!apiResponse.ok) {
    const message = data?.error?.message || `AI 请求失败（${apiResponse.status}）`;
    const error = new Error(message);
    error.statusCode = apiResponse.status;
    throw error;
  }

  const text = extractChatText(data);
  if (!text) throw new Error("AI 返回内容为空，请检查模型配置。");
  return polishGeneratedDraft({ baseUrl, apiKey, modelName, payload, text });
}
