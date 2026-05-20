// ============================================================
// 模块: planner-submission.js — 投稿包构建逻辑
// 从 planner.js 拆分，依赖全局 endingMap（来自 data.js）
// ============================================================

function buildSubmissionPack(input, profile, titles, scores, marketBeats) {
  const scoreMap = Object.fromEntries(scores);
  const primaryTitle = titles[0];
  const paidBeat = marketBeats.find((item) => item.title === "付费卡点") || marketBeats[1];
  const dramaBeat = marketBeats.find((item) => item.title === "短剧化卖点") || marketBeats[2];
  const monetizationScore = Math.round((scoreMap["开篇钩子"] + scoreMap["盐选适配"] + scoreMap["短剧潜力"]) / 3);

  const loglines = {
    history: `当包含"${input.theme}"的异象降临，现代信息与古代皇权正面交锋，掀起一场改写大历史的降维打击。`,
    rules: `一份违背常识的诡异守则，一个被谎言与污染笼罩的死局，主角必须在"${input.theme}"的绝境中寻得一线生机。`,
    suspense: `一起由"${input.theme}"牵引出的陈年旧案，每个人的证词都完美无缺，而那份被修改的致命物证才是破局关键。`,
    revenge: `经历过亲密关系的背叛与公开羞辱后，主角带着关于"${input.theme}"的致命底牌，开启一场合法且致命的夺产复仇。`,
    heroine: `在被世俗偏见与家族势力联手排挤后，主角用关于"${input.theme}"的顶级商业底牌，完成对权势阶层的华丽降维逆袭。`,
    family: `以"${input.theme}"为导火索，撕开看似温情脉脉的家庭关系下，最真实、最刺痛的偏心与利益争夺。`,
    folklore: `祠堂雨夜的灯影，枯井下的怨声，关于"${input.theme}"的民俗禁忌背后，隐藏着一桩被全村联手掩盖了数十年的血债真相。`,
    workplace: `身处被无良资本与潜规则压制的底层，主角凭借一份关于"${input.theme}"的硬核合规证据，向职场霸凌者发起致命一击。`
  };

  const synopses = {
    history: `现代信息骤然传入古代，引来满朝震动与既得利益阶层的疯狂反扑。主角利用领先千年的现代知识与系统底牌，层层破局，在封建帝王与世家大族面前完成最硬核的科技救国打脸。`,
    rules: `主角无意间卷入充满诡异规则的禁忌空间，身边的规则与熟人皆不可信。中段在违规边缘试探、利用逻辑悖论瓦解规则的死锁，高潮处反向布局、破除污染源，揭示出关于规则源头的惊人反转。`,
    suspense: `主角被卷入一桩离奇谜案，面对层层伪装的口供与刻意布置的现场。中段通过微小破绽撕开谎言，反套路引蛇出洞，在高潮公开对峙中实现证据、身份的双重反转，指明意想不到的真凶。`,
    revenge: `主角遭遇伴侣与第三者的无耻联合背叛，资产与名誉位列深渊。主角表面隐忍麻痹对手，暗中进行周密的财务与证据收集，最终在关键时刻公开亮出底牌，让背叛者付出名声与金钱的双重沉痛代价。`,
    heroine: `主角在公开场合遭遇轻视与排挤，被剥夺应得利益。她隐忍潜伏，以极低姿态精准收集对手漏洞，暗中布局整盘商战。高潮处身份与股权强势爆开，降维打击所有看客，重建全新秩序。`,
    family: `一件看似微不足道的家庭纠纷，彻底引爆了长期积累的重男轻女与资产不公。亲戚的站队与父母的偏袒将主角逼至绝境，主角清醒斩断道德绑架，亮出证据并做出不再牺牲的决裂选择，痛快夺回尊严。`,
    folklore: `主角回到阴冷封闭的乡土古镇，遭遇一系列诡异莫测的民俗禁忌与仪式。随着调查深入，发现村民口中的"神惩"其实是掩盖多年前罪恶的遮羞布。高潮处主角打破陈规，揭露人性伪装，逼出当年真相。`,
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
      { label: "目标读者", text: audienceMap[input.genre] || audienceMap.suspense },
      { label: "付费承诺", text: `用"${input.theme}"制造强冲突，前半段让主角陷入劣势，后半段用证据反击完成${profile.label}爽点。` },
      { label: "编辑卖点", text: `题材明确、人物关系集中、卡点清楚；${paidBeat.text}` }
    ],
    pitch: {
      title: primaryTitle,
      logline: loglines[input.genre] || loglines.suspense,
      synopsis: synopses[input.genre] || synopses.suspense,
      editorNote: `建议先投 ${input.length <= 10000 ? "8000 字左右完整短篇" : "上下篇连载样章"}，标题保留强事件词，正文每 600-900 字推进一次证据或关系变化。`
    },
    routes: [
      { name: "盐选/盐言投稿", speed: "中速", revenue: "稿费或买断", action: "先完成 3000 字样章、完整大纲和结尾反转说明。" },
      { name: "短剧样稿包", speed: "较快", revenue: "样稿售卖或改编沟通", action: dramaBeat.text },
      { name: "模板商品化", speed: "最快", revenue: "售卖选题卡、证据链表和改稿清单", action: "把标题、钩子、证据链和分集节拍拆成可复用模板。" }
    ],
    checklist: [
      "前 300 字必须出现公开冲突或异常证据。",
      "付费卡点前只揭开一半真相，保留反击问题。",
      "结尾回收至少 2 条伏笔，避免只靠口头解释翻盘。",
      "投稿前准备 80 字简介、300 字梗概和完整结局说明。"
    ]
  };
}
