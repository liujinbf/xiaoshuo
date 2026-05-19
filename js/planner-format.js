// ============================================================
// 模块: planner-format.js — 提案包格式化
// ============================================================

function formatProposalPack(pack) {
  return [
    "【商业提案包】",
    `变现评分：${pack.score}/100`,
    "",
    "【定位】",
    pack.positioning.map((item) => `${item.label}：${item.text}`).join("\n"),
    "",
    "【投稿 Pitch】",
    `标题：${pack.pitch.title}`,
    `一句话卖点：${pack.pitch.logline}`,
    `梗概：${pack.pitch.synopsis}`,
    `编辑备注：${pack.pitch.editorNote}`,
    "",
    "【收益路径】",
    pack.routes.map((item, index) => `${index + 1}. ${item.name}｜${item.speed}｜${item.revenue}\n行动：${item.action}`).join("\n\n"),
    "",
    "【交付检查】",
    pack.checklist.map((item) => `- ${item}`).join("\n")
  ].join("\n");
}
