// ============================================================
// 模块: planner-titles.js — 盐言故事标题生成
// ============================================================

function buildTitles(input, profile) {
  const theme = input.theme || "背叛与复仇";
  if (input.genre === "suspense" && /死亡通知|失踪男友|手机/.test(theme)) {
    return [
      "《我在失踪男友手机里，看见了自己的死亡通知》",
      "《死亡通知提前一天出现后，男友的失踪不对劲了》",
      "《男友失踪第三天，他的手机预告了我的死亡》",
      "《明天九点十七分，我会被确认死亡》",
      "《那条死亡通知，是失踪男友发给我的》"
    ];
  }
  const tokens = theme
    .split(/[、，,。！？\s]|和|与|跟|以及/)
    .map((item) => item.trim().replace(/^一[个份张条本封段场次]/, ""))
    .filter(Boolean);
  const objectPattern = /(遗嘱|协议|报告|账本|录音|照片|视频|监控|合同|房产证|鉴定|电话|短信|名单|证据|保险柜|签名|APP|规则|直播|史书|系统|弹幕|时间线|手机|通知|死亡通知|皇帝|太子|将军)/;
  const peoplePattern = /(丈夫|妻子|闺蜜|婆婆|母亲|妈妈|父亲|爸爸|妹妹|姐姐|哥哥|弟弟|男友|女友|老板|同事|未婚夫|前夫|情人|继承人|律师|秦始皇|李世民|刘禅|朱元璋|皇帝|太子|公主|女主)/;
  const historicalName = (theme.match(/秦始皇|李世民|刘禅|朱元璋|嬴政|汉武帝|武则天|曹操|刘备|诸葛亮|亡国太子|皇帝|公主/) || [])[0];
  const primary = input.genre === "history"
    ? historicalName || "古人"
    : tokens.find((item) => peoplePattern.test(item)) || tokens[0] || "那个人";
  const secondary = tokens.find((item) => item !== primary && peoplePattern.test(item)) || "";
  const witness = secondary || "关键证人";
  const objectToken = tokens.find((item) => objectPattern.test(item)) || pick(profile.titleWords || ["证据"]);
  const historyObject = ["近代史", "工业图纸", "现代地图", "国运系统", "短视频", "弹幕", "史书", "时间线", "直播"]
    .find((item) => theme.includes(item));
  const objectName = input.genre === "history"
    ? historyObject || "未来"
    : (objectToken.match(objectPattern) || [objectToken])[0];
  const pair = secondary ? `${primary}和${secondary}` : primary;
  const event = objectToken.includes("被")
    ? `${objectName}${objectToken.includes("调包") ? "被调包" : objectToken.includes("篡改") ? "被篡改" : "出了问题"}`
    : `${objectName}出了问题`;
  const soulTarget = (theme.match(/魂穿([^，,。后]+)/) || [])[1] || "亡国之君";
  const dynasty = primary.includes("秦始皇") || primary.includes("嬴政")
    ? "大秦"
    : primary.includes("李世民")
      ? "大唐"
      : primary.includes("朱元璋")
        ? "大明"
        : "这个王朝";
  const historyThirdTitle = theme.includes("魂穿")
    ? `《${primary}魂穿${soulTarget}后，第一件事是砍了奸臣》`
    : `《${primary}看到亡国倒计时后，第一句话是查粮仓》`;

  const templateMap = {
    history: [
      `《我给${primary}直播未来后，满朝文武跪了》`,
      `《${primary}看完${objectName}，连夜改了国策》`,
      historyThirdTitle,
      `《我把工业图纸递给${primary}，${dynasty}不亡了》`,
      `《弹幕剧透亡国那天，${primary}沉默了一整夜》`,
    ],
    rules: [
      `《我收到十年后的短信：别相信第${Math.floor(Math.random() * 4) + 3}条规则》`,
      `《那个删不掉的APP，开始替我选择人生》`,
      `《凌晨三点，业主群发来一份新规则》`,
      `《我以为自己逃出去了，直到规则开始叫我的名字》`,
      `《第七天醒来，我发现全家都在遵守同一条假规则》`,
    ],
    suspense: [
      `《我查${objectName}那天，${primary}开始慌了》`,
      `《${witness}替${primary}作证后，${objectName}少了一页》`,
      `《那份${objectName}不是假的，假的是签字的人》`,
      `《${primary}说没见过${objectName}，监控却拍到了${witness}》`,
      `《${event}以后，我才知道他们早就串好了口供》`,
    ],
    revenge: [
      `《发现${event}后，我没有当场揭穿${pair}》`,
      `《${pair}以为我输了，我把${objectName}送上了法庭》`,
      `《离婚前夜，我拿到了${primary}藏起来的${objectName}》`,
      `《${secondary || "她"}劝我签字时，不知道我已经录了音》`,
      `《他们抢走${objectName}那天，我准备好了反击》`,
    ],
    heroine: [
      `《他们拿${objectName}逼我退场，我反手换了整盘棋》`,
      `《${pair}设好的局，被我用一份${objectName}拆穿了》`,
      `《我忍到${event}那天，只为让他们亲口认输》`,
      `《所有人都等我崩溃，我却拿回了${objectName}》`,
      `《${primary}以为能困住我，直到我亮出底牌》`,
    ],
    family: [
      `《${objectName}上没有我的名字，但钱是我出的》`,
      `《妈妈说爱我们一样多，账本不这么说》`,
      `《${event}那晚，我们终于装不成一家人》`,
      `《他们让我让步时，忘了${objectName}还在我手里》`,
      `《分家那天，我才知道${primary}早就签了字》`,
    ],
    folklore: [
      `《那份${objectName}，是老人们不准在夜里提的东西》`,
      `《${event}背后，没有鬼，只有人》`,
      `《${primary}回村那年，祠堂里多了一个名字》`,
      `《祖母临死前说，那口井别靠近》`,
      `《${objectName}是禁忌，也是多年前的罪证》`,
    ],
    workplace: [
      `《${event}那天，我把三年的证据交了出去》`,
      `《${objectName}，是整个部门心照不宣的秘密》`,
      `《他们以为开除我就结束了，合规部不这么认为》`,
      `《${pair}背后，有一份没人敢看第二眼的报告》`,
      `《我离职那天，把底标复印了一份留着》`,
    ],
  };

  const templates = templateMap[input.genre] || templateMap.revenge;
  return [...new Set(templates)].slice(0, 5);
}
