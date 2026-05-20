// ⚠️ 本文件已超过建议行数，请在下次功能迭代时拆分
// ============================================================
// 模块: planner.js — 故事方案生成逻辑 (buildXxx / scoreXxx)
// 渲染部分已拆分至 planner-render.js
// ============================================================

function buildHook(input, profile) {
  const role = pick(profile.roles);
  const secret = pick(profile.secrets);
  const P = input.viewpoint === "first" ? "我" : `那个${role}`;
  const her = input.viewpoint === "first" ? "我" : "她";
  const theme = sentenceTheme(input.theme);
  const source = `${input.title || ""} ${input.theme || ""} ${input.notes || ""}`;
  const evidenceWords = ["死亡通知", "尸检报告", "通话记录", "监控截图", "指纹", "录音", "账本", "合同", "照片", "短信", "规则纸条", "转账记录"];
  const evidence = evidenceWords.find((word) => source.includes(word)) || "那份证据";
  if (input.genre === "suspense") {
    return `${P}把${evidence}摊开时，死者家属还在重复同一句话：“他不可能在现场。”`;
  }
  const matchedHook = Array.isArray(input.matchedInspirations) ? input.matchedInspirations[0]?.hook : "";
  if (matchedHook && !matchedHook.includes("【异常线索】")) {
    return matchedHook
      .replace(/【主角】/g, P)
      .replace(/【秘密】|【事件】|【异常线索】/g, theme)
      .slice(0, 120);
  }

  const hooks = [
    `${P}把${evidence}推到桌子中央时，对面的人终于不说话了。`,
    `“你最好别签。”${P}盯着最后一行名字，忽然明白${secret}。`,
    `${P}没有接那支笔，只把${evidence}翻到第二页：“这句话，你们谁来解释？”`,
    `门外的脚步声停下时，${P}刚好看见${evidence}上多出来的那一行字。`,
    `${P}把录音开到最大声。第一句话响起时，所有人都看向了门口。`,
    `签字笔悬在纸上，${P}忽然停住。那一页最底下的名字，不该出现在这里。`,
  ];
  return pick(hooks);
}

function buildOutline(input, profile) {
  const highIntensity = input.intensity >= 8;
  const tags = input.tags && input.tags.length ? input.tags : [profile.label];
  const matchedOutline = Array.isArray(input.matchedInspirations) ? input.matchedInspirations[0]?.outline : "";
  const knowledgeBeats = matchedOutline
    ? matchedOutline.split(/[;；]/).map((item) => item.trim()).filter(Boolean)
    : [];

  const pressureVariants = highIntensity
    ? ["冲突要直接、台词要带刺", "用动作而非独白推进对抗", "人物立场必须在此处明确交锋", "每句对话都要让对方无路可退"]
    : ["信息推进克制但持续", "用细节暗示而非明说", "让读者在此处感到一丝不安", "埋下一个不起眼的伏笔"];

  const connectors = ["围绕", "以", "借助", "通过"];
  const endings = ["推进节奏", "展开情节", "呈现张力", "深化冲突"];

  return profile.outline.map((step, index) => {
    const tag = tags[index % tags.length];
    const knowledgeBeat = knowledgeBeats[index % Math.max(knowledgeBeats.length, 1)];
    const pressure = pick(pressureVariants);
    const conn = pick(connectors);
    const end = pick(endings);
    const knowledgeHint = knowledgeBeat ? `承接“${knowledgeBeat}”的节奏；` : "";
    return `${step}；${knowledgeHint}${conn}“${tag}”元素${end}，${pressure}。`;
  });
}

