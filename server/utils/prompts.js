// ⚠️ 本文件已超过建议行数，请在下次功能迭代时拆分
// ============================================================
// 模块: server/utils/prompts.js — AI Prompt 构建器 + API 调用
// 单文件行数上限: 250 行
// ============================================================

export { callOpenAI } from "./draft-prompts.js";

// 解析 OpenAI chat/completions 响应
function extractChatText(data) {
  return (data?.choices?.[0]?.message?.content || "").trim();
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
