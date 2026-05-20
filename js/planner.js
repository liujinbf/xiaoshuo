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
  if (input.genre === "suspense" && /死亡通知|失踪男友|手机/.test(input.theme)) {
    return "我是在失踪男友的旧手机里，看见自己的死亡通知的。通知时间写着明天上午九点十七分，而发件人，是我三天前刚报失踪的男友。";
  }
  const matchedHook = Array.isArray(input.matchedInspirations) ? input.matchedInspirations[0]?.hook : "";
  if (matchedHook) {
    return `${P}没有先解释来龙去脉，只把最要命的证据摆到桌上。关于“${theme}”，所有人都以为自己只是在旁观，直到那条线索指向了他们。`;
  }

  const hooks = [
    `${P}第一次意识到事情不对，是在“${theme}”被证实的那一刻。所有人都等着看${her}崩溃，只有${her}知道，${secret}。`,
    `那天${her}发现${secret}时，手里还拿着刚泡好的茶。茶凉了，“${theme}”这件事，却开始烫手了。`,
    `“你以为我不知道？”${P}把手机屏幕扣在桌上。关于“${theme}”，${her}知道的，比他们以为的多得多。`,
    `${P}把那份记录推到桌子中央时，对面的人终于不说话了。关于“${theme}”，最先露出破绽的不是证据，而是他们突然变白的脸。`,
    `${P}没有先争辩，只把录音开到最大声。第一句话响起时，所有人都看向门口，因为“${theme}”里最不该出现的那个人来了。`,
    `签字笔悬在纸上，${P}忽然停住。那一页最底下多出来的名字，让“${theme}”从一场误会变成了有人提前布好的局。`,
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
  const other = input.viewpoint === "first" ? "他们" : "那些人";
  const secret = pick(profile.secrets);
  const theme = sentenceTheme(input.theme);
  const core = compactTheme(input.theme);
  const evidence = pick(profile.secrets, 3);
  const matched = Array.isArray(input.matchedInspirations) ? input.matchedInspirations[0] : null;
  const knowledgeRhythm = matched
    ? `${person}没有把事情从头讲起。最危险的事实已经摆在眼前，剩下的每一个细节，都只是把人往更深的地方推。`
    : "";
  const genreOpenings = {
    history: [
      `${person}把屏幕举起来时，殿里静得只剩烛火噼啪作响。天幕上的字一行行往下滚，写的不是神谕，而是这个王朝后来会付出的代价。`,
      `第一个反应过来的不是皇帝，而是跪在最前面的老臣。他猛地抬头，像是想把“${core}”这几个字从天上抠下来。`
    ],
    rules: [
      `${person}第一次看见那条规则，是在手机电量只剩百分之七的时候。屏幕没有联网，却弹出一行红字：不要相信第二次响起的门铃。`,
      `门铃偏偏在这时响了两次。第一次很轻，像有人试探；第二次贴着门缝，声音近得不像在门外。`
    ],
    suspense: [
      `${person}是在失踪男友的旧手机里，看见那条死亡通知的。通知栏只有一行字：明天上午九点十七分，${person}将被确认死亡。`,
      `手机没有插卡，也没有连网。可那条消息下面，附着一张照片：照片里的${person}站在医院太平间门口，身上穿着今天早上刚换的外套。`
    ],
    revenge: [
      `${person}没有在看到证据的那一刻哭出来。屏幕上那段视频只有三十七秒，却足够把一段婚姻撕开一个干净的口子。`,
      `${other}以为沉默是认输。可${person}知道，真正能让背叛者疼的，从来不是争吵，是证据按顺序落在桌上的声音。`
    ],
    heroine: [
      `${person}走进会议室时，所有人都以为她是来道歉的。投影屏上还停着那份逼她退场的文件，签名栏空着，像一个早就准备好的羞辱。`,
      `${person}拉开椅子坐下，没有碰那支笔。她只是把另一份文件推过去，封面上写着四个字：债权转让。`
    ],
    family: [
      `${person}听见母亲说“都是一家人”时，忽然笑了一下。餐桌上每个人都低着头，只有那本账本摊在中间，把这些年的偏心写得清清楚楚。`,
      `${other}劝${person}别计较。可他们忘了，最伤人的从来不是少分一点钱，而是所有人都默认${person}应该让。`
    ],
    folklore: [
      `${person}回村那晚，雨一直没停。祖祠门口挂着一盏白灯笼，灯油顺着竹骨往下滴，像有人在黑暗里慢慢流血。`,
      `老人们说那是规矩，外来人不能问，年轻人不能碰。可${person}偏偏在灯笼底下，看见了母亲失踪那年留下的红绳。`
    ],
    workplace: [
      `${person}发现那组异常数据时，办公室已经只剩打印机还亮着灯。报表上的数字被改得很干净，干净到像有人提前知道审计会查哪一列。`,
      `${other}第二天就让${person}签离职交接。理由写得冠冕堂皇，可附件里少了一份最关键的底稿。`
    ]
  };
  const openings = genreOpenings[input.genre] || genreOpenings.suspense;

  const firstParagraph = hook.includes("undefined") ? openings[0] : hook;
  const skipFirstOpening = firstParagraph.includes("失踪男友的旧手机里") && openings[0].includes("失踪男友的旧手机里");
  const body = [
    firstParagraph,
    ...(knowledgeRhythm ? [knowledgeRhythm] : []),
    ...(skipFirstOpening ? [] : [openings[0]]),
    openings[1],
    `${person}把和“${theme}”有关的所有细节重新排了一遍，终于发现不对劲的地方：${evidence}。这不是巧合，是有人故意把答案放在最显眼的位置，等${person}自己走进去。`,
    `${other}越是催促，${person}越不能慌。${person}先把原始记录备份，又把时间线写在纸上。每一个看似无关的细节，连起来以后，都指向同一个被藏起来的人。`,
    `到傍晚时，${person}终于明白，自己面对的不是一场误会，而是一场提前排练好的围猎。可这一次，猎物已经看见了绳套。`,
    `这不是终点。从这一刻起，${person}要做的不是解释自己为什么无辜，而是让布置这一切的人，亲口说出真相。`
  ];
  return body.filter((item, index, list) => index === 0 || item !== list[index - 1]);
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
  const hasBrokenText = (items) => Array.isArray(items) && items.some((item) => String(item).includes("undefined"));
  const shouldRefreshTemplateText = !plan.schemaVersion || plan.schemaVersion < 5 || hasBrokenText(plan.outline) || hasBrokenText(plan.draft);
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
    schemaVersion: 5,
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
    schemaVersion: 5,
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
