// ============================================================
// 模块: planner-history-strategy.js — 历史错位赛道策略增强
// ============================================================

const baseBuildMarketBeats = globalThis.buildMarketBeats;
const baseBuildSubmissionPack = globalThis.buildSubmissionPack;
const baseBuildEvidenceChain = globalThis.buildEvidenceChain;
const baseBuildDramaEpisodes = globalThis.buildDramaEpisodes;
const baseScorePlan = globalThis.scorePlan;
const baseBuildPrompt = globalThis.buildPrompt;
const baseBuildHook = globalThis.buildHook;

function isHistoryTrack(input) {
  return input.genre === "history";
}

function historyAnchor(theme) {
  return (theme.match(/秦始皇|李世民|刘禅|朱元璋|嬴政|汉武帝|武则天|曹操|刘备|诸葛亮|皇帝|太子|公主/) || ["历史人物"])[0];
}

globalThis.buildHook = function buildGenreHook(input, profile) {
  if (input.genre === "history") {
    const anchor = historyAnchor(input.theme);
    const crisis = input.theme.includes("直播") ? "天幕" : input.theme.includes("魂穿") ? "亡国倒计时" : "未来史书";
    return pick([
      `${crisis}亮起第一行字时，${anchor}没有问我是谁。他只盯着屏幕上的亡国年份，问：“赵高在哪？”`,
      `我还没来得及解释直播是什么，${anchor}已经让人封了殿门。他指着天幕上的两个字：“亡国，是什么意思？”`,
      `弹幕刷出“大秦十五年而亡”时，殿里所有人都跪了。只有${anchor}抬着头，问我：“证据呢？”`,
      `${anchor}第一次相信天幕，不是因为我讲了近代史，而是三日后的灾祸，和弹幕说的一字不差。`
    ]);
  }
  if (input.genre === "rules") {
    return pick([
      `那个APP删不掉的第七分钟，我收到一条提示：请在今晚十二点前，删除一个活人的名字。`,
      `我第一次违反规则，只是多看了一眼门外的人。第二天，邻居群里少了我的名字。`,
      `十年后的我发来短信：“别信第七条规则。”可墙上的守则，偏偏只有七条。`
    ]);
  }
  return baseBuildHook(input, profile);
};

globalThis.buildMarketBeats = function buildHistoryMarketBeats(input, profile) {
  if (!isHistoryTrack(input)) return baseBuildMarketBeats(input, profile);
  const anchor = historyAnchor(input.theme);
  return [
    {
      title: "冷启动钩子",
      text: `标题和前 100 字必须直接出现“${anchor}”与现代信息差，让算法先把内容推给历史和故事兴趣人群。`
    },
    {
      title: "付费卡点",
      text: "第 1500-2200 字抛出第一个历史死局：亡国倒计时、粮道崩盘、宫变名单或名臣过劳，让读者想看主角怎么改史。"
    },
    {
      title: "短篇快进快出",
      text: "按 2-3 万字完结设计，拆成 10 章左右；单篇数据破万就续写同人物第二部，不行立刻换历史人物。"
    },
    {
      title: "AI优势提醒",
      text: "让模型多用历史制度、人物关系、战争后勤、农业技术和现代知识差，但不要写成考据论文。"
    }
  ];
};

globalThis.buildSubmissionPack = function buildHistorySubmissionPack(input, profile, titles, scores, marketBeats) {
  if (!isHistoryTrack(input)) return baseBuildSubmissionPack(input, profile, titles, scores, marketBeats);
  const anchor = historyAnchor(input.theme);
  return {
    score: Math.round((scores[0][1] + scores[3][1] + scores[4][1]) / 3),
    positioning: [
      { label: "目标读者", text: `历史人物粉、架空爽文读者、喜欢现代知识降维打击的盐言用户。` },
      { label: "付费承诺", text: `用“${anchor}+现代信息差”完成爽点：先让古人看到死局，再用现代知识改写局面。` },
      { label: "编辑卖点", text: "冷启动关键词强、AI可持续产出、章节短平快，适合快速测试多个历史人物。" }
    ],
    pitch: {
      title: titles[0],
      logline: `现代信息闯入历史现场，${anchor}提前看见王朝死局，主角用知识差和制度补丁改写第一场危机。`,
      synopsis: `故事以历史人物遭遇现代信息开局：弹幕、直播、系统或魂穿让${anchor}看见未来失败。前半段用一个具体危机验证信息可信度，中段让旧官僚或既得利益者反扑，高潮以现代农业、工业、军事后勤或制度设计完成第一次改史，结尾抛出更大的历史节点。`,
      editorNote: "建议先写 10 章以内的小闭环：第一部只解决一个王朝死局，不要一上来横跨全史。"
    },
    routes: [
      { name: "盐言短篇测试", speed: "最快", revenue: "数据验证", action: "先投 2-3 万字完结篇，标题保留历史人物名和现代信息差。" },
      { name: "同人物第二部", speed: "快", revenue: "追更复用", action: "首篇播放或阅读破万后，沿用同一历史人物换第二个危机。" },
      { name: "人物矩阵", speed: "可批量", revenue: "模板化生产", action: "秦始皇、李世民、刘禅、朱元璋、汉武帝分别测试，保留数据最好的方向。" }
    ],
    checklist: [
      "标题必须出现高识别历史人物或王朝名。",
      "前三段必须出现现代信息差，不要慢热铺背景。",
      "每章只解决一个具体历史问题：粮食、军备、宫变、后勤、制度。",
      "结尾必须抛出下一场更大的历史危机。"
    ]
  };
};

