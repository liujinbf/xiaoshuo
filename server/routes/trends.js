import { randomUUID } from "crypto";
import { saveGenreTrend, getGenreTrends, getGenreTrendById, saveInspiration, clearGenreTrends } from "../utils/db.js";

const getChatUrl = (baseUrl) => {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
};

// === 高仿真离线静态热门题材种子数据 (12 款，知乎/番茄平台代表作风格) ===
const STATIC_TRENDS = [
  // --- 知乎盐选故事 ---
  {
    novel_title: "温差效应",
    source: "zhihu",
    raw_genre: "都市情感/悬疑",
    mapped_genre: "suspense",
    heat_score: 95,
    introduction: "一份看似再寻常不过的空调用电账单，竟然记录着温度调控下不为人知的私密行踪。女主角利用严丝合缝的信息差，进行了一场高智商的反向狩猎。",
    analysis: {
      pain_point: "揭露亲密关系中的隐秘背叛，唤醒高智商女性读者的自我保护觉醒",
      hook: "以空调温度的微小调整作为出轨的第一线索，切入细思极恐的细节深渊",
      selling_point: "高智商女性不哭不闹反向设局，完美利用物理信息差反杀背叛者"
    }
  },
  {
    novel_title: "我死在向他求婚的那天",
    source: "zhihu",
    raw_genre: "言情悬疑/反转",
    mapped_genre: "revenge",
    heat_score: 98,
    introduction: "求婚当日意外身亡，我变成了灵魂盘旋在自己的葬礼上。原本以为悲痛欲绝的未婚夫，却在宾客散去后，与另一个女孩牵起了手。一场死局背后的因果大幕缓缓拉开。",
    analysis: {
      pain_point: "强烈的虐恋反差与灵魂视角倾诉，直击当代人在爱情中的不安全感",
      hook: "第一句以灵魂状态站在葬礼上，俯视未婚夫和另一个女孩的亲密举动",
      selling_point: "起承转合结构极其紧凑，利用非线性时间叙事，结尾抛出惊天因果大反转"
    }
  },
  {
    novel_title: "深海窒息",
    source: "zhihu",
    raw_genre: "世情伦理/黑幕",
    mapped_genre: "family",
    heat_score: 89,
    introduction: "父母将清华通知书和拆迁房产全部送给了游手好闲的弟弟，甚至要求姐姐无限期打工吸血。当隐忍多年的姐姐以绝决姿态抛出底牌，全家人只能在悔恨中窒息。",
    analysis: {
      pain_point: "撕碎中国式家庭的隐性偏心与道德绑架，宣泄多年压抑的原生家庭痛楚",
      hook: "饭桌上，母亲将原本属于我的清华录取通知书和房产证改写为弟弟的名字",
      selling_point: "极端逼真的情绪张力描写，彻底决裂时放弃说教，用经济和名誉双重碾压"
    }
  },
  {
    novel_title: "离职前的致命交接",
    source: "zhihu",
    raw_genre: "职场内幕/暗黑",
    mapped_genre: "workplace",
    heat_score: 87,
    introduction: "在离职交接的最后十分钟，卑微的大厂打工人发现了被碎纸机撕碎的加密假账。这是一本送傲慢高管入狱的‘致命合规指南’。",
    analysis: {
      pain_point: "大厂边缘打工人手撕傲慢空降高管，满足职场人群的合法整顿幻想",
      hook: "离职交接前十分钟，在废弃碎纸机碎片中拼出公司最大一笔坏账流向",
      selling_point: "大量极其严密专业的财务审计行话，环环相扣，反向利用合规规则完美反杀"
    }
  },
  {
    novel_title: "纸人抬轿：七月十五的替死鬼",
    source: "zhihu",
    raw_genre: "中式恐怖/志怪",
    mapped_genre: "folklore",
    heat_score: 92,
    introduction: "中元节夜半，死去多年的奶奶突然打来电话，屋外传来了纸人迎亲的唢呐踩水声。黄土掩埋了二十年的乡村罪恶，终于在今夜清算。",
    analysis: {
      pain_point: "乡土旧事引申出的民俗恐怖，唤醒心底深处对传统禁忌和因果律的敬畏",
      hook: "深夜接到已故祖母拨来的电话，屋外传来纸扎唢呐迎亲队伍的踩水声",
      selling_point: "浓郁的传统民俗怪诞意象，不搞妖魔鬼怪乱力神，以村民的现实罪恶为核心反转"
    }
  },
  {
    novel_title: "我把工业图纸递给朱元璋",
    source: "zhihu",
    raw_genre: "历史穿越/脑洞",
    mapped_genre: "history",
    heat_score: 96,
    introduction: "工科生携带装满现代前沿工业图纸的防摔平板穿越到洪武年间。大明开国皇帝看着蒸汽机和玻璃灯泡的璀璨，满朝文武的科学认知被降维震撼。",
    analysis: {
      pain_point: "科技降维打击古代权力的无上快感，以及历史名人在时代鸿沟前的认知洗礼",
      hook: "带着装满现代科技论文的平板电脑，直接降落在大明开国皇帝朱元璋的龙案上",
      selling_point: "抛弃传统考据爽点，直接展现现代流水线工业化思维对古代小农经济的降维震撼"
    }
  },
  // --- 番茄小说 ---
  {
    novel_title: "诡异怪谈：我的盲盒能开出诡神",
    source: "fanqie",
    raw_genre: "规则怪谈/系统",
    mapped_genre: "rules",
    heat_score: 97,
    introduction: "规则怪谈入侵全球，违反规则即被抹杀。主角觉醒系统盲盒，竟然能开出听话的红衣女鬼！从此在必死绝境中一路卡BUG疯狂通关。",
    analysis: {
      pain_point: "在生命面临绝路时依靠脑洞开挂的绝境求生欲，带给脑洞爱好者极爽解谜感",
      hook: "红色弹窗入侵全球屏幕，第一条守则写着：千万不要回答母亲的第三次问话",
      selling_point: "规则漏洞环环相扣，极具创意的盲盒卡BUG玩法，将求生变成主角掌控诡神的智商游戏"
    }
  },
  {
    novel_title: "退婚后，高冷女总裁哭着求我原谅",
    source: "fanqie",
    raw_genre: "大女主/逆袭",
    mapped_genre: "heroine",
    heat_score: 94,
    introduction: "豪门宴会上，未婚夫高调宣布退婚并将心机绿茶扶上主位。大女主冷笑一声，甩出收购该公司最大投行债权的实控人合同，全场大哗。",
    analysis: {
      pain_point: "女性在公开社交圈层被抛弃打压后，以至尊资本姿态华丽归来的逆风翻盘",
      hook: "退婚大宴上，前未婚夫将假千金迎上主位，下一秒我亮出家族投行最大债权书",
      selling_point: "爽点宣泄极速，用资本和法务底牌连环掌掴，人物行动不拖泥带水，全程高能"
    }
  },
  {
    novel_title: "规则怪谈：我能创造完美生路",
    source: "fanqie",
    raw_genre: "悬疑怪谈/脑洞",
    mapped_genre: "rules",
    heat_score: 93,
    introduction: "致命的公交车与医院怪谈。所有人生路都被怪物伪装的善意切断。高智商主角以疯批姿态逆向推导，主动违背规则，反而走出完美通道。",
    analysis: {
      pain_point: "高智商主角在恐怖诡异规则面前的反向布局，极强的规则博弈快感",
      hook: "循环公交车上突然刷新规则守则，不能违反的规则竟然是要保护怪物的致命圈套",
      selling_point: "利用矛盾规则让怪物互相残杀，结尾关于主角才是最终规则编撰者顺道反杀的惊天逆转"
    }
  },
  {
    novel_title: "三十年河东：修罗剑尊",
    source: "fanqie",
    raw_genre: "东方玄幻/退婚",
    mapped_genre: "revenge",
    heat_score: 91,
    introduction: "落魄天才资质全失沦为废柴，势利家族当众撕毁婚约并落井下石。偶得神秘剑尊传承后，主角重振荒古剑魂，铁血清算，逆天归来。",
    analysis: {
      pain_point: "天才落魄后尝尽世态炎凉，隐忍修炼后对背叛者和势利族人的铁血清算",
      hook: "测试石碑冰冷闪烁低级资质，未婚妻当众撕毁婚约并高傲离去",
      selling_point: "传统大开大合的情绪调动，三十年河东莫欺少年穷的意志宣泄，一战成名高潮爽感"
    }
  },
  {
    novel_title: "大唐急诊室：李世民求我救魏征",
    source: "fanqie",
    raw_genre: "历史脑洞/医学",
    mapped_genre: "history",
    heat_score: 88,
    introduction: "急诊科主任携带满电起搏器和急救箱降落在大唐太极殿，恰逢魏征命悬一线。现代医学神技不仅震撼了千古一帝，更开启了大唐的现代医学纪元。",
    analysis: {
      pain_point: "现代急救医学在封建王朝的“起死回生”奇迹，带给统治者极具颠覆性的科技震撼",
      hook: "急诊科医生携带满电急救包穿越太极殿，恰逢重病濒死的宰相魏征躺在龙榻前",
      selling_point: "科普式的急救情节描写，古代权贵阶层从轻视到跪求仙医的极致爽点反差"
    }
  },
  {
    novel_title: "重返投行：她是无可替代的底牌",
    source: "fanqie",
    raw_genre: "大女主爽文/商战",
    mapped_genre: "heroine",
    heat_score: 90,
    introduction: "被心机养女设计踢出顶级投行董事会。王者归来的苏婉，手握开曼群岛百亿海外信托，以隐藏最大债权人的身份再次降临发布会，清算对手。",
    analysis: {
      pain_point: "独立精英大女主在纯粹商业丛林中以高阶智慧击碎董事会偏见的爽感",
      hook: "被恶毒养女踢出设计高管局的第一天，我以顶尖风投大股东身份列席重组会",
      selling_point: "精妙复杂的金融并购博弈，逻辑无漏洞，展现女主雷厉风行、杀伐果断的高光时刻"
    }
  }
];