function buildDraft(input, profile, hook) {
  const person = input.viewpoint === "first" ? "我" : "她";
  const theme = sentenceTheme(input.theme);
  const source = `${input.title || ""} ${input.theme || ""} ${input.notes || ""}`;
  const sceneMap = {
    history: ["朝堂", "军帐", "城门"],
    rules: ["电梯口", "宿舍门外", "便利店"],
    suspense: ["派出所接警台", "医院走廊", "监控室"],
    revenge: ["婚房客厅", "酒店走廊", "民政局门口"],
    heroine: ["会议室", "签约现场", "董事会门口"],
    family: ["餐桌旁", "病房门口", "酒店前台"],
    folklore: ["祖祠门口", "雨夜村口", "旧宅堂屋"],
    workplace: ["会议室", "深夜办公室", "审计现场"]
  };
  const evidenceWords = ["死亡通知", "尸检报告", "通话记录", "监控截图", "录音", "账本", "合同", "照片", "短信", "规则纸条", "转账记录"];
  const noteParts = String(input.notes || "")
    .split(/[，。！？、；：\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const evidence = evidenceWords.find((word) => source.includes(word)) || noteParts.find((item) => /报告|记录|通知|账本|合同|录音|照片|短信|证据|监控/.test(item)) || "那份关键记录";
  const scene = noteParts.find((item) => /口|室|厅|店|院|局|门|桌|车|村|家/.test(item)) || pick(sceneMap[input.genre] || sceneMap.suspense);
  const pressure = input.genre === "family"
    ? "亲戚们都等着我先低头"
    : input.genre === "workplace"
      ? "主管把所有责任都推到我身上"
      : input.genre === "revenge"
        ? "对面的人笃定我不敢把证据摊开"
        : "所有人的口供都严丝合缝地对上了";
  const conflict = source.includes("指纹")
    ? "死者颈部那枚指纹"
    : source.includes("死亡时间")
      ? "双重死亡时间"
      : "关键时间点";

  return [
    `${person}站在${scene}，手里攥着${evidence}。${pressure}，可纸上最关键的记录，偏偏和${conflict}对不上。`,
    `对方说得很快，像是早就排练过。${person}没有打断，只把${evidence}翻到第二页，那里有一个被划掉又重新写上的名字。`,
    `房间里安静了几秒。有人咳了一声，有人低头看手机。${person}这才意识到，这件事不是谁记错了，而是有人希望所有人都只看见他们准备好的那一部分。`,
    `“你最好想清楚再说。”对面的人压低声音。`,
    `${person}抬头看着他，把${evidence}推到桌子中央：“我想得很清楚。现在开始，我们按时间线一件一件对。”`,
    `第一处破绽，就藏在他们最笃定的那句话里。`
  ];
}

function buildCharacters(input, profile) {
  const firstPerson = input.viewpoint === "first";
  const protagonist = firstPerson ? "叙事者" : pick(profile.roles, 4);
  const opponentMap = {
    suspense: "掌握证据却不断撒谎的亲近者",
    revenge: "把亲密关系当成筹码的背叛者",
    heroine: "用身份和资源压制主角的旧秩序代表",
    family: "习惯让主角牺牲的家庭核心人物",
    folklore: "借民俗禁忌掩盖旧案的人",
    history: "拘泥于旧史观的顽固权臣或历史原住民",
    rules: "利用规则漏洞进行绞杀的诡异存在",
    workplace: "垄断资源和话语权的上司或竞争对手"
  };
  return [
    {
      name: protagonist,
      role: "主角",
      motive: `想查清“${input.theme}”背后的真实代价，并夺回叙事主动权。`
    },
    {
      name: opponentMap[input.genre],
      role: "对抗者",
      motive: "害怕旧秘密曝光，所以不断制造道德压力、信息差和公开羞辱。"
    },
    {
      name: "关键证人",
      role: "反转触发点",
      motive: `表面站在对抗者一边，实际握着能推翻第一层真相的证据：${pick(profile.secrets, 5)}。`
    }
  ];
}

function buildMarketBeats(input, profile) {
  const paidAt = input.length <= 8000 ? "第 1800 字" : "第 3000 字";
  const climaxAt = input.length <= 8000 ? "第 5200 字" : "第 9000 字";
  return [
    {
      title: "开篇免费钩子",
      text: `前 300 字必须出现“${input.theme}”的公开冲突，让读者立刻判断主角处于劣势。`
    },
    {
      title: "付费卡点",
      text: `${paidAt}前后抛出第一份硬证据，但只揭开一半真相，把读者的问题从“发生了什么”转成“主角准备怎么反击”。`
    },
    {
      title: "短剧化卖点",
      text: `${climaxAt}安排公开对峙场面：证据、身份、关系三线同时反转，适合切成 1-2 分钟高冲突短视频片段。`
    },
    {
      title: "平台适配提醒",
      text: `保持${profile.tone}；每 600-900 字至少推进一次证据、关系或情绪位置。`
    }
  ];
}

function buildSubmissionPack(input, profile, titles, scores, marketBeats) {
  const scoreMap = Object.fromEntries(scores);
  const primaryTitle = titles[0];
  const paidBeat = marketBeats.find((item) => item.title === "付费卡点") || marketBeats[1];
  const dramaBeat = marketBeats.find((item) => item.title === "短剧化卖点") || marketBeats[2];
  const monetizationScore = Math.round((scoreMap["开篇钩子"] + scoreMap["盐选适配"] + scoreMap["短剧潜力"]) / 3);

  const loglines = {
    history: `当包含“${input.theme}”的异象降临，现代信息与古代皇权正面交锋，掀起一场改写大历史的降维打击。`,
    rules: `一份违背常识的诡异守则，一个被谎言与污染笼罩的死局，主角必须在“${input.theme}”的绝境中寻得一线生机。`,
    suspense: `一起由“${input.theme}”牵引出的陈年旧案，每个人的证词都完美无缺，而那份被修改的致命物证才是破局关键。`,
    revenge: `经历过亲密关系的背叛与公开羞辱后，主角带着关于“${input.theme}”的致命底牌，开启一场合法且致命的夺产复仇。`,
    heroine: `在被世俗偏见与家族势力联手排挤后，主角用关于“${input.theme}”的顶级商业底牌，完成对权势阶层的华丽降维逆袭。`,
    family: `以“${input.theme}”为导火索，撕开看似温情脉脉的家庭关系下，最真实、最刺痛的偏心与利益争夺。`,
    folklore: `祠堂雨夜的灯影，枯井下的怨声，关于“${input.theme}”的民俗禁忌背后，隐藏着一桩被全村联手掩盖了数十年的血债真相。`,
    workplace: `身处被无良资本与潜规则压制的底层，主角凭借一份关于“${input.theme}”的硬核合规证据，向职场霸凌者发起致命一击。`
  };

  const synopses = {
    history: `现代信息骤然传入古代，引来满朝震动与既得利益阶层的疯狂反扑。主角利用领先千年的现代知识与系统底牌，层层破局，在封建帝王与世家大族面前完成最硬核的科技救国打脸。`,
    rules: `主角无意间卷入充满诡异规则的禁忌空间，身边的规则与熟人皆不可信。中段在违规边缘试探、利用逻辑悖论瓦解规则的死锁，高潮处反向布局、破除污染源，揭示出关于规则源头的惊人反转。`,
    suspense: `主角被卷入一桩离奇谜案，面对层层伪装的口供与刻意布置的现场。中段通过微小破绽撕开谎言，反套路引蛇出洞，在高潮公开对峙中实现证据、身份的双重反转，指明意想不到的真凶。`,
    revenge: `主角遭遇伴侣与第三者的无耻联合背叛，资产与名誉位列深渊。主角表面隐忍麻痹对手，暗中进行周密的财务与证据收集，最终在关键时刻公开亮出底牌，让背叛者付出名声与金钱的双重沉痛代价。`,
    heroine: `主角在公开场合遭遇轻视与排挤，被剥夺应得利益。她隐忍潜伏，以极低姿态精准收集对手漏洞，暗中布局整盘商战。高潮处身份与股权强势爆开，降维打击所有看客，重建全新秩序。`,
    family: `一件看似微不足道的家庭纠纷，彻底引爆了长期积累的重男轻女与资产不公。亲戚的站队与父母的偏袒将主角逼至绝境，主角清醒斩断道德绑架，亮出证据并做出不再牺牲的决裂选择，痛快夺回尊严。`,
    folklore: `主角回到阴冷封闭的乡土古镇，遭遇一系列诡异莫测的民俗禁忌与仪式。随着调查深入，发现村民口中的“神惩”其实是掩盖多年前罪恶的遮羞布。高潮处主角打破陈规，揭露人性伪装，逼出当年真相。`,
    workplace: `主角在边缘岗位发现惊人的贪腐或造假数据，触碰利益链后惨遭停职与封杀。主角暗中联合同盟，利用无可辩驳的证据链与监管部门合规力量进行降维打击，当众送罪魁首入狱，彻底整顿职场。`
  };

  const audienceMap = {
    suspense: "偏爱反转推理、细节回收和结尾冲击的悬疑读者",
    revenge: "对亲密关系背叛、离婚翻盘和情绪宣泄敏感的女性读者",
    heroine: "喜欢强主角、身份反转和事业线翻盘的爽文读者",
    family: "关注家庭不公、现实困境和关系边界的都市读者",
    folklore: "喜欢民俗悬疑、乡土禁忌和旧案真相的故事读者",
    history: "喜欢信息差降维打击、改变历史遗憾的历史脑洞读者",
    rules: "热爱逻辑推理、惊悚氛围和打破常规的怪谈读者",
    workplace: "对职场霸凌感同身受、渴望打破潜规则逆袭的都市读者"
  };

  return {
    score: monetizationScore,
    positioning: [
      {
        label: "目标读者",
        text: audienceMap[input.genre] || audienceMap.suspense
      },
      {
        label: "付费承诺",
        text: `用“${input.theme}”制造强冲突，前半段让主角陷入劣势，后半段用证据反击完成${profile.label}爽点。`
      },
      {
        label: "编辑卖点",
        text: `题材明确、人物关系集中、卡点清楚；${paidBeat.text}`
      }
    ],
    pitch: {
      title: primaryTitle,
      logline: loglines[input.genre] || loglines.suspense,
      synopsis: synopses[input.genre] || synopses.suspense,
      editorNote: `建议先投 ${input.length <= 10000 ? "8000 字左右完整短篇" : "上下篇连载样章"}，标题保留强事件词，正文每 600-900 字推进一次证据或关系变化。`
    },
    routes: [
      {
        name: "盐选/盐言投稿",
        speed: "中速",
        revenue: "稿费或买断",
        action: "先完成 3000 字样章、完整大纲和结尾反转说明。"
      },
      {
        name: "短剧样稿包",
        speed: "较快",
        revenue: "样稿售卖或改编沟通",
        action: dramaBeat.text
      },
      {
        name: "模板商品化",
        speed: "最快",
        revenue: "售卖选题卡、证据链表和改稿清单",
        action: "把标题、钩子、证据链和分集节拍拆成可复用模板。"
      }
    ],
    checklist: [
      "前 300 字必须出现公开冲突或异常证据。",
      "付费卡点前只揭开一半真相，保留反击问题。",
      "结尾回收至少 2 条伏笔，避免只靠口头解释翻盘。",
      "投稿前准备 80 字简介、300 字梗概和完整结局说明。"
    ]
  };
}

function buildEvidenceChain(input, profile) {
  const secret = pick(profile.secrets, 6);
  const core = compactTheme(input.theme);
  const genreClues = {
    suspense: ["消失的报警回执", "多出来的监控人影", "被改过时间的通话记录", "尸检报告里的旧伤"],
    revenge: ["婚房保险柜密码", "三年前的病房签名", "被替换的亲子鉴定", "公司股权变更邮件"],
    heroine: ["债权转让合同", "董事会录音", "旧项目尽调报告", "被隐藏的真实履历"],
    family: ["房产证复印件", "母亲账本", "户口本夹页", "病房门口的录音"],
    folklore: ["族谱缺页", "纸人背后的生辰八字", "祖祠雨夜灯油", "河边旧账簿"],
    history: ["不该出现的现代工艺品", "提前被记载的未来史书", "出乎意料的天文观测记录", "用现代材料伪造的兵符"],
    rules: ["被撕掉一角的员工手册", "镜子里少了一个人的合影", "多出来的一条违背常理的隐藏规则", "前人留下的血字警告"],
    workplace: ["被恶意修改的背靠背绩效表", "深夜突然撤回的工作群通知", "一份盖着私章的废弃合同", "早已离职员工的内部邮件"]
  };
  const clues = genreClues[input.genre] || genreClues.suspense;
  const selectedClues = pickSequence(clues, 3, 7);
  return [
    {
      stage: "开篇伏笔",
      clue: selectedClues[0],
      appears: "前 800 字",
      purpose: `让读者意识到“${core}”不是偶然事件，而是被设计过的局。`,
      payoff: `高潮前回收，证明第一层真相只是对抗者抛出的假答案。`
    },
    {
      stage: "误导证据",
      clue: selectedClues[1],
      appears: "付费卡点前",
      purpose: "把嫌疑引向一个看似合理的人，制造读者判断偏差。",
      payoff: `中段反转时揭示它只证明了时间线被篡改，不能证明真正动机。`
    },
    {
      stage: "情绪证物",
      clue: selectedClues[2],
      appears: "第一次反击后",
      purpose: "把证据和亲密关系绑在一起，让主角的反击不只是赢输，而是止损。",
      payoff: `公开对峙时成为压垮对抗者心理防线的最后一击。`
    },
    {
      stage: "终局底牌",
      clue: secret,
      appears: "结尾前 15%",
      purpose: "用于二次反转，改写前面所有人物行为的因果。",
      payoff: `最后一场揭示主角早已掌握主动权，并完成${endingMap[input.ending]}`
    }
  ];
}

function buildDramaEpisodes(input, profile) {
  const count = input.length <= 8000 ? 6 : 8;
  const beats = [
    ["开局受辱", `主角在公开场合被迫面对“${input.theme}”，第一秒就让观众知道她被围猎。`, "她发现一处证据和所有人口供对不上。"],
    ["假装崩溃", "主角顺着对方的羞辱低头，实则借机拿到第一份关键材料。", "镜头停在他藏起的证物上。"],
    ["第一反击", "主角用小证据撕开对方谎言，但故意不把底牌亮完。", "对抗者说出一句暴露真实动机的话。"],
    ["嫌疑反转", "关键证人出现，证词看似证明主角判断错了。", "证人私下给主角发来一句求救。"],
    ["公开对峙", "所有利益相关者到场，证据、关系、身份同时碰撞。", "主角亮出终局底牌的一角。"],
    ["终局翻盘", `主角回收伏笔，完成${profile.label}的情绪释放。`, "留下可做番外或第二案的尾钩。"]
  ];

  if (count === 8) {
    beats.splice(3, 0, ["亲密背刺", "最亲近的人站到对立面，让主角付出名声或利益代价。", "主角发现背刺者也只是棋子。"]);
    beats.splice(6, 0, ["代价揭露", "主角揭开自己隐忍的真实原因，让观众理解她为什么不能输。", "对抗者开始转移资产或销毁证据。"]);
  }

  return beats.map(([title, premise, cliffhanger], index) => ({
    episode: index + 1,
    title,
    premise,
    cliffhanger
  }));
}

function scorePlan(input) {
  const tagBonus = Math.min(input.tags.length * 4, 18);
  const hook = Math.min(96, 62 + input.intensity * 3 + tagBonus);
  const twist = Math.min(95, 58 + input.intensity * 2 + (input.ending === "twist" ? 18 : 8));
  const emotion = Math.min(94, 54 + input.intensity * 4);
  const platform = Math.min(97, 68 + tagBonus + (input.length <= 12000 ? 8 : 0));
  const drama = Math.min(95, 60 + input.intensity * 2 + (input.tags.includes("短剧感") ? 16 : 8));
  return [
    ["开篇钩子", hook],
    ["反转力度", twist],
    ["情绪张力", emotion],
    ["盐选适配", platform],
    ["短剧潜力", drama]
  ];
}

function buildDiagnosis(input, scores) {
  const low = scores.reduce((min, item) => (item[1] < min[1] ? item : min), scores[0]);
  if (low[0] === "反转力度") {
    return "建议在第三幕增加一次“看似真凶被确认”的假答案，最后再用一件私人证物推翻它。";
  }
  if (low[0] === "情绪张力") {
    return "建议把关系压迫写得更具体：不要只写背叛，要写钱、名声、亲情或身体处境上的真实损失。";
  }
  if (input.length > 12000) {
    return "当前字数偏长，适合拆成上下篇；如果投短篇，建议把支线人物压缩到 3 个以内。";
  }
  return "结构适合先写 8000 字样章：前 800 字给钩子，3000 字完成第一次反击，6000 字进入真相反转。";
}

function buildPrompt(input, profile, titles, hook, outline, characters, marketBeats, evidenceChain, dramaEpisodes) {
  return [
    "你是一名盐选/盐言风格短篇故事编辑，请基于以下设定生成短篇故事初稿。",
    `故事类型：${profile.label}`,
    `核心矛盾：${input.theme}`,
    `叙事视角：${input.viewpoint === "first" ? "第一人称" : "第三人称"}`,
    `目标字数：${input.length} 字`,
    `情绪强度：${input.intensity}/10`,
    `关键词标签：${input.tags.join("、") || "反转"}`,
    `结局要求：${endingMap[input.ending]}`,
    `风格要求：${profile.tone}`,
    `候选标题：${titles.join(" / ")}`,
    `首段钩子：${hook}`,
    `大纲：${outline.map((item, index) => `${index + 1}. ${item}`).join(" ")}`,
    `人物卡：${characters.map((item) => `${item.role}：${item.name}，${item.motive}`).join(" ")}`,
    `商业卡点：${marketBeats.map((item) => `${item.title}：${item.text}`).join(" ")}`,
    `证据链：${evidenceChain.map((item) => `${item.stage}：${item.clue}，${item.purpose}，回收：${item.payoff}`).join(" ")}`,
    `短剧分集：${dramaEpisodes.map((item) => `第${item.episode}集《${item.title}》：${item.premise} 卡点：${item.cliffhanger}`).join(" ")}`
  ].join("\n");
}

function normalizePlan(plan) {
  const input = plan.input;
  const profile = storyProfiles[input.genre] || plan.profile;
  const hasBrokenText = (items) => Array.isArray(items) && items.some((item) => /undefined|没有先解释|最危险的事实|失踪男友的旧手机|真正的局|只是一个幌子/.test(String(item)));
  const shouldRefreshTemplateText = !plan.schemaVersion || plan.schemaVersion < 6 || hasBrokenText(plan.outline) || hasBrokenText(plan.draft);
  const titles = shouldRefreshTemplateText ? buildTitles(input, profile) : plan.titles || buildTitles(input, profile);
  const hook = shouldRefreshTemplateText ? buildHook(input, profile) : plan.hook || buildHook(input, profile);
  const outline = plan.outline || buildOutline(input, profile);
  const characters = plan.characters || buildCharacters(input, profile);
  const marketBeats = plan.marketBeats || buildMarketBeats(input, profile);
  const evidenceChain = plan.evidenceChain || buildEvidenceChain(input, profile);
  const dramaEpisodes = plan.dramaEpisodes || buildDramaEpisodes(input, profile);
  const draft = shouldRefreshTemplateText ? buildDraft(input, profile, hook) : plan.draft || buildDraft(input, profile, hook);
  const scores = shouldRefreshTemplateText ? scorePlan(input) : plan.scores || scorePlan(input);
  const diagnosis = plan.diagnosis || buildDiagnosis(input, scores);
  const proposalPack = plan.proposalPack || buildSubmissionPack(input, profile, titles, scores, marketBeats);
  const prompt = buildPrompt(input, profile, titles, hook, outline, characters, marketBeats, evidenceChain, dramaEpisodes);

  return {
    ...plan,
    schemaVersion: 6,
    profile,
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
  };
}

function buildPlan(input) {
  const profile = storyProfiles[input.genre];
  if (!profile) return null;
  const titles = buildTitles(input, profile);
  const hook = buildHook(input, profile);
  const outline = buildOutline(input, profile);
  const draft = buildDraft(input, profile, hook);
  const characters = buildCharacters(input, profile);
  const marketBeats = buildMarketBeats(input, profile);
  const evidenceChain = buildEvidenceChain(input, profile);
  const dramaEpisodes = buildDramaEpisodes(input, profile);
  const scores = scorePlan(input);
  const diagnosis = buildDiagnosis(input, scores);
  const proposalPack = buildSubmissionPack(input, profile, titles, scores, marketBeats);
  const prompt = buildPrompt(input, profile, titles, hook, outline, characters, marketBeats, evidenceChain, dramaEpisodes);

  return {
    schemaVersion: 6,
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    input,
    profile,
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
  };
}

// ── 从 app.js 迁入：题材预设与标签云联动更新 ──
// app.js 仅调用此函数，不持有业务逻辑
function updateGenrePresets(genre, autoRandomTheme = true) {
  const themeInput = document.querySelector("#theme");
  const tagCloud = document.querySelector("#tagCloud");

  if (themeInput && typeof inspirationPool !== "undefined" && typeof pick === "function") {
    const pool = inspirationPool[genre];
    if (pool && pool.length > 0 && autoRandomTheme) {
      themeInput.value = pick(pool);
    }
  }

  if (tagCloud && typeof genreTags !== "undefined") {
    const tags = genreTags[genre] || [];
    tagCloud.innerHTML = "";
    tags.forEach((tag, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = idx < 2 ? "tag active" : "tag";
      btn.dataset.tag = tag;
      btn.textContent = tag;
      tagCloud.appendChild(btn);
    });
  }
}
