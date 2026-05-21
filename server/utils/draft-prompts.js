// ============================================================
// 模块: draft-prompts.js — 正文生成 Prompt 构建器与 AI 调用
// ============================================================

import { assessDraftQuality } from "./draft-quality.js";
import { extractChatText } from "./vector.js";
import { formatKnowledgeForPrompt } from "./knowledge-retrieval-service.js";


const getChatUrl = (baseUrl) => {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
};



export function buildSystemPrompt(genreStats = null, mode = "draft") {
  if (mode === "plan") {
    return [
      "你是一名顶尖的网络小说及知乎盐选大纲架构大师。你的任务是根据用户给出的题材与创意，推演设计出结构极其严密、节奏极其抓人、商业价值极高的大纲与商业文案 JSON 方案。",
      "【极度严厉指令：严控字数，坚决防截断】",
      "1. 必须直接输出合法 JSON 字符串，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何解释性的前言后语。你的输出必须直接以 `{` 开始，以 `}` 结束，以便程序直接通过 JSON.parse 解析。",
      "2. 字数超限是绝不允许的红线！此 JSON 将被机器解析，若由于长篇大论导致超长，将被底层物理截断，从而引发整个系统崩溃！请用极度简练的短句概括，杜绝长文描述。",
      "3. 严格限制每个字段字数：每个候选标题限 10-18 字；首段开篇钩子限 90-120 字；五幕大纲每幕严格限制在 40-55 字内；主角/反派/配角的 motive 和 appearance 均必须严格在 35-50 字内；诊断分析限 70-100 字；故事大纲摘要（synopsis）限 90-120 字；推荐语限 50-70 字。",
      "4. 严禁在 JSON 方案中写出具体的故事对话或长段正文描述，只写精悍的大纲和设定框架！"
    ].join("\n");
  }

  if (mode && (mode.startsWith("world_") || mode === "world_infer")) {
    return [
      "你是一名顶尖的网络小说设定与大纲架构专家。你的任务是根据用户提供的信息，推演设计出一套逻辑严密、细节饱满且充满冲突张力的世界观/设定 JSON 数据。",
      "【极严格指令：控制字数，直接返回 JSON】",
      "1. 必须直接输出合法的 JSON 字符串/数组，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何解释性的前言后语。你的输出必须直接以 `{` 或 `[` 开始，以 `}` 或 `]` 结束。",
      "2. 语言必须字句精炼，严控字数，千万不要写成大段长篇大论的故事正文，杜绝啰嗦，防止截断！",
      "3. 严格遵循各个属性的特定限制与字数范围。"
    ].join("\n");
  }

  if (mode === "audit") {
    return [
      "你是一名高水准的中文短篇小说主编与深度诊断审计专家。你的任务是针对已有的正文和大纲方案，进行极其具体、专业、尖锐的文学诊断与逻辑分析。",
      "请直接给出具体的诊断建议（200-300字左右），指出哪里写得好、哪里存在逻辑断层以及具体该如何修改。请使用简洁、尖锐的段落结构进行输出，不需要任何多余的客套客气前言。"
    ].join("\n");
  }

  const base = [
    "你是一名中文短篇故事主编，专长是知乎盐选、盐言故事风格的商业短篇。",
    "写作目标：强开篇钩子、现实情绪、清晰反转、人物动机可信、适合移动端阅读。",
    "必须像真人作者写一场正在发生的戏：有地点、人物动作、对话、证据、即时目标和因果推进。",
    "【去 AI 味硬规则】",
    "1. 禁止复述标题、复述用户的一句话概述，禁止把设定改写成旁白说明。",
    "2. 禁止使用“事情发生在”“那时我还不知道”“真正的局”“只是一个幌子”“三个月前就已经开始”等套话。",
    "3. 禁止总结和说教，结尾只能停在动作、证据、台词或新的反常事实上。",
    "4. 每段只写一个动作、一个发现或一次对话推进；少用抽象词，多写可看见的细节。",
    "5. 人物关系必须自洽：谁在场、谁说话、谁施压、主角为什么不能立刻走。",
    "6. 禁止输出 any 提示语，只输出正文。"
  ];

  if (genreStats && genreStats.sampleCount >= 3) {
    base.push("");
    base.push(`【基于 ${genreStats.sampleCount} 本同类爆款书的统计风格参数（必须遵守）】`);
    if (genreStats.avgOpeningSpeed >= 4) {
      base.push(`开篇速度：该题材爆款平均第 ${genreStats.avgFirstConflictAt} 句出现冲突，必须在前 ${Math.ceil(Number(genreStats.avgFirstConflictAt) * 1.2)} 句内切入核心矛盾。`);
    }
    if (genreStats.avgDialogueRatio) {
      base.push(`对话比例：该题材爆款对话占比约 ${genreStats.avgDialogueRatio}%，请保持相近密度。`);
    }
    if (genreStats.dominantSentenceStyle) {
      const styleMap = {
        "极短句主导": "大量使用 5-10 字短句，制造阅读节奏感",
        "短长混合": "短句制造冲击感，长句铺垫情绪，错落有致",
        "长句为主": "绵密长句积累情绪，关键处用短句切断",
      };
      base.push(`句式风格：${styleMap[genreStats.dominantSentenceStyle] || genreStats.dominantSentenceStyle}`);
    }
    if (genreStats.dominantEndingHook) {
      const hookMap = {
        "动作断章": "结尾用一个具体动作停住，不要解释",
        "台词断章": "结尾用出乎意料的一句台词直接收笔",
        "发现断章": "结尾用发现异常信息的瞬间停住",
        "悬念留白": "结尾抛出一个问题，不给答案",
      };
      base.push(`断章方式：${hookMap[genreStats.dominantEndingHook] || hookMap[genreStats.dominantEndingHook]}`);
    }
    if (genreStats.powerPhrases && genreStats.powerPhrases.length > 0) {
      const sampled = [...genreStats.powerPhrases].sort(() => Math.random() - 0.5).slice(0, 3);
      base.push("\n参考爆款金句（学节奏和力度，绝不复制）：");
      sampled.forEach(p => base.push(`  「${p.slice(0, 80)}」`));
    }
  }

  return base.join("\n");
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
    genreScene[input.genre] || "建议场景：一个能直接承载冲突 and 证据的现实地点。",
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

export function localMockGenerate(payload) {
  if (payload.mode === "world_infer") {
    const input = payload.input || {};
    const isHistory = input.genre === "history" || (input.genre && input.genre.includes("历史"));
    if (isHistory) {
      return JSON.stringify({
        characters: [
          { name: "李世民", role: "protagonist", motive: "利用天幕展现的未来科技与历史轨迹改革科举、削弱关陇门阀，铸就永恒强唐。", appearance: "约莫不惑之年，身着亮金盘龙常服，面容英武，目光如炬，思索时右手总爱按着佩剑。" },
          { name: "武媚娘", role: "love", motive: "在冷酷的后宫博弈中求生，凭敏锐的嗅觉解析天幕所透露的未来，誓要摆脱悲惨宿命。", appearance: "二八年华，容貌倾国且有英武气，眼眸灵动狡黠，进退有度，语气谦恭温和。" },
          { name: "裴寂", role: "antagonist", motive: "死守关陇世家特权与土地，污蔑天幕为‘妖邪祸国’，百般阻挠变法，企图挟天子以令百官。", appearance: "发鬓斑白，身着华贵织金紫袍，身形佝偻，看似和蔼实则阴鸷，习惯手执玉如意。" },
          { name: "长孙无忌", role: "mentor", motive: "忠心辅佐李世民，但出于世家防范心，极力抵制武媚娘参与政事，主张温和削藩。", appearance: "中年儒雅，长须飘飘，身着素色宽袖大袍，言谈慢条斯理，眼神深邃不可测。" }
        ],
        worldview: {
          era: "唐代贞观盛世（架空历史错位）",
          location: "长安大明宫太极殿 / 现代天幕直播操控舱",
          society: "门阀世家垄断科举，朝野看似繁华，实则暗流汹涌。李世民求贤若渴，但受陇西李氏等关陇门阀的极力牵制。",
          special: "太极殿上空出现神秘的现代‘天幕直播’，古人通过天幕能看到未来大唐的兴衰及现代科技成果，内容实时影响古代历史进程。"
        },
        rules: [
          { type: "fact", content: "天幕只能在黄昏时段开启，每次播放约半个时辰的未来历史直播片段" },
          { type: "must", content: "李世民在看到武媚娘日后登基的预警后，必须在朝臣面前隐忍并采取分权防范措施，绝不能直接降旨诛杀" },
          { type: "cannot", content: "古代任何弓弩、火炮或玄学术法绝不能对高悬的天幕屏障造成丝毫物理磨损或干扰" }
        ],
        timeline: [
          { time: "贞观十七年春", event: "太极殿上空突然出现神秘天幕，震撼直播‘玄武门之变’未来因果，李世民惊骇下封锁皇宫。" },
          { time: "贞观十七年夏", event: "天幕揭示门阀与突厥勾结内幕，李世民顺水推舟削弱裴寂等关陇士族领袖。" },
          { time: "贞观十八年冬", event: "天幕剧透科举制强国科技，李世民宣布重设科举细则，招揽寒门学子对抗门阀世袭。" }
        ]
      });
    } else {
      return JSON.stringify({
        characters: [
          { name: "李小歌", role: "protagonist", motive: "依法夺回被原生家庭偏心侵占、被妹妹冒签领走的三十万老宅拆迁款，斩断吸血亲情枷锁。", appearance: "二十四岁左右，一头干净清爽的黑色齐耳短发，面容清秀冷峻，双眼冷静而决绝。" },
          { name: "李雅雅", role: "antagonist", motive: "极度虚荣自私，模仿姐姐签字冒领巨款，将钱用于购置名牌包与奢华婚礼，试图伪造豪门太太身份。", appearance: "浓妆艳抹，身披高定伴娘婚纱，穿金戴银，眼神骄横，习惯性抬高下巴冷嘲热讽。" },
          { name: "林姨", role: "antagonist", motive: "病态偏心小女儿李雅雅，用亲情绑架、撒泼哭闹等手段抢夺证据，替雅雅隐瞒非法冒领罪证。", appearance: "眼角爬满刻薄的皱纹，戴着雅雅买的假金项链，面对质问时常声嘶力竭地喊‘你别丢人现眼’。" },
          { name: "顾承泽", role: "love", motive: "作为有正义感的年轻律师，暗中协助李小歌搜集完整的银行底单及笔迹鉴定，为其提供专业法援。", appearance: "身材修长，戴着一副细框眼镜，穿着整洁的西装，言语清晰冷静，做事实事求是。" }
        ],
        worldview: {
          era: "二十一世纪现代都市（写实情绪风）",
          location: "江畔大酒店婚宴大厅 / 老城区待拆迁的顾家旧院",
          society: "典型都市工薪阶层与中产的利益碰撞。父母盲目护短，把‘顾全大局、偏袒妹妹’奉为铁律；主角则秉持现代独立的法治维权思维。",
          special: "老屋拆迁款冒名套现与巨额婚礼垫资流水是冲突的导火索。笔迹鉴定原件、转账银行底单将作为揭穿妹妹李雅雅伪装的决定性法治铁证。"
        },
        rules: [
          { type: "must", content: "主角面对原生家庭的道德逼迫必须始终保持清醒冷酷，绝对不能心软妥协" },
          { type: "cannot", content: "妹妹在面临司法介入和笔迹鉴定报告前，必须咬死说自己不知情，坚决否认私领行径" },
          { type: "fact", content: "转账给李雅雅的三十万拆迁款，必须附带清晰的银行回执单和假签名底单作为证据载体" }
        ],
        timeline: [
          { time: "老房拆迁前夕", event: "李雅雅伙同林姨，暗中模仿李小歌笔迹签字，悄悄划走本属于李小歌名下的三十万补偿金。" },
          { time: "婚礼当天现场", event: "李小歌在江畔五星大酒店后台揭破骗局，冷酷回应道德绑架，当众甩出银行底单 and 冒签流水。" },
          { time: "经侦立案宣判", event: "经笔迹与痕迹司法鉴定坐实冒领罪行，李雅雅和林姨被公诉法办，李小歌拿回款项释怀离场。" }
        ]
      });
    }
  }

  if (payload.mode === "world_worldview") {
    const input = payload.input || {};
    const isHistory = input.genre === "history" || (input.genre && input.genre.includes("历史"));
    if (isHistory) {
      return JSON.stringify({
        era: "唐代贞观盛世（架空历史错位）",
        location: "长安大明宫太极殿 / 现代天幕直播操控舱",
        society: "门阀世家垄断科举，朝野看似繁华，实则暗流汹涌。李世民求贤若渴，但受陇西李氏等关陇门阀的极力牵制。",
        special: "太极殿上空出现神秘的现代‘天幕直播’，古人通过天幕能看到未来大唐的兴衰及现代科技成果，内容实时影响古代历史进程。"
      });
    } else {
      return JSON.stringify({
        era: "二十一世纪现代都市（写实情绪风）",
        location: "江畔大酒店婚宴大厅 / 老城区待拆迁的顾家旧院",
        society: "典型都市工薪阶层与中产的利益碰撞。父母盲目护短，把‘顾全大局、偏袒妹妹’奉为铁律；主角则秉持现代独立的法治维权思维。",
        special: "老屋拆迁款冒名套现与巨额婚礼垫资流水是冲突的导火索。笔迹鉴定原件、转账银行底单将作为揭穿妹妹李雅雅伪装的决定性法治铁证。"
      });
    }
  }

  if (payload.mode === "world_character") {
    const input = payload.input || {};
    const isHistory = input.genre === "history" || (input.genre && input.genre.includes("历史"));
    if (isHistory) {
      return JSON.stringify([
        { name: "李世民", role: "protagonist", motive: "利用天幕展现的未来科技与历史轨迹改革科举、削弱关陇门阀，铸就永恒强唐。", appearance: "约莫不惑之年，身着亮金盘龙常服，面容英武，目光如炬，思索时右手总爱按着佩剑。" },
        { name: "武媚娘", role: "love", motive: "在冷酷的后宫博弈中求生，凭敏锐的嗅觉解析天幕所透露的未来，誓要摆脱悲惨宿命。", appearance: "二八年华，容貌倾国且有英武气，眼眸灵动狡黠，进退有度，语气谦恭温和。" },
        { name: "裴寂", role: "antagonist", motive: "死守关陇世家特权与土地，污蔑天幕为‘妖邪祸国’，百般阻挠变法，企图挟天子以令百官。", appearance: "发鬓斑白，身着华贵织金紫袍，身形佝偻，看似和蔼实则阴鸷，习惯手执玉如意。" }
      ]);
    } else {
      return JSON.stringify([
        { name: "李小歌", role: "protagonist", motive: "依法夺回被原生家庭偏心侵占、被妹妹冒签领走的三十万老宅拆迁款，斩断吸血亲情枷锁。", appearance: "二十四岁左右，一头干净清爽的黑色齐耳短发，面容清秀冷峻，双眼冷静而决绝。" },
        { name: "李雅雅", role: "antagonist", motive: "极度虚荣自私，模仿姐姐签字冒领巨款，将钱用于购置名牌包与奢华婚礼，试图伪造豪门太太身份。", appearance: "浓妆艳抹，身披高定伴娘婚纱，穿金戴银，眼神骄横，习惯性抬高下巴冷嘲热讽。" },
        { name: "林姨", role: "antagonist", motive: "病态偏心小女儿李雅雅，用亲情绑架、撒泼哭闹等手段抢夺证据，替雅雅隐瞒非法冒领罪证。", appearance: "眼角爬满刻薄的皱纹，戴着雅雅买的假金项链，面对质问时常声嘶力竭地喊‘你别丢人现眼’。" }
      ]);
    }
  }

  if (payload.mode === "world_rules") {
    const input = payload.input || {};
    const isHistory = input.genre === "history" || (input.genre && input.genre.includes("历史"));
    if (isHistory) {
      return JSON.stringify([
        { type: "fact", content: "天幕只能在黄昏时段开启，每次播放约半个时辰的未来历史直播片段" },
        { type: "must", content: "李世民在看到武媚娘日后登基的预警后，必须在朝臣面前隐忍并采取分权防范措施，绝不能直接降旨诛杀" },
        { type: "cannot", content: "古代任何弓弩、火炮或玄学术法绝不能对高悬的天幕屏障造成丝毫物理磨损或干扰" }
      ]);
    } else {
      return JSON.stringify([
        { type: "must", content: "主角面对原生家庭的道德逼迫必须始终保持清醒冷酷，绝对不能心软妥协" },
        { type: "cannot", content: "妹妹在面临司法介入和笔迹鉴定报告前，必须咬死说自己不知情，坚决否认私领行径" },
        { type: "fact", content: "转账给李雅雅的三十万拆迁款，必须附带清晰的银行回执单和假签名底单作为证据载体" }
      ]);
    }
  }

  if (payload.mode === "world_timeline") {
    const input = payload.input || {};
    const isHistory = input.genre === "history" || (input.genre && input.genre.includes("历史"));
    if (isHistory) {
      return JSON.stringify([
        { time: "贞观十七年春", event: "太极殿上空突然出现神秘天幕，震撼直播‘玄武门之变’未来因果，李世民惊骇下封锁皇宫。" },
        { time: "贞观十七年夏", event: "天幕揭示门阀与突厥勾结内幕，李世民顺水推舟削弱裴寂等关陇士族领袖。" },
        { time: "贞观十八年冬", event: "天幕剧透科举制强国科技，李世民宣布重设科举细则，招揽寒门学子对抗门阀世袭。" }
      ]);
    } else {
      return JSON.stringify([
        { time: "老房拆迁前夕", event: "李雅雅伙同林姨，暗中模仿李小歌笔迹签字，悄悄划走本属于李小歌名下的三十万补偿金。" },
        { time: "婚礼当天现场", event: "李小歌在江畔五星大酒店后台揭破骗局，冷酷回应道德绑架，当众甩出银行底单和冒签流水。" },
        { time: "经侦立案宣判", event: "经笔迹与痕迹司法鉴定坐实冒领罪行，李雅雅和林姨被公诉法办，李小歌拿回款项释怀离场。" }
      ]);
    }
  }

  if (payload.mode === "audit") {
    return [
      "📌 **【本地模拟小说一致性深度诊断审计报告】**",
      "",
      "根据您的创作设定与已有正文，AI 深度语义审计已完成。诊断结果如下：",
      "",
      "⚡ **一、核心钩子与开篇引入（诊断得分：88/100）**",
      "**【亮点】** 正文第一段「我站在酒店化妆间外...听见我妈说...今天不能闹」切入极快，瞬间确立了戏剧化对抗场景，开篇冲突感强烈，完美切中「亲情背叛/家庭压榨」题材的吸睛黄金法则。",
      "**【逻辑断层风险】** 目前的开头虽然抓人，但对「酒店前台递交账单」的场景描写略显生硬，缺乏主角情绪的细腻承接，建议在第 3 段前置增加 80 字描写主角「看到垫付账单时冰凉的窒息感」，使动作转换更具代入感。",
      "",
      "🔍 **二、伏笔铺垫与证据链回收（诊断得分：72/100）**",
      "**【伏笔回收情况】** 方案中设计的核心道具「母亲的旧账本/手机录音」在正文中成功回收。但目前仅仅是被主角「冷冷攥在手里」，缺乏对道具外观或来历的细节动作刻画，削弱了其作为「致命反击物证」的重量感。",
      "**【修改建议】** 建议在中间追加一句眼神交互或指尖抠弄道具边缘的微动作，例如：「旧账本的红皮已经磨损脱落，每一道翻折的折痕都像是一次无声的欺骗」，以此放大物证对情感的背叛暗示。",
      "",
      "💡 **三、角色动机与对抗张力（诊断得分：85/100）**",
      "**【人物设定自洽】** 主角并非唯唯诺诺的软弱者，最后的动作「把账本举到镜头前」反击坚定，主角的「清醒与决绝」动机极度自洽；母亲「第一反应是抢夺」的反应也十分典型，反派压迫力十足。",
      "**【张力升级空间】** 建议将母亲来抢账本的动作升级为「母亲先是尴尬地堆起笑，旋即压低声音、带着怨毒说『你别在这丢人现眼』再动手抢夺」，将台词与动作结合，使冲突烈度飙升至顶点。"
    ].join("\n");
  }

  if (payload.mode === "plan") {
    const input = payload.input || {};
    const theme = input.theme || "雨巷尽头的灯";
    const genre = input.genre || "suspense";
    
    const shortTheme = theme.length > 15 ? (theme.slice(0, 15) + "...") : theme;
    
    let titles = [];
    const trends = payload.matchedTrends || [];
    if (trends.length > 0) {
      const bestTrend = trends[0].novel_title;
      const pureTitle = bestTrend.replace(/[《》]+/g, "");
      titles = [
        `《参考爆款【${pureTitle}】后，我以${shortTheme}完美反击》`,
        `《他们抢我${pureTheme(pureTitle)}？我反手把账本送上法庭》`,
        `《被隐瞒的${shortTheme}》`
      ];
    } else if (genre === "suspense" || (theme && (theme.includes("目击者") || theme.includes("慌了") || theme.includes("死者")))) {
      titles = [
        "《我查最后的目击者那天，嫌疑人开始慌了》",
        "《死亡通知发出后，他彻底露出了马脚》",
        "《关于目击者的二次反转》"
      ];
    } else if (genre === "family" || genre === "revenge") {
      titles = [
        "《发现拆迁款被私吞后，我没有当场揭穿父母》",
        "《妹妹以为我输了，我把账本送上了法庭》",
        "《被隐瞒的三十万拆迁款》"
      ];
    } else if (genre === "history") {
      titles = [
        "《我给秦始皇直播未来后，大秦不亡了》",
        "《李世民看完天幕，连夜改了国策》",
        "《大唐：国运倒计时，开局查抄粮仓》"
      ];
    } else {
      titles = [
        `《被隐瞒的${shortTheme}》`,
        `《关于${shortTheme}的二次反转》`,
        `《所有人都等我崩溃，我却拿回了底牌》`
      ];
    }

    function pureTheme(str) {
      return str.replace(/《我把|《我给|我把|我给/g, "").slice(0, 10);
    }
    const hook = `我站在细雨里，指尖触碰到泛黄的木质台灯开关。眼前的老人正一字一句编织着谎言，而我皮包里那封手写信，是拆穿他的唯一底牌。`;
    const outline = [
      `【开端】深夜造访旧书店，发现本应在火灾中烧毁的手写信，引出对“${shortTheme}”的致命疑惑。`,
      `【发展】在拆迁的废墟中搜集线索，妹妹与邻居神色慌张，试图以“全家大局”为由阻止我继续追查。`,
      `【转折】本已答应作证的书店老板突然翻水出逃，现场所有证据链条瞬间被伪装的意外掩盖。`,
      `【高潮】除夕夜的家宴上，主角当众拆开泛黄手写信，亮出转账流水，剥开妹妹侵占赔偿款的伪装。`,
      `【结局】妹妹被拘留，父母在邻里的指点中仓皇搬离。主角重新扭开那盏泛黄台灯，释怀告别。`
    ];
    const characters = [
      { name: "我", role: "主角 (第一人称)", motive: `查明真相，追回妹妹利用“${shortTheme}”私吞的三十万拆迁安置款。` },
      { name: "林姨", role: "反派 (母亲/阻挠者)", motive: `偏袒小女儿，试图用亲情道德绑架主角，掩盖妹妹造假签名的行径。` },
      { name: "老陈", role: "配角 (书店老板)", motive: "握有关键寄信凭证，但因欠下高利贷被林姨用钱封口，陷入动摇。" }
    ];
    const marketBeats = [
      { title: "开篇冲突", text: "开场三句话引出八十万垫付危机，人物关系瞬间拉紧。" },
      { title: "付费卡点", text: "林姨当众道德绑架强行按头主角签字，主角用指纹反击逼反派撕破脸。" },
      { title: "短剧化卖点", text: "多重复仇反转，小人得志后的真相降维打脸，符合爽文情绪宣泄。" }
    ];
    const evidenceChain = [
      { stage: "第一阶段 (开端)", appears: "第 3 段", clue: "欠款确认单", purpose: "揭开林姨全家垫付婚礼钱的虚假面纱。" },
      { stage: "第二阶段 (对峙)", appears: "第 8 段", clue: "磨损的旧账本", purpose: "证实父母多年来克扣主角存款用于妹妹买房的事实。" },
      { stage: "第三阶段 (收尾)", appears: "第 12 段", clue: "银行签名指纹", purpose: "降维打击，坐实妹妹私自冒签套现的犯法行为。" }
    ];
    const dramaEpisodes = [
      { episode: 1, title: "不速之客的婚礼欠单", premise: "婚礼前夕，前台突然递来八十六万婚礼账单强加在主角头上。", cliffhanger: "母亲抢夺账单并威胁主角不准闹事。" },
      { episode: 2, title: "一家人的吃人算盘", premise: "回到家宴，父亲出面要求主角‘顾全大局’，妹妹一身名牌冷嘲热讽。", cliffhanger: "主角拿出记账凭条当场对账。" },
      { episode: 3, title: "伪证与倒戈的枪声", premise: "主角求助关键中介陈叔，却发现陈叔早已被林姨用二十万封口倒戈。", cliffhanger: "林姨得意洋洋宣布要将主角彻底扫地出门。" },
      { episode: 4, title: "夜半拆迁的哭声", premise: "主角在旧房里挖出妹妹私自签名领取安置款的银行原件。", cliffhanger: "妹妹带人半夜砸门，试图暴力销毁原件。" },
      { episode: 5, title: "指纹落定，铁证如山", premise: "在最终的股权代表大会上，主角直接带法警入场，展示笔迹鉴定与指纹录音。", cliffhanger: "反派面如死灰，戴上手铐。主角释怀关上老屋泛黄的台灯。" }
    ];
    const draft = [];
    const scores = [
      ["开篇钩子", 92],
      ["盐选适配", 88],
      ["短剧潜力", 95],
      ["情绪张力", 90]
    ];
    const diagnosis = `大纲剧情以现实利益“拆迁款私吞”为主要撕裂点，冲突极其真实落地。开篇利用“信息差错位”迅速将压力倾斜向主角，配合“手写信”物证形成完美的强钩子。唯一需要注意的是第四幕妹妹砸门夺证物时的烈度控制，需确保主角的人身安全，且合法搜集证据进行降维打击，避免低效撕扯拖慢节奏。`;
    const proposalPack = {
      score: 91,
      positioning: [
        { label: "目标读者", text: "偏爱现实大女主翻盘、家庭剥削反击和高情绪爽点的都市女性读者。" },
        { label: "付费承诺", text: `用“三十万拆迁款被私吞”作为导火索，前半段全家合谋施压，后半段主角利用手写信和指纹原件反手送妹妹入狱，达成最强爽点。` },
        { label: "编辑卖点", text: "人物关系极度集中，以“老房拆迁”为核心载体，物证精巧，符合短剧和知乎爆款的传播规律。" }
      ],
      pitch: {
        title: titles[0],
        logline: `为了给妹妹凑齐婚礼与婚房，偏心的父母暗中联合妹妹私吞了主角三十万拆迁款。主角凭一封陈年手写信当场对质，掀起了一场干净利落的合法复仇。`,
        synopsis: `主角得知老屋拆迁款已被偏心父母和妹妹背着自己冒签领走。中段主角隐忍不发，暗中走访当年邮局及中介，搜集妹妹冒签与转移资产的流水单。高潮处在家宴上直接拿出笔迹鉴定与转账铁证对簿公堂，依法收回所有款项并送贪婪的妹妹入狱，彻底与吸血的家庭划清界限。`,
        editorNote: `建议定位为 8000-12000 字精美中短篇。开篇切忌平铺直叙，可直接从“主角撞破全家算盘”的家宴争执戏切入，冲突载体聚焦于“签名原件”和“手写信”，爽点干脆。`
      },
      routes: [
        { name: "盐言故事投稿", speed: "中速", revenue: "千字买断及分成", action: "撰写 3000 字试读样章，附带本大纲，重点打磨第三幕的反转强度。" },
        { name: "微短剧版权售卖", speed: "较快", revenue: "保底授权+流水提成", action: "将前五集分集剧本节拍精细化，重点突出‘除夕夜铁证打脸’的黄金爆点。" },
        { name: "模板商品化", speed: "最快", revenue: "创意方案授权", action: "把‘吸血家庭大反击’的物证设计、对峙台词模板提炼后直接打包商用。" }
      ],
      checklist: [
        "首段 150 字内必须把安置款冲突砸在桌面上。",
        "妹妹和父母的台词必须极具现实刺痛感，避免空洞谩骂。",
        "反击过程必须严格遵守法律法规，以笔迹鉴定 and 公检法介入作为决定性力量。"
      ]
    };
    const prompt = `写一篇 1200 字左右的第一章正文。场景在拆迁老宅昏暗的八仙桌前。主角面对母亲林姨的惊慌失措、妹妹的理直气壮，冷静地拿出银行流水和当年的手写信。注意刻画妹妹穿戴名牌与老宅破败的对比，以及主角指尖轻抚信封上被烟火熏黑的折痕等微动作，营造窒息后的爆发感。`;

    return JSON.stringify({
      schemaVersion: 6,
      id: "mock-plan-uuid-" + Date.now(),
      createdAt: new Date().toISOString(),
      input,
      profile: { label: "✨ AI 智能方案" },
      titles,
      hook,
      outline,
      characters,
      marketBeats,
      evidenceChain,
      dramaEpisodes,
      draft,
      scores,
      diagnosis,
      proposalPack,
      prompt
    });
  }

  if (payload.mode === "apply_audit") {
    const input = payload.input || {};
    const theme = input.theme || "家里人逼我让步";
    
    return [
      `我指尖紧紧捏着那张折痕泛白的欠款单，手心沁出一层冷汗。`,
      "",
      `隔着那扇昂贵的红木雕花门，我妈压抑的声音清晰地钻进耳膜：“先别让她进来，那丫头倔，今天雅雅的大喜日子，绝不能让她闹起来。等婚礼结了，再逼她把这八十六万的账签了。”`,
      "",
      `门缝里，昂贵的水晶吊灯漏出几缕璀璨刺眼的光。里面欢声笑语，妹妹穿着定制婚纱，在司仪的指引下一遍遍练习挽手齐步。而我脚下，是酒店前台刚刚冷冰冰塞给我的垫付单，上面的签字人，赫然模仿着我的笔迹。`,
      "",
      `八十六万，连妹妹伴娘的钻戒都是从我名下信用卡划的账。`,
      "",
      `我力图拨给我爸，等了许久，只换来一条冷冰冰的微信：“一家人别计较这么多，你妹夫家是高门，我们不能失了面子。你先签了单子，这钱以后我和你妈慢慢省出来还你。”`,
      "",
      `慢慢省？他们两个退休金加起来不足四千的普工，拿什么省出八十六万？说白了，就是赌我不敢在今天砸了妹妹这桩攀龙附凤的豪门梦，赌我一辈子甘愿当她们垫脚的烂泥。`,
      "",
      `看着微信屏幕上的“顾全大局”，我常年隐忍的胸腔突然剧烈起伏，旋即笑了起来。胸腔里那股积压多年的窒息感，在一瞬间凝成了刺骨的清醒。`,
      "",
      `“吱呀——”`,
      "",
      `大门骤然拉开。我妈手里拿着准备按手印的印泥，脸上的谄媚笑意还没褪去，冷不防对上我的目光，她整个人像被雷劈了一般，手一抖，下意识地想要掩盖背后的印泥盒。`,
      "",
      `“小……小歌，你什么时候到的？”她尴尬地扯动嘴角，眼神虚浮地往我手上的欠单上瞄，旋即压低声音，语气里夹着一丝不易察觉的怨毒和警告，“你别在这丢人现眼，快把单子收起来，雅雅的婆家马上到了。”`,
      "",
      `她一边说着，一边急迫地伸手，尖利的指甲直直冲着我手中的欠单抓了过来。`,
      "",
      `我早有防备，面无表情地往后退开一大步。皮包拉链滑开，我抽出一叠昨晚连夜去银行打出的流水单，啪地一声，拍在化妆镜前最显眼的红木梳妆台前，正对着正在补妆的妹妹和刚进门的婆家代表。`,
      "",
      `我指点着上面的大红印章，声音清冷决绝，没有半分起伏：“妈，妹，既然婆家的人都在，咱们就把账盘清楚。这八十六万的婚礼垫付款，以及雅雅名下那套婚房的三十万首付，到底是从谁的卡里‘冒签’划出去的？如果不说清楚，这婚礼也别结了，法警和律师在楼下，随时恭候。”`
    ].join("\n");
  }

  const input = payload.input || {};
  const theme = input.theme || "家里人逼我让步";
  const place = input.genre === "family" ? "酒店化妆间外" : "门口";
  const proof = input.genre === "family" ? "母亲那本旧账本" : "手机里的录音";
  return [
    `我站在${place}，听见我妈隔着门说：“先别让她进来，今天不能闹。”`,
    "",
    `门缝里漏出一点暖黄 of 暖黄的灯。里面很热闹，妹妹的伴娘在笑，司仪一遍遍确认流程。只有我手里的${proof}，冷得像刚从冰水里捞出来。`,
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

async function polishGeneratedDraft({ baseUrl, apiKey, modelName, payload, text }) {
  if (payload.mode === "polish" || payload.mode === "audit" || payload.mode === "plan" || payload.mode === "apply_audit" || (payload.mode && payload.mode.startsWith("world_"))) return text;
  const quality = assessDraftQuality(text, payload.input);
  const qualityInstruction = quality.ok
    ? ""
    : `\n【必须修复的问题】\n${quality.issues.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
  try {
    const polishResponse = await fetch(getChatUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: buildDraftPolishSystemPrompt(payload.input) },
          { role: "user", content: buildDraftPolishUserPrompt(payload.input, text) + qualityInstruction }
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
  if (payload.mode === "world_infer") {
    return [
      "你是一个顶尖的网文设定与大纲架构专家。请根据我提供的小说基本信息、核心背景主线以及分章大纲，为本小说推演出一整套逻辑严密、细节饱满且充满冲突张力的世界观设定包（包括登场人物、背景世界观、逻辑约束铁律、故事时间线）。",
      "【极重要的硬约束】",
      "1. 必须直接输出一个合法且标准的 JSON 对象，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何前言后语，以便代码可以直接用 JSON.parse 解析。",
      "2. 语言必须深刻、生动且极富现场感，字句精炼，直击网文爽点痛点，符合顶级高爽度网文设定的文字水准。",
      "3. 你的输出 JSON 必须严格且仅包含以下四个首层属性，字段名拼写完全一致：",
      "   - characters: array of objects (登场人物设定，推演设计 4-8 位张力极强、性格立体且碰撞极其剧烈的角色。每个对象包含：",
      "       * name: string (姓名)",
      "       * role: string (必须属于以下值之一: 'protagonist'代表主角, 'love'代表感情线, 'antagonist'代表反派, 'mentor'代表导师, 'supporting'代表重要配角)",
      "       * motive: string (核心动机与不可告人的秘密。必须是驱动故事冲突和对抗的关键，字数 60-100 字)",
      "       * appearance: string (标志性外貌特征、习惯动作与神态细节，字数 60-100 字)",
      "     )",
      "   - worldview: object (背景世界观。必须且仅包含以下四个字段：",
      "       * era: string (时代背景或科技高度，例如：当代都市/架空唐代历史错位，要写得极具科技或时代厚重感)",
      "       * location: string (核心舞台与焦点活动地点，如：长安太极殿/江畔豪门酒店，要极具画面冲突张力)",
      "       * society: string (社会阶层与权力斗争背景，描述谁掌握资源话语权、主角面临什么样的掣肘，字数 120-180 字)",
      "       * special: string (特殊底层逻辑与超自然法则/核心现实规律，字数 120-180 字)",
      "     )",
      "   - rules: array of objects (逻辑约束铁律，建议推演 4-6 条规则。每个对象包含：",
      "       * type: string (必须是以下三个值之一: 'must'代表必须遵循的正面剧情强制, 'cannot'代表绝对禁止的负面剧情限制, 'fact'代表恒定的设定事实)",
      "       * content: string (具体的限制规则描述，字数 40-70 字)",
      "     )",
      "   - timeline: array of objects (故事时间大纪元脉络，建议推演 4-8 个最抓人的关键时间节点脉络。每个对象包含：",
      "       * time: string (时间点名称，如：老房拆迁前夕/贞观十七年春/入府第3天)",
      "       * event: string (在该时间点发生的决定性关键核心冲突或反击事件，要充满情绪力量与画面张力，字数 40-70 字)",
      "     )",
      "",
      "【输入小说的基本信息与已生成的大纲】",
      JSON.stringify(payload.input || {}, null, 2)
    ].join("\n");
  }

  if (payload.mode === "world_worldview") {
    return [
      "你是一个顶尖的网络小说设定主创。请根据我提供的小说大纲及基础参数，推演出一套严密、宏大、且极富商业价值和网文吸睛度的背景世界观设定。",
      "【极重要的硬约束】",
      "1. 必须直接输出一个合法且扁平的 JSON 字符串，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何前言后语，以便代码可以直接用 JSON.parse 解析。",
      "2. 语言必须深刻、生动且极富现场感，字句精炼，直击网文爽点痛点，符合高水准商业短篇或长篇的文字要求。",
      "3. 你的输出 JSON 必须严格包含以下首层属性，字段名完全一致：",
      "   - era: string (时代背景或科技高度，例如：当代都市/架空唐代历史错位，要写得极具科技或时代厚重感)",
      "   - location: string (核心舞台与焦点活动地点，如：长安太极殿/江畔豪门酒店，要极具画面冲突张力)",
      "   - society: string (社会阶层与各方斗争背景，描述谁掌握资源话语权、主角面临什么样的环境掣肘，字数 120-180 字)",
      "   - special: string (核心底层法则与超自然法则，如穿越错位交互/私签冒领的物证核对规则，字数 120-180 字)",
      "",
      "【输入故事设定】",
      JSON.stringify(payload.input || {}, null, 2)
    ].join("\n");
  }

  if (payload.mode === "world_character") {
    return [
      "你是一个顶尖的网文人物策划师。请基于我提供的小说题材与大纲，为其度身定制设计 3 位张力极强、性格立体且人物碰撞极其剧烈的登场人物设定。",
      "【极重要的硬约束】",
      "1. 必须直接输出一个合法扁平的 JSON 数组，每个元素是一个代表角色的 JSON 对象，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何前言后语。",
      "2. 每个角色对象必须严格且仅包含以下四个字段，拼写绝对一致：",
      "   - name: string (人物名字，要好听且符合身份性格)",
      "   - role: string (必须属于以下特定合法值之一：'protagonist'代表主角, 'love'代表感情线, 'antagonist'代表反派, 'mentor'代表导师, 'supporting'代表重要配角)",
      "   - motive: string (核心动机与不可告人的秘密。必须是驱动故事冲突和对抗的关键，拒绝假大空，字数 60-100 字)",
      "   - appearance: string (标志性外貌特征、习惯动作与神态细节，要生动具体，极具视觉感，字数 60-100 字)",
      "",
      "【输入故事设定】",
      JSON.stringify(payload.input || {}, null, 2)
    ].join("\n");
  }

  if (payload.mode === "world_rules") {
    return [
      "你是一个网络小说逻辑架构师。为了确保故事在生成时逻辑严密、世界线不崩塌，请基于我提供的小说大纲，设计 3 条强力的逻辑制约和设定事实铁律。",
      "【极重要的硬约束】",
      "1. 必须直接输出一个合法平的 JSON 数组，每个元素是一个代表规则的 JSON 对象，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何前言后语。",
      "2. 每个规则对象必须严格且仅包含以下两个字段：",
      "   - type: string (必须是以下三个值之一：'must'代表必须遵循的正面剧情强制, 'cannot'代表绝对禁止出现的负面剧情限制, 'fact'代表恒定的设定事实)",
      "   - content: string (具体的限制规则描述。如：‘主角在被传唤前决不能妥协退让’、‘古代天幕无法被物理摧毁’。字数 40-70 字)",
      "",
      "【输入故事设定】",
      JSON.stringify(payload.input || {}, null, 2)
    ].join("\n");
  }

  if (payload.mode === "world_timeline") {
    return [
      "你是一个网文章节与大纲编织专家。为了让故事剧情循序渐进、高潮迭起，请根据小说的大纲与背景，编织出 3 个最核心、最抓人的关键时间节点脉络。",
      "【极重要的硬约束】",
      "1. 必须直接输出一个合法扁平的 JSON 数组，每个元素是一个代表时间节点的 JSON 对象，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何前言后语。",
      "2. 每个节点对象必须严格且仅包含以下两个字段：",
      "   - time: string (时间点名称，如：老宅拆迁前夕、太极殿天幕初现)",
      "   - event: string (在该时间点发生的决定性关键核心冲突或反击事件，要充满情绪力量与画面张力。字数 40-70 字)",
      "",
      "【输入故事设定】",
      JSON.stringify(payload.input || {}, null, 2)
    ].join("\n");
  }

  if (payload.mode === "plan") {
    const trends = payload.matchedTrends || [];
    const trendsSection = [];
    if (Array.isArray(trends) && trends.length > 0) {
      trendsSection.push("\n【当下全网同品类最热门爆款小说及起名风格参考案例（必须借鉴并融入其起名模式与起承转合结构）】");
      trends.forEach((t, i) => {
        trendsSection.push(`爆款案例 ${i + 1}：《${t.novel_title}》[原平台分类:${t.raw_genre}]`);
        if (t.introduction) trendsSection.push(`  - 官方简介：${t.introduction}`);
        if (t.analysis?.hook) trendsSection.push(`  - 情绪钩子：${t.analysis.hook}`);
        if (t.analysis?.pain_point) trendsSection.push(`  - 痛点抓手：${t.analysis.pain_point}`);
        if (t.analysis?.selling_point) trendsSection.push(`  - 商业看点：${t.analysis.selling_point}`);
      });
      trendsSection.push("\n【起名硬核指令】请深度借鉴上述爆款的“起名指纹”和“悬念设置技巧”，不要直接复制其具体字词，但必须高度还原其情绪力量：");
      trendsSection.push("  1. 生成的 3 个候选标题（titles）、5集分集大纲的每集标题（dramaEpisodes[].title）以及 proposalPack.pitch.title 必须富有极强的情绪撕扯和悬念后置节奏（例如：‘发现拆迁款被私吞后，我没有当场揭穿’、‘不速之客的婚礼账单’、‘一家人的吃人算盘’），严禁生成‘关于秘密的二次反转’或直接拼接原输入等空泛、机械的拼接词！");
      trendsSection.push("  2. 生成的开篇钩子（hook）也必须极具现场冲突与代入感。");
    }

    const knowledgeSection = formatKnowledgeForPrompt(payload.matchedSubjectKnowledge);

    return [
      "你是一个知乎盐选和网文短篇小说的顶尖创意总监。请为以下输入条件设计一套极其专业、剧情精妙、且商业变现价值极高的小说方案（JSON 格式）。",
      "【极其重要的硬约束（必须 100% 遵守，严防内容物理截断）】",
      "1. 必须直接输出合法 JSON 字符串，禁止使用 ```json 或者是任何 markdown 标记包裹，也禁止输出任何前言后语。以便我的代码可以通过 JSON.parse 直接解析。",
      "2. 语言必须具备顶尖网文的商业敏感度、叙事深度与细腻质感，避免大话空话。必须做到字句精炼，严控字数，防止输出过长被截断！任何多余、注水、过长的话语都是系统崩溃的隐患！",
      "3. 你的输出 JSON 必须严格包含以下字段，不要多层嵌套，必须是扁平的首层属性，且必须严格限制各字段字数：",
      "   - titles: [string, string, string] (3个候选标题，切忌抽象，要带强烈的动作感或现实矛盾，每个标题限 10-18 字)",
      "   - hook: string (首段开篇钩子，必须有现场感、强冲突，字数必须严格控制在 90-120 字内，不要解释背景)",
      "   - outline: [string, string, string, string, string] (开端、发展、转折、高潮、结局五幕大纲，每幕字数必须严格控制在 40-55 字内，要精炼写出核心矛盾与动作，千万不要长篇大论，每幕一两句话足矣)",
      "   - characters: array of exactly 3 objects (必须仅包含主角、反派及一个重要配角。每个对象的 motive 和 appearance 均必须极简，且字数严格控制在 35-50 字内)",
      "   - marketBeats: array of exactly 3 objects (每个对象的 title 限 6 字内，text 限 25-35 字内)",
      "   - evidenceChain: array of exactly 3 objects (clue 限 10 字内，purpose 限 25-35 字内，stage 和 appears 限 10 字内)",
      "   - dramaEpisodes: array of exactly 5 objects (episode 为数字 1-5，title 限 10-15 字内，premise 限 30-45 字内，cliffhanger 限 30-45 字内)",
      "   - draft: array of string (必须为空数组 [])",
      "   - scores: array of exactly 4 pairs (形式为 [['开篇钩子', 92], ['盐选适配', 88], ['短剧潜力', 95], ['情绪张力', 90]])",
      "   - diagnosis: string (大纲诊断分析，字数必须严格控制在 70-100 字内，不要长篇评论)",
      "   - proposalPack: object，必须且仅包含以下结构（注意控制内部字数）：",
      "     {",
      "       score: number (如 91),",
      "       positioning: array of exactly 3 objects (格式为 {label: string, text: string}，每个 text 限 25-35 字内),",
      "       pitch: {",
      "         title: string (限 10-18 字内),",
      "         logline: string (一句话简介，限 35-50 字内),",
      "         synopsis: string (故事大纲摘要，字数必须严格控制在 90-120 字内，千万不可超限),",
      "         editorNote: string (编辑推荐语，字数必须严格控制在 50-70 字内)",
      "       },",
      "       routes: array of exactly 3 objects (每个对象的 action 必须严格控制在 25-35 字内，name 限 10 字内，speed 限 5 字内，revenue 限 15 字内),",
      "       checklist: array of exactly 3 strings (每条自检指令限 20-30 字内)",
      "     }",
      "   - prompt: string (AI 续写提示词，字数必须严格控制在 40-60 字内)",
      "",
      trendsSection.join("\n"),
      "",
      knowledgeSection,
      "",
      "【极重要：请仅直接输出标准的、合法的 JSON，严禁输出任何 markdown 标记（如 ```json 等）或前后置多余字句。你的输出必须直接以 `{` 开始，以 `}` 结束。确保内部所有的键名（Keys）与字符串值（Values）全部使用双引号包裹，绝对不要在任何数组或对象的最后一个属性后多出尾随逗号 `,`。】",
      "",
      "【输入参数】",
      JSON.stringify(payload.input || {}, null, 2)
    ].filter(Boolean).join("\n");
  }

  if (payload.mode === "apply_audit") {
    return [
      "你是一名知乎盐选和网文短篇小说的资深主编。请针对提供的【深度审计诊断意见】和【原有正文】，对正文进行完美的重构优化。",
      "【极其重要的重构指令】",
      "1. 严格针对审计报告里提出的每一条逻辑漏洞、伏笔缺失、降智行为和张力不足，进行正文的精细化修补与重塑。",
      "2. 必须保留原故事的叙事视角（第一人称「我」或第三人称），保留核心人设、主要人物 and 原有故事主线，但细节冲突和动作描写要极大提升。",
      "3. 剔除所有 AI 味的套话与空泛叙述，每段必须是有画面感、动作和即时对白的现场戏。少用总结词，多写具体的反常细节和证物交互。",
      "4. 字数控制在 1200 到 1800 字之间。不要任何前言、后语或 markdown 包装，直接输出重构后的优质首章正文。",
      "",
      "【创作参数】",
      JSON.stringify(payload.input || {}, null, 2),
      "",
      "【AI 深度审计诊断意见】",
      payload.direction || "请针对逻辑硬伤进行重构。",
      "",
      "【原有正文】",
      payload.existingDraft || ""
    ].join("\n");
  }

  const modeText = {
    draft: "请基于以下创作方案，写 1200 到 1800 字的短篇第一章开篇正文。只写一个连续事件，不写完整故事梗概。",
    rewrite: `请按“${payload.direction || "更强反转"}”方向续写 500 到 800 字。要求不重复前文，不解释设定，用具体行动推进冲突。`,
    polish: "请润色以下正文，让语言更像高转化短篇故事，保留原剧情事实但增强钩子、台词 and 反转力度。",
    audit: "请针对【已有正文】和【已有方案】（故事大纲及详细设定）进行高水准的小说一致性深度诊断审计。请从以下三个最关键维度进行专业、深透、具体且尖锐的文学评估：\n1. 【核心钩子与开篇引入】（首段是否进入核心动作、切入点有无脱靶或与题材冲突）；\n2. 【伏笔铺垫与证据链回收】（大纲设计的线索 and 证据是否被正文有机结合并提及，有没有交代不清的突兀细节）；\n3. 【角色动机与对抗行为】（主角与对抗者的行动有无降智、各方冲突是否符合常理且极富张力）。\n\n请直接给出具体的诊断建议（200-300字左右），指出哪里写得好、哪里存在逻辑断层以及具体该如何修改。请使用简洁、尖锐的段落结构进行输出，不需要任何多余的客套客气前言。"
  };
  const inspirationSection = [];
  if (Array.isArray(payload.matchedInspirations) && payload.matchedInspirations.length > 0) {
    inspirationSection.push("\n【本地素材库召回的写作策略】");
    payload.matchedInspirations.slice(0, 5).forEach((ins, idx) => {
      inspirationSection.push(`策略 ${idx + 1}（匹配分 ${Math.round(ins._score || 0)}）：`);
      inspirationSection.push(ins.strategyPrompt || `主题：${ins.theme}\n钩子：${ins.hook}\n节奏：${ins.outline}`);
    });
    inspirationSection.push("优先综合这些策略生成本次故事；固定题材模板只能兜底，不能替代素材库策略。");
  }

  const knowledgeSection = formatKnowledgeForPrompt(payload.matchedSubjectKnowledge);

  return [
    modeText[payload.mode] || modeText.draft,
    buildGenreWritingRules(payload.input),
    buildSceneBlueprint(payload.input),
    inspirationSection.join("\n"),
    knowledgeSection,
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

export async function callOpenAI(payload) {
  const cfg = payload.modelConfig || {};
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
  const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
  if (isPlaceholder) return localMockGenerate(payload);

  const apiResponse = await fetch(getChatUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: buildSystemPrompt(payload.genreStats || null, payload.mode) },
        { role: "user", content: buildUserPrompt(payload) }
      ],
      max_tokens: payload.mode === "plan" ? 4000 : (payload.mode === "rewrite" ? 1200 : 2600),
      temperature: payload.mode === "plan" ? 0.88 : (payload.mode === "polish" ? 0.72 : 0.88),
      frequency_penalty: 0.35,
      presence_penalty: 0.2,
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