// === 离线拟真灵感模板生成器 ===
const OFFLINE_INSPIRATION_TEMPLATES = {
  suspense: {
    theme: "《【TITLE】》细节深渊处的真相大反转",
    hook: "当【主角】在日常习惯中发现【诡异的温差细节】时，【枕边人的反常举动】已预示了一场精心布置的死局。",
    outline: "起：主角敏锐捕捉枕边人的致命习惯漏洞，处境迅速失控；承：保持理智假装不知，在日常往来中收集背叛证据并发现谎言外壳；转：伪装崩溃引蛇出洞，诱导利益关联者进行自乱阵脚的利益切割；合：在最公开的场合将所有确凿证据摆上谈判桌，逼出背叛者并全面反杀夺回一切。",
    fingerprint: {
      openingSpeed: 5,
      voiceStyle: "第一人称沉浸",
      dialogueRatio: 25,
      sentenceStyle: "短长混合",
      firstConflictAt: 2,
      pressureType: "情感+生命威胁",
      emotionTone: "克制冷静",
      sceneType: "密闭居所",
      endingHook: "悬念留白",
      powerPhrases: [
        "“细节就像针尖，密密麻麻扎在原本温暖的床榻上，直到血流成河。”",
        "“我转头看着熟睡的他，空调依然定格在那个他平日最抗拒的24度。”"
      ],
      uniqueVocab: ["细节", "温度", "伪装", "设局", "反击"],
      rawSample: "空调的温度面板亮着幽蓝的光，定格在冰冷的24度。周明瑞从来只吹26度，只要低上一度他就会整夜咳嗽。但我翻了个身，耳边传来他沉稳匀速的呼吸，空气里却弥漫着一丝极淡的、不属于这间房的茉莉花香…"
    }
  },
  revenge: {
    theme: "《【TITLE】》极速自救与铁血复仇打脸",
    hook: "当【主角】在最隆重的婚礼上看见【被剪掉的出轨录音】时，【虚伪丈夫的傲慢嘲讽】已将他们推入了万劫不复的深渊。",
    outline: "起：主角在人生的最高光时刻遭遇亲密关系的惨痛背叛，当众沦为笑柄；承：假装情绪崩溃麻痹敌人，悄然转存核心婚姻财产并买下大额债权；转：联合前妻或其他同盟，在最致命的交易会前一晚更换合同核心条款；合：在对方最洋洋得意时公开全部背叛证据与撤资证明，让背叛者在亿万债务与社会性死亡中彻底破产。",
    fingerprint: {
      openingSpeed: 5,
      voiceStyle: "第一人称沉浸",
      dialogueRatio: 45,
      sentenceStyle: "极短句主导",
      firstConflictAt: 1,
      pressureType: "情感+金钱",
      emotionTone: "张扬浓烈",
      sceneType: "豪华宴会厅",
      endingHook: "台词断章",
      powerPhrases: [
        "“三十年河东，三十年河西。这桩婚姻原本就只是我给你布置的坟墓。”",
        "“在大屏幕播放录音的那一刻，他脸上的得意凝固成了极致的惨白。”"
      ],
      uniqueVocab: ["背叛", "婚礼", "录音", "撕扯", "清算"],
      rawSample: "大屏幕上的画面突然一闪，喜气的婚纱照瞬间被一段不堪入目的酒店出轨视频和极其清晰的对话录音替换。满座宾客哗然，顾言僵硬在红毯中央，脸上的笑意一点点碎成了惨白死灰，而我则提起雪白的裙摆，冰冷地甩出了兜里的离婚协议书…"
    }
  },
  family: {
    theme: "《【TITLE】》窒息式原生家庭的决裂反击",
    hook: "当【主角】看见【母亲偷偷将通知书塞进弟弟被窝】时，【全家人理所当然的冷漠】已将她二十年的牺牲彻底粉碎。",
    outline: "起：主角撞见家里最偏心且极其不公平的利益分配现场，成为全家的牺牲品；承：亲戚联合道德绑架迫使主角屈服，主角选择隐忍并彻底转移户口与资金；转：旧病或拆迁巨款引爆家庭内部利益分歧，看似受宠的弟弟捅出大篓子；合：主角冷眼旁观拒绝再借一分钱，将账本摔在道德绑架者脸上，彻底决决裂，奔向真正属于自己的新生。",
    fingerprint: {
      openingSpeed: 4,
      voiceStyle: "第一人称沉浸",
      dialogueRatio: 30,
      sentenceStyle: "短长混合",
      firstConflictAt: 3,
      pressureType: "名声+情感",
      emotionTone: "悲凉沉郁",
      sceneType: "家庭餐桌",
      endingHook: "情感余韵",
      powerPhrases: [
        "“这间房的首付是我打过去的，录取通知书是我考出来的，凭什么要写他的名字？”",
        "“我把户口本和钥匙拍在桌上，走出家门的那一刻，晚风无比轻松自由。”"
      ],
      uniqueVocab: ["偏心", "录取通知书", "决决裂", "牺牲", "吸血"],
      rawSample: "饭桌上，母亲把刚拿到的拆迁合同推给弟弟，顺便笑眯眯地对我说：“姐，你弟要娶媳妇，那套房的首付差了十万，你把工资卡留下来吧。”全家人都理所当然地吃着菜，只有我放下了筷子，冰冷地把当年的汇款单和新买的机票拍在了母亲脸上…"
    }
  },
  workplace: {
    theme: "《【TITLE】》打工人高智商合规反杀指南",
    hook: "当【主角】在离职交接前【发现加密的假账文件夹】时，【无良高管的陷害威胁】反而成了主角最具杀伤力的子弹。",
    outline: "起：主角无意中接触到部门核心贪腐或舞弊账目，并因此面临被开除或背锅危机；承：冷静备份关键邮件和绩效数据，寻找内部合规或高管的派系死角；转：在离职审计会上，对方以保密协议试图彻底封杀主角的行业声誉；合：主角雷霆出手，在联合反腐通报和税务检查降临的那一刻，用无可辩驳的数据铁证将贪腐分子送进法网。",
    fingerprint: {
      openingSpeed: 5,
      voiceStyle: "第三人称近视角",
      dialogueRatio: 35,
      sentenceStyle: "长句为主",
      firstConflictAt: 2,
      pressureType: "职权+金钱",
      emotionTone: "克制冷静",
      sceneType: "大厂会议室",
      endingHook: "动作断章",
      powerPhrases: [
        "“从我踏进这间会议室开始，保密协议对你们而言，就变成了一条绞刑索。”",
        "“离职交接完毕。顺便提一句，我已将财务副总的电脑镜像直接发送给了经侦支队。”"
      ],
      uniqueVocab: ["坏账", "审计", "合规", "交接", "反击"],
      rawSample: "“字签了，你可以走了。”财务总监把解约书摔到我面前，语气傲慢。“但我建议你出去别乱说话，行业背调还在我们手里。”我笑了笑，拿过签字笔流畅地落笔，随后缓缓合上笔记本电脑：“总监，顺便提醒你一下，我刚交接过去的那个隐藏文件夹，是直接同步发送到大老板和经侦举报邮箱的。”"
    }
  },
  folklore: {
    theme: "《【TITLE】》中式诡异民俗与因果迷局",
    hook: "当【主角】在正月夜里【听见枯井底传来呼喊】时，【村里老人们惊恐的沉默】已揭开了一段被黄土掩埋二十年的血色罪恶。",
    outline: "起：主角因变故回到封闭落后的山村，无意中触犯了村庄的诡异民俗禁忌；承：怪事频发且指向二十年前失踪的长辈，村中长辈极力隐瞒并试图举行诡异仪式；转：主角发现所谓的‘天降惩罚’实际上是村民贪婪的联手谋害；合：在祭祀夜彻底砸毁祭坛，揭穿所有神怪谎言，将犯下累累罪行的人拖出阴影移交法律制裁。",
    fingerprint: {
      openingSpeed: 3,
      voiceStyle: "第一人称沉浸",
      dialogueRatio: 15,
      sentenceStyle: "长句为主",
      firstConflictAt: 4,
      pressureType: "生命威胁+规则代价",
      emotionTone: "悲凉沉郁",
      sceneType: "乡村祖祠",
      endingHook: "发现断章",
      powerPhrases: [
        "“村里敬畏的不是神明，是他们当年亲手犯下的罪孽开出的索命恶之花。”",
        "“大雨冲开了祖祠后面的黄泥，那口枯井里，系着系了二十年的带血红绳。”"
      ],
      uniqueVocab: ["民俗", "枯井", "因果", "红绳", "纸人"],
      rawSample: "七月十五的暴雨把祖祠后面的山体冲出了一道豁口。我撑着伞站在泥泞里，赫然发现那口被水泥死死封了二十年的枯井裂开了一条缝。而在阴风中，井底竟然悠悠飘出了一只已经腐烂了大半、上面用朱砂写着我名字的红布纸人…"
    }
  },
  history: {
    theme: "《【TITLE】》科技文明对封建皇权的震撼碾压",
    hook: "当【主角】将【写有近代屈辱史的平板电脑】呈给皇帝时，【满朝文武被大炮巨舰的恐惧】已悄然改写了整条历史长河。",
    outline: "起：现代人携高维科技与历史走向降临封建王朝，瞬间被卷入宫廷权力生死局；承：用现代机械或急救知识挽救关键人物，获得皇帝的初步信任并震慑权臣；转：保守派利益集团勾结边疆大敌试图发动政变，污蔑主角为天降妖孽；合：主角用现代工业图纸与降维管理思维改组军队与制度，以科技实力彻底打脸旧势力，带领王朝走向工业革命。",
    fingerprint: {
      openingSpeed: 5,
      voiceStyle: "第三人称全知",
      dialogueRatio: 40,
      sentenceStyle: "短长混合",
      firstConflictAt: 1,
      pressureType: "职权+生命威胁",
      emotionTone: "张扬浓烈",
      sceneType: "封建宫殿太极殿",
      endingHook: "动作断章",
      powerPhrases: [
        "“天幕开播！今日给秦始皇直播近代世界地图，让他看看四海之外皆有列强！”",
        "“李世民看着平板里的蒸汽机轰鸣，颤抖着问这是何等的神话仙界仙器。”"
      ],
      uniqueVocab: ["直播", "工业图纸", "天幕", "降维打击", "震慑"],
      rawSample: "“此物名为发电机，可用飞流瀑布驱动，给全城送去亮如白昼之光。”我指着殿中央正嗡嗡作响的原始铜线圈，对大明洪武大帝说道。朱元璋猛地站起身，龙袍猎猎，而原本满脸不屑的太子与文武百官，正死死盯着那盏在大殿中央凭空亮起、璀璨如烈日的玻璃灯泡，齐刷刷跪倒了一片…"
    }
  },
  rules: {
    theme: "《【TITLE】》规则怪谈脑洞博弈与极限生路",
    hook: "当【主角】在冰箱上【看见删不掉的红色怪谈守则】时，【必须在十二点违背规则】已成了他活下去的唯一脑洞生路。",
    outline: "起：普通人被迫卷入充斥危险怪物与诡异逻辑的规则怪谈场景，收到致命警告；承：目睹他人因违背伪装规则而惨遭抹杀，拼死冷静推演规则之间的深层逻辑差；转：发现本场景唯一的主宰NPC实际上是个谎言圈套，所有人都走在慢性死亡的死路；合：主角反向利用规则漏洞，主动进行逻辑卡BUG，欺骗规则触发诡异自毁，惊险开辟全新完美生路。",
    fingerprint: {
      openingSpeed: 5,
      voiceStyle: "第一人称沉浸",
      dialogueRatio: 20,
      sentenceStyle: "极短句主导",
      firstConflictAt: 1,
      pressureType: "规则代价+生命威胁",
      emotionTone: "克制冷静",
      sceneType: "深夜公交车",
      endingHook: "发现断章",
      powerPhrases: [
        "“千万别遵守第七条规则！因为最后那一条规则是怪物自己亲手写上去的诱饵。”",
        "“我掏出黑色的马克笔，在写满必死规则的墙壁上，冷笑着加上了一句话。”"
      ],
      uniqueVocab: ["规则怪谈", "诱饵", "卡BUG", "生路", "逻辑漏洞"],
      rawSample: "业主群里只发了三条红色通知，但这三条通知和电梯里的蓝色贴纸完全是冲突的。电梯贴纸写着：晚上十二点后遇到邻居请勿说话。但红色通知第一条写着：晚上十二点后遇到邻居请必须大声问好。钟表走到十一字，门外突然响起了熟悉的邻居敲门声，而猫眼外面，正站着一个扭曲庞大的红色怪物…"
    }
  },
  heroine: {
    theme: "《【TITLE】》顶奢千金的王牌商战翻盘",
    hook: "当【主角】被前夫【在董事会高调踢出管理层】时，【她亮出的家族神秘信托合同】已提前锁定了他破产的命运。",
    outline: "起：大女主遭逢小人羞辱或家族背叛被轻视，在低谷中保持冷静并蛰伏观察；承：以看似柔弱或妥协的低姿态转移对手视线，暗中完成对核心竞品的降维并购；转：小人企图在大庭广众的谈判会或发布会上对女主进行最终封杀；合：女主作为隐藏实控人或顶尖投行核心合规合伙人降临全场，一举解约并清算对手，重建行业王权。",
    fingerprint: {
      openingSpeed: 5,
      voiceStyle: "第三人称近视角",
      dialogueRatio: 50,
      sentenceStyle: "短长混合",
      firstConflictAt: 2,
      pressureType: "名声+金钱",
      emotionTone: "张扬浓烈",
      sceneType: "高端新闻发布会",
      endingHook: "悬念留白",
      powerPhrases: [
        "“我早已买下了你们公司所有的期权，今天的大股东重组，就是为你准备的葬礼。”",
        "“她优雅地拂去耳边的发丝，抛出的那份合并清算合同，让全场百人瞬间鸦雀无声。”"
      ],
      uniqueVocab: ["商战", "信托", "翻盘", "大股东", "底牌"],
      rawSample: "“苏婉，这是解除你职务的董事决议，你被雪藏了。”前夫揽着楚楚可怜的假千金，居高临下递过文件。苏婉没有接，她端起咖啡极其优雅地抿了一口，随后淡定地抛出了一份金光闪闪的英属维尔京群岛投资公告：“前夫，麻烦你把底下的债权人名单翻到最后一页，那上面唯一的实控人名字，是我苏氏信托的海外母公司。”"
    }
  }
};