globalThis.buildEvidenceChain = function buildHistoryEvidenceChain(input, profile) {
  if (!isHistoryTrack(input)) return baseBuildEvidenceChain(input, profile);
  const anchor = historyAnchor(input.theme);
  return [
    { stage: "开篇伏笔", clue: "弹幕里的亡国年份", appears: "前 300 字", purpose: `让${anchor}第一次意识到未来可被预警。`, payoff: "第一场危机兑现后，证明现代信息不是戏言。" },
    { stage: "硬核验证", clue: "现代地图或粮食产量表", appears: "付费卡点前", purpose: "把爽点从口嗨落到可执行方案。", payoff: "中段用数据打脸旧官僚和反对派。" },
    { stage: "人物冲突", clue: "名臣过劳或奸臣名单", appears: "第一次改史后", purpose: "把历史爽点落到具体人物命运。", payoff: "高潮逼出第一批既得利益者。" },
    { stage: "终局尾钩", clue: "下一次王朝级危机预告", appears: "结尾", purpose: "为第二部或下一章建立追读。", payoff: "结尾不总结，直接抛出更大的历史节点。" }
  ];
};

globalThis.buildDramaEpisodes = function buildHistoryDramaEpisodes(input, profile) {
  if (!isHistoryTrack(input)) return baseBuildDramaEpisodes(input, profile);
  const anchor = historyAnchor(input.theme);
  return [
    { episode: 1, title: "天幕开播", premise: `${anchor}第一次看见未来死局，满朝无人敢信。`, cliffhanger: "弹幕说，三日后第一场灾祸就会应验。" },
    { episode: 2, title: "预言应验", premise: "一个小危机精准发生，现代信息可信度暴涨。", cliffhanger: "反对派开始追查主角来源。" },
    { episode: 3, title: "第一道改史令", premise: `${anchor}按现代方案改粮道、军备或官制，立刻触动既得利益。`, cliffhanger: "旧臣递上弹劾奏章。" },
    { episode: 4, title: "名臣减负", premise: "主角用制度拆掉某个历史人物的必死劳局。", cliffhanger: "真正的内鬼名单浮出水面。" },
    { episode: 5, title: "公开打脸", premise: "现代知识在朝堂或战场被验证，反对派当场失势。", cliffhanger: "弹幕刷出下一次亡国级危机。" },
    { episode: 6, title: "第二部尾钩", premise: `${anchor}以为第一局赢了，却发现历史惯性更大。`, cliffhanger: "天幕上出现另一个皇帝的名字。" }
  ];
};

globalThis.scorePlan = function scoreHistoryPlan(input) {
  if (!isHistoryTrack(input)) return baseScorePlan(input);
  const anchorBonus = /秦始皇|李世民|刘禅|朱元璋|汉武帝|武则天/.test(input.theme) ? 12 : 4;
  return [
    ["开篇钩子", Math.min(98, 76 + input.intensity * 2 + anchorBonus)],
    ["反转力度", Math.min(94, 64 + input.intensity * 2)],
    ["情绪张力", Math.min(88, 58 + input.intensity * 2)],
    ["盐选适配", Math.min(99, 78 + anchorBonus)],
    ["短剧潜力", Math.min(97, 72 + input.intensity * 2)]
  ];
};

globalThis.buildPrompt = function buildHistoryPrompt(input, profile, titles, hook, outline, characters, marketBeats, evidenceChain, dramaEpisodes) {
  const prompt = baseBuildPrompt(input, profile, titles, hook, outline, characters, marketBeats, evidenceChain, dramaEpisodes);
  if (!isHistoryTrack(input)) return prompt;
  return [
    prompt,
    "",
    "【历史错位赛道加成】",
    "1. 标题、前三段和第一章结尾必须反复强化历史人物名和现代信息差。",
    "2. 正文第一句必须从天幕、弹幕、亡国年份、赵高/刘禅/粮道危机等具体场面切入，禁止“事情发生在”和标题复述。",
    "3. 不要写成历史讲解，要让现代知识立刻改变一个具体危机。",
    "4. 弹幕只保留能制造压力的信息，不要写玩梗水弹幕。",
    "5. 现代端和古代端必须分清：主角在现代屏幕前，历史人物在朝堂/宫殿端。",
    "6. 每 800-1200 字给一次爽点：预言应验、朝堂打脸、名臣命运改变、制度漏洞被补上。",
    "7. 按 2-3 万字完结设计，十章以内完成第一部小闭环，结尾可挂第二部。"
  ].join("\n");
};
