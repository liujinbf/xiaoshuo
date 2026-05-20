// ⚠️ 本文件已超过建议行数，请在下次功能迭代时拆分
// ============================================================
// 模块: draft-prompts.js — 正文生成 Prompt 构建器与 AI 调用
// ============================================================

function extractChatText(data) {
  return (data?.choices?.[0]?.message?.content || "").trim();
}

export function buildSystemPrompt() {
  return [
    "你是一名中文短篇故事主编，专长是知乎盐选、盐言故事风格的商业短篇。",
    "写作目标：强开篇钩子、现实情绪、清晰反转、人物动机可信、适合移动端阅读。",
    "必须像真人作者写一场正在发生的戏：有地点、人物动作、对话、证据、即时目标和因果推进。",
    "【去 AI 味硬规则】",
    "1. 禁止复述标题、复述用户的一句话概述，禁止把设定改写成旁白说明。",
    "2. 禁止使用“事情发生在”“那时我还不知道”“真正的局”“只是一个幌子”“三个月前就已经开始”等模板句。",
    "3. 禁止总结和说教，结尾只能停在动作、证据、台词或新的反常事实上。",
    "4. 每段只写一个动作、一个发现或一次对话推进；少用抽象词，多写可看见的细节。",
    "5. 人物关系必须自洽：谁在场、谁说话、谁施压、主角为什么不能立刻走，都要让读者读得明白。",
    "6. 禁止输出“以下是”“正文如下”“创作思路”等提示语，只输出正文。"
  ].join("\n");
}

function buildGenreWritingRules(input = {}) {
  const common = [
    "【通用剧情硬规则】",
    "1. 前 120 字必须进入一个具体场景，不要先解释背景。",
    "2. 第一幕必须完成：压力出现 → 主角看见异常证据 → 主角做出一个小反应。",
    "3. 后续每 2-3 段必须有新信息，不能连续写心理活动或概括性叙述。",
    "4. 如果是一人称，所有信息必须来自“我”能看见、听见、拿到的东西。"
  ];
  const genreMap = {
    history: [
      "【历史错位爽文硬规则】",
      "开篇 300 字内必须出现历史人物名、现代信息差和一个可验证危机。",
      "场景必须清楚：现代端和古代端如何连接必须写明，不能混成同一空间。",
      "历史资料必须剧情化，用追问、质疑、验证和失态反应呈现，不要百科罗列。"
    ],
    rules: [
      "【规则怪谈硬规则】",
      "开篇 100 字内必须出现异常规则、代价或不可删除的物件。",
      "规则必须立刻产生后果，不能只做氛围。"
    ],
    family: [
      "【世情家庭硬规则】",
      "冲突必须落在餐桌、病房、婚礼、房产、账本、聊天记录等现实载体上。",
      "不能只写“他们偏心”，必须写出一句伤人的话、一笔不公平的钱或一个被默认牺牲的安排。",
      "主角第一场不要大段复盘，先让读者看见家人如何逼她让步。"
    ],
    revenge: [
      "【婚恋复仇硬规则】",
      "证据必须具体到截图、录音、转账、病历或合同，不能只写“我知道真相”。",
      "对抗者要有现实压迫：钱、名声、孩子、房子、工作或亲友舆论。"
    ],
    suspense: [
      "【悬疑反转硬规则】",
      "每个异常都要对应可追查的物证，不要只靠梦、预感或旁白吓人。",
      "第一章只揭开第一层问题，保留一个更大的矛盾。"
    ]
  };
  return [...common, ...(genreMap[input.genre] || [])].join("\n");
}

function buildSceneBlueprint(input = {}) {
  const theme = input.theme || "核心事件";
  const title = input.title || "未命名故事";
  const notes = input.notes ? `可用细节：${input.notes}` : "可用细节：从现实物件里选择一个证据载体。";
  const genreScene = {
    family: "建议场景：婚礼前厅、年夜饭餐桌、病房走廊、房产中介办公室、家族微信群。",
    revenge: "建议场景：民政局门口、婚房客厅、酒店走廊、公司会议室。",
    suspense: "建议场景：旧手机维修店、医院太平间门口、派出所接警台、监控室。",
    heroine: "建议场景：董事会、签约现场、公开酒会、项目汇报室。",
    workplace: "建议场景：深夜办公室、会议室、审计现场、主管工位。",
    folklore: "建议场景：祖祠、雨夜村口、旧宅堂屋、河边祭台。",
    history: "建议场景：朝堂、军帐、天幕前、现代直播控制台。",
    rules: "建议场景：电梯、宿舍门口、便利店、废弃办公楼。"
  };
  return [
    "【本次正文先写清楚的场景蓝图】",
    `故事标题：${title}`,
    `核心事件：${theme}`,
    input.topic ? `主题表达：${input.topic}` : "",
    notes,
    genreScene[input.genre] || "建议场景：一个能直接承载冲突和证据的现实地点。",
    "开篇必须回答：主角此刻在哪里？眼前谁在逼她？桌上/手机里/门口出现了什么证据？她当场做了什么？",
    "不要解释完整背景，只写这一场戏如何把主角逼到必须反击。"
  ].filter(Boolean).join("\n");
}