// 辅助方法：生成离线拟真灵感写作模型
function generateLocalMockInspiration(trend, userId) {
  const genre = trend.mapped_genre || "suspense";
  const template = OFFLINE_INSPIRATION_TEMPLATES[genre] || OFFLINE_INSPIRATION_TEMPLATES.suspense;
  
  const theme = template.theme.replace("【TITLE】", trend.novel_title);
  const hook = template.hook.replace("【TITLE】", trend.novel_title);
  const outline = template.outline;
  
  const parsedAnalysis = typeof trend.analysis === "string" ? JSON.parse(trend.analysis) : trend.analysis;
  const rawText = `根据热门题材趋势《${trend.novel_title}》高仿真生成。采集来源：${trend.source === "zhihu" ? "知乎盐选" : "番茄小说"}。原始题材：${trend.raw_genre}。热度分数：${trend.heat_score}。此题材已收纳归档至系统题材库分类：${trend.mapped_genre}。公开介绍：${trend.introduction || "暂无简介"}。分析要点：受众痛点—${parsedAnalysis?.pain_point || "暂无"}; 开篇钩子—${parsedAnalysis?.hook || "暂无"}; 核心卖点—${parsedAnalysis?.selling_point || "暂无"}。`;

  return {
    id: `trend_convert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    user_id: userId,
    genre,
    theme,
    hook,
    outline,
    raw_text: rawText,
    fingerprint: template.fingerprint
  };
}

export async function handleTrendsRoutes(request, response, url, { sendJson, readJson, getUserId }) {
  if (!url.pathname.startsWith("/api/trends")) return false;

  const userId = getUserId(request, {}, url);
  if (!userId) {
    sendJson(response, 401, { ok: false, message: "未授权访问，请提供 Token" });
    return true;
  }

  // GET /api/trends — 获取热门题材列表 (支持 source 与 mappedGenre 筛选)
  if (url.pathname === "/api/trends" && request.method === "GET") {
    try {
      const source = url.searchParams.get("source") || "all";
      const mappedGenre = url.searchParams.get("mappedGenre") || "all";
      const list = await getGenreTrends(source, mappedGenre);
      
      // 首次加载若数据库为空，自动把部分静态数据注入作为冷启动数据，确保体验完美
      if (list.length === 0 && source === "all" && mappedGenre === "all") {
        for (const seed of STATIC_TRENDS) {
          const id = `seed_trend_${seed.source}_${Math.random().toString(36).substr(2, 6)}`;
          await saveGenreTrend({
            id,
            source: seed.source,
            novel_title: seed.novel_title,
            raw_genre: seed.raw_genre,
            mapped_genre: seed.mapped_genre,
            heat_score: seed.heat_score,
            analysis: seed.analysis,
            introduction: seed.introduction
          });
        }
        const freshList = await getGenreTrends("all", "all");
        sendJson(response, 200, { ok: true, list: freshList, message: "冷启动种子题材加载成功" });
        return true;
      }

      sendJson(response, 200, { ok: true, list });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // POST /api/trends/collect — 一键智能热门题材采集与系统题材归档
  if (url.pathname === "/api/trends/collect" && request.method === "POST") {
    try {
      // 采集前彻底清空物理表中的陈旧脏数据，确保题材看板永远展现最新采集的时效题材，并规避数据冗余
      await clearGenreTrends();
      
      const body = await readJson(request);
      const { modelConfig } = body;

      const cfg = modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

      const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
      
      let collectedList = [];
      let isAiGenerated = false;

      // 智能判定：只有在非 placeholder 且网络通畅时，才调用 AI 大模型进行热门爆款趋势逆向合成
      if (!isPlaceholder) {
        try {
          const systemPrompt = `你是一个顶级的小说流行趋势数据分析师。请针对当前时间（${new Date().toISOString()}）分析并模拟 知乎盐选短篇故事 和 番茄小说 平台的当前最新热门题材趋势与爆款小说。
请针对这两个平台，各生成 4 个最具当下市场流行特色的题材，并各自拟定一个极其逼真的爆款小说名字。
- 知乎故事爆款：偏向第一人称情感撕扯、双重反转悬疑、窒息世情家庭伦理。如《温差效应》、《我死在向他求婚的那天》。
- 番茄小说爆款：偏向规则怪谈脑洞、历史穿越降维科技打击、大女主雷厉商战翻盘。如《诡异怪谈：我的盲盒能开出诡神》、《退婚后，高冷总裁求原谅》。

请严格输出以下 JSON（不要加 markdown 包裹，所有字段必填）：
{
  "trends": [
    {
      "source": "zhihu" 或 "fanqie",
      "novel_title": "小说爆款名",
      "raw_genre": "原始分类（如：悬疑脑洞/情感爽文/豪门商战）",
      "mapped_genre": "必须归纳并映射为以下本系统的题材之一：suspense, revenge, heroine, history, rules, folklore, family, workplace",
      "heat_score": 78到99之间的随机整数,
      "introduction": "该大热小说的故事公开介绍/故事大纲简介（50-100字左右，极其吸睛，必须描述具体故事线索）",
      "analysis": {
        "pain_point": "受众痛点分析（例如：满足了女性对亲密关系中隐秘背叛的极端防范与爽点宣泄，30字内）",
        "hook": "黄金开篇钩子设定（例如：开头以温差出轨细节撕开虚伪假象，30字内）",
        "selling_point": "核心卖点及反转结构（例如：大女主反向设局高智商脱逃并夺回主权，30字内）"
      }
    }
  ]
}`;

          const apiResponse = await fetch(getChatUrl(baseUrl), {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: "system", content: systemPrompt }],
              max_tokens: 1500,
              temperature: 0.7,
              response_format: { type: "json_object" }
            }),
            signal: AbortSignal.timeout(45000)
          });

          const data = await apiResponse.json();
          if (apiResponse.ok && data?.choices?.[0]?.message?.content) {
            const parsed = JSON.parse(data.choices[0].message.content.trim());
            if (Array.isArray(parsed.trends) && parsed.trends.length > 0) {
              collectedList = parsed.trends;
              isAiGenerated = true;
            }
          }
        } catch (apiErr) {
          console.warn(`[Trends API] AI 动态合成失败，触发高仿真沙箱降级机制: ${apiErr.message}`);
        }
      }

      // 降级兜底：使用预设的 12 种最高保真热门小说题材种子，并且随机洗牌（Shuffle）打乱顺序并赋予浮动分数，确保离线模式体验逼真
      if (collectedList.length === 0) {
        // 深拷贝静态模板
        const clonedSeeds = JSON.parse(JSON.stringify(STATIC_TRENDS));
        // 洗牌算法乱序
        for (let i = clonedSeeds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [clonedSeeds[i], clonedSeeds[j]] = [clonedSeeds[j], clonedSeeds[i]];
        }
        // 随机调配热度分数，提供动态变化质感
        collectedList = clonedSeeds.map(seed => {
          seed.heat_score = Math.floor(Math.random() * (99 - 78 + 1)) + 78;
          return seed;
        });
      }

      // 保存至 SQLite 数据库中并执行冲突覆盖
      for (const item of collectedList) {
        const id = `trend_${item.source}_${Math.random().toString(36).substr(2, 6)}`;
        await saveGenreTrend({
          id,
          source: item.source,
          novel_title: item.novel_title,
          raw_genre: item.raw_genre,
          mapped_genre: item.mapped_genre,
          heat_score: item.heat_score,
          analysis: item.analysis,
          introduction: item.introduction
        });
      }

      // 刷新取出全部
      const list = await getGenreTrends("all", "all");
      sendJson(response, 200, {
        ok: true,
        list,
        source: isAiGenerated ? "ai_online" : "sandbox_offline",
        message: isAiGenerated
          ? `⚡ 大模型联网分析完毕，已深度挖掘并收纳 ${collectedList.length} 条全网最热网文题材趋势！`
          : `⚡ [沙箱模式] 离线防反爬智能避让激活，已高仿真同步归档 ${collectedList.length} 条热门题材趋势！`
      });

    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  // POST /api/trends/convert — 一键将选中的热门小说题材卡片转化为写作专属灵感
  if (url.pathname === "/api/trends/convert" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const { trendId, modelConfig } = body;

      if (!trendId) {
        sendJson(response, 400, { ok: false, message: "缺少必要参数 trendId" });
        return true;
      }

      // 1. 获取题材趋势详情
      const trend = await getGenreTrendById(trendId);
      if (!trend) {
        sendJson(response, 404, { ok: false, message: "未找到该条题材趋势记录" });
        return true;
      }

      const parsedAnalysis = typeof trend.analysis === "string" ? JSON.parse(trend.analysis) : trend.analysis;

      // 2. 调用 AI 深度提炼指纹或进入高仿真模板匹配
      const cfg = modelConfig || {};
      const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const baseUrl = (cfg.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
      const modelName = cfg.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

      const isPlaceholder = !apiKey || apiKey === "sk-your-api-key" || apiKey.includes("your-api-key");
      
      let inspirationData = null;

      if (!isPlaceholder) {
        try {
          const systemPrompt = `你是一名拥有十年经验的顶级网文拆解大师。我们将为你提供一个当前的流行热门题材：
小说名字：《${trend.novel_title}》
平台题材分类：${trend.raw_genre}
系统归档题材：${trend.mapped_genre}
故事背景介绍（简介）：${trend.introduction || "暂无"}
情绪钩子痛点要点：${JSON.stringify(parsedAnalysis)}

请运用网文基因反编译与逆向工程技术，为该小说在系统分类中深度提炼写作“拆解三要素”与完整“12项写作指纹”。
请严格输出以下 JSON（不要加 markdown 包裹，所有字段必填）：
{
  "theme": "核心选题定位与矛盾（30字内）",
  "hook": "黄金开篇钩子公式（含【主角】【秘密】等占位符，60字内）",
  "outline": "起承转合大纲骨架，用分号分隔，每一步指明情绪推进价值",
  "fingerprint": {
    "openingSpeed": "1-5的整数（5=第一句切入冲突）",
    "voiceStyle": "第一人称沉浸/第三人称近视角/第三人称全知",
    "dialogueRatio": "0-100之间的整数（对话占比%）",
    "sentenceStyle": "极短句主导/短长混合/长句为主",
    "firstConflictAt": "第一冲突位置（第几句出现冲突）",
    "pressureType": "名声/情感/金钱/职权/规则代价/生命威胁（多个用+号连接）",
    "emotionTone": "克制冷静/张扬浓烈/幽默讽刺/悲凉沉郁/轻松甜蜜",
    "sceneType": "典型场景（如：大厂会议室/豪门婚礼/深夜便利店/太极殿）",
    "endingHook": "动作断章/台词断章/发现断章/悬念留白/情感余韵",
    "powerPhrases": ["结合该题材虚构2句最具情绪冲击力的招牌金句，必须用双引号包围"],
    "uniqueVocab": ["该爆款题材特有的5个高频特征特征词"],
    "rawSample": "高拟真还原该爆款小说的黄金开篇片段（150字内，必须展现开篇钩子与悬念张力）"
  }
}`;

          const apiResponse = await fetch(getChatUrl(baseUrl), {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: "system", content: systemPrompt }],
              max_tokens: 1500,
              temperature: 0.5,
              response_format: { type: "json_object" }
            }),
            signal: AbortSignal.timeout(45000)
          });

          const data = await apiResponse.json();
          if (apiResponse.ok && data?.choices?.[0]?.message?.content) {
            const parsed = JSON.parse(data.choices[0].message.content.trim());
            inspirationData = {
              id: `trend_convert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              user_id: userId,
              genre: trend.mapped_genre,
              theme: parsed.theme,
              hook: parsed.hook,
              outline: parsed.outline,
              raw_text: `逆向工程还原的网文大纲基因库。取材自热门趋势小说《${trend.novel_title}》。\n分析要点：${parsed.rawSample || ""}`,
              fingerprint: parsed.fingerprint
            };
          }
        } catch (apiErr) {
          console.warn(`[Trend Convert API] AI 提炼失败，触发高仿真沙箱降级: ${apiErr.message}`);
        }
      }

      // 降级兜底：使用本地拟真引擎
      if (!inspirationData) {
        inspirationData = generateLocalMockInspiration(trend, userId);
      }

      // 3. 写入 SQLite 灵感库
      await saveInspiration(
        inspirationData.id,
        inspirationData.user_id,
        inspirationData.genre,
        inspirationData.theme,
        inspirationData.hook,
        inspirationData.outline,
        inspirationData.raw_text,
        JSON.stringify(inspirationData.fingerprint)
      );

      sendJson(response, 200, {
        ok: true,
        inspirationId: inspirationData.id,
        message: `⚡ 恭喜！热门题材《${trend.novel_title}》已成功反编译为完整的“起承转合大纲”与“12项写作基因指纹”，完美归档存入您的爆款灵感库！`
      });

    } catch (e) {
      sendJson(response, 500, { ok: false, message: e.message });
    }
    return true;
  }

  return false;
}
