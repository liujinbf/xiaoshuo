// ============================================================
// 模块: utils.js — 通用工具函数（pick / escapeHtml / collectInput 等）
// 单文件行数上限: 200 行。禁止引用任何 DOM 元素
// ============================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function pick(list, offset = 0) {
  const index = Math.abs(Date.now() + offset + Math.floor(Math.random() * 1000)) % list.length;
  return list[index];
}

function pickSequence(list, count, offset = 0) {
  const start = Math.abs(Date.now() + offset + Math.floor(Math.random() * 1000)) % list.length;
  return Array.from({ length: count }, (_, index) => list[(start + index) % list.length]);
}

function getSelectedTags() {
  return [...document.querySelectorAll("#tagCloud .tag.active")]
    .map((tag) => tag.dataset.tag)
    .filter(Boolean);
}

function compactTheme(theme) {
  const cleaned = theme
    .replace(/[“”"]/g, "")
    .replace(/^我在/, "")
    .replace(/^我被/, "")
    .replace(/^我/, "")
    .trim();
  const chunks = cleaned
    .split(/发现|之后|那天|时|，|。|、|；|：|\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const core = chunks[0] || cleaned || "秘密";
  return core.length > 12 ? core.slice(0, 12) : core;
}

function sentenceTheme(theme) {
  return theme
    .replace(/[“”"]/g, "")
    .replace(/^我在/, "")
    .replace(/^我被/, "被")
    .replace(/^我/, "")
    .trim();
}

function collectInput() {
  const storyForm = document.querySelector("#storyForm");
  const data = new FormData(storyForm);
  const genre = data.get("genre");
  let pool = [];
  if (typeof inspirationPool !== "undefined") {
    pool = inspirationPool[genre] || [];
  }
  return {
    genre,
    title: (data.get("storyTitle") || "").trim(),
    theme: (data.get("theme") || "").trim() || (pool.length > 0 ? pick(pool) : "关于秘密的故事"),
    topic: (data.get("storyTopic") || "").trim(),
    notes: (data.get("storyNotes") || "").trim(),
    viewpoint: data.get("viewpoint"),
    ending: data.get("ending"),
    length: Number(data.get("length") || 8000),
    intensity: Number(data.get("intensity") || 7),
    tags: getSelectedTags()
  };
}

// 简单的段落级 Diff 对比
function generateDiffHtml(oldText, newText) {
  if (!oldText) oldText = "";
  if (!newText) newText = "";
  
  const oldLines = oldText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const newLines = newText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  
  let html = [];
  let i = 0, j = 0;
  
  // 极简 LCS 近似：双指针匹配段落
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      html.push(`<div>${escapeHtml(oldLines[i])}</div>`);
      i++;
      j++;
    } else {
      // 检查后续是否有匹配来决定是插入还是删除
      let foundInNew = newLines.slice(j, j + 5).indexOf(oldLines[i]);
      let foundInOld = oldLines.slice(i, i + 5).indexOf(newLines[j]);
      
      if (foundInOld === -1 && foundInNew === -1) {
        // 都没找到，说明是修改（删除旧的，插入新的）
        if (i < oldLines.length) {
          html.push(`<div><del>${escapeHtml(oldLines[i])}</del></div>`);
          i++;
        }
        if (j < newLines.length) {
          html.push(`<div><ins>${escapeHtml(newLines[j])}</ins></div>`);
          j++;
        }
      } else if (foundInOld !== -1) {
        // 在旧段落中找到了新段落的内容 -> 说明前面的旧段落被删除了
        html.push(`<div><del>${escapeHtml(oldLines[i])}</del></div>`);
        i++;
      } else if (foundInNew !== -1) {
        // 在新段落中找到了旧段落的内容 -> 说明前面插入了新段落
        html.push(`<div><ins>${escapeHtml(newLines[j])}</ins></div>`);
        j++;
      }
    }
  }
  
  return html.join("\n<br/>\n");
}