function buildDraftPolishSystemPrompt(input = {}) {
  return [
    "你是一名盐言故事资深编辑。请把初稿改成更自然、更连贯的正文。",
    "必须保留原故事设定、主要人物、核心冲突和结尾钩子，不要改题材，不要写点评。",
    "重点删除：模板开头、复述标题、解释腔、总结腔、空泛心理描写、无因果跳跃。",
    buildGenreWritingRules(input),
    "直接输出修改后的正文。"
  ].join("\n");
}

function buildDraftPolishUserPrompt(input = {}, text = "") {
  return [
    "请按以下标准编辑正文：",
    "1. 前 300 字必须是连续场景，不能像设定简介。",
    "2. 补足人物关系和动作因果，让每一段都能接上上一段。",
    "3. 删除“事情发生在”“真正的局”“只是一个幌子”等模板句。",
    "4. 不要反复说主角知道很多，必须写出她拿到了什么证据、如何验证。",
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
        temperature: 0.42
      }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await polishResponse.json();
    if (!polishResponse.ok) return text;
    return extractChatText(data) || text;
  } catch {
    return text;
  }
}

export function buildUserPrompt(payload) {
  const modeText = {
    draft: "请基于以下创作方案，写 1200 到 1800 字的短篇第一章开篇正文。只写一个连续事件，不写完整故事梗概。",
    rewrite: `请按“${payload.direction || "更强反转"}”方向续写 500 到 800 字。要求不重复前文，不解释设定，用具体行动推进冲突。`,
    polish: "请润色以下正文，让语言更像高转化短篇故事，保留原剧情事实但增强钩子、台词和反转力度。"
  };
  const inspirationSection = [];
  if (Array.isArray(payload.matchedInspirations) && payload.matchedInspirations.length > 0) {
    inspirationSection.push("\n【可参考的知识库节奏】");
    payload.matchedInspirations.slice(0, 3).forEach((ins, idx) => {
      inspirationSection.push(`参考 ${idx + 1}：${ins.theme}`);
      inspirationSection.push(`- 钩子：${ins.hook}`);
      inspirationSection.push(`- 节奏：${ins.outline}`);
    });
    inspirationSection.push("只学习其开篇冲突密度和白描节奏，禁止借用广告、人物名、原剧情和原句。");
  }

  return [
    modeText[payload.mode] || modeText.draft,
    buildGenreWritingRules(payload.input),
    buildSceneBlueprint(payload.input),
    inspirationSection.join("\n"),
    "",
    "【创作参数】",
    JSON.stringify(payload.input || {}, null, 2),
    "",
    "【已有方案】",
    payload.prompt || "",
    "",
    payload.existingDraft ? `【已有正文】\n${payload.existingDraft}` : "",
    "",
    "【输出自检】写完后自行检查但不要输出检查过程：",
    "1. 第一段是否进入具体场景？",
    "2. 每段是否和上一段有因果关系？",
    "3. 是否误用了模板句或复述标题？如果有，必须改掉。"
  ].join("\n");
}

function localMockGenerate(payload) {
  const input = payload.input || {};
  const theme = input.theme || "家里人逼我让步";
  const place = input.genre === "family" ? "酒店化妆间外" : "门口";
  const proof = input.genre === "family" ? "母亲那本旧账本" : "手机里的录音";
  const title = input.title || theme;
  return [
    `《${title}》`,
    "",
    `我站在${place}，听见我妈隔着门说：“先别让她进来，今天不能闹。”`,
    "",
    `门缝里漏出一点暖黄的灯。里面很热闹，妹妹的伴娘在笑，司仪一遍遍确认流程。只有我手里的${proof}，冷得像刚从冰水里捞出来。`,
    "",
    `十分钟前，我还以为自己只是来参加婚礼。直到酒店前台把一张欠款确认单递给我，上面写着我的名字，金额八十六万。用途那一栏只有四个字：婚礼垫付。`,
    "",
    `我给我妈打电话，她没接。给我爸打，他只回了一条消息：“都是一家人，你先签了，回头再说。”`,
    "",
    `我低头看着那行字，忽然笑了。原来他们所谓的一家人，是妹妹负责体面，我负责还钱。`,
    "",
    `门从里面打开时，我妈脸上的笑还没收住。她看见我手里的单子，第一反应不是解释，而是伸手来抢。`,
    "",
    `我后退一步，把账本举到摄像师镜头前：“妈，今天人齐。你要不要当着大家的面，说说这笔钱为什么写我的名字？”`
  ].join("\n");
}

export async function callOpenAI(payload) {
  const cfg = payload.modelConfig || {};
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
  const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
  if (isPlaceholder) return localMockGenerate(payload);

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
      temperature: 0.58
    }),
    signal: AbortSignal.timeout(120000)
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
