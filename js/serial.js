// ============================================================
// 模块: serial.js — 连载铸造核心逻辑（数据管理 / 章节生成 / 记忆机制）
// 渲染部分已拆分至 serial-render.js
// ============================================================

window.currentNovel = null;
window.serialNovels = [];

// --- 初始化与加载 ---
async function loadNovels() {
  const uid = localStorage.getItem(USER_KEY) || "";
  if (!uid) return;
  try {
    const res = await fetch(`/api/novels?userId=${uid}`);
    const data = await res.json();
    if (data.ok) {
      window.serialNovels = data.novels || [];
      renderNovelList();
    }
  } catch (_) {}
}

// --- 事件绑定 (由 app.js 调用或自执行) ---
function initSerialEvents() {
  const tabShort = document.querySelector("#tabShort");
  const tabSerial = document.querySelector("#tabSerial");
  const panelShort = document.querySelector("#panelShort");
  const panelSerial = document.querySelector("#panelSerial");

  tabShort.addEventListener("click", () => {
    tabShort.classList.add("active");
    tabSerial.classList.remove("active");
    panelShort.hidden = false;
    panelSerial.hidden = true;
  });

  tabSerial.addEventListener("click", () => {
    tabSerial.classList.add("active");
    tabShort.classList.remove("active");
    panelSerial.hidden = false;
    panelShort.hidden = true;
    loadNovels();
  });

  document.querySelector("#createNovelBtn").addEventListener("click", handleCreateNovel);
  document.querySelector("#generateChapterBtn").addEventListener("click", handleGenerateSingle);
  document.querySelector("#batchGenerateBtn").addEventListener("click", handleBatchGenerate);
  document.querySelector("#exportSerialBtn").addEventListener("click", exportFullText);
  document.querySelector("#exportScriptBtn").addEventListener("click", exportDramaScript);
  document.querySelector("#closeReaderBtn").addEventListener("click", () => {
    document.querySelector("#chapterReader").hidden = true;
  });
}

// --- 核心业务逻辑 ---

async function handleCreateNovel() {
  const btn = document.querySelector("#createNovelBtn");
  const title = document.querySelector("#serialTitle").value.trim();
  const genre = document.querySelector("#serialGenre").value;
  const outline = document.querySelector("#serialOutline").value.trim();
  const characters = document.querySelector("#serialCharacters").value.trim();
  const chapterLength = Number(document.querySelector("#serialChapterLength").value);
  const targetChapters = Number(document.querySelector("#serialTargetChapters").value);

  if (!title || !outline || !characters) {
    alert("请填写完整小说信息");
    return;
  }

  btn.disabled = true;
  btn.textContent = "创建中…";
  try {
    const uid = localStorage.getItem(USER_KEY) || "";
    const res = await fetch("/api/novels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, title, genre, outline, characters, chapterLength, targetChapters })
    });
    const data = await res.json();
    if (data.ok) {
      window.serialNovels.unshift(data.novel);
      selectNovel(data.novel);
      // 清空表单
      ["#serialTitle", "#serialOutline", "#serialCharacters"].forEach(id => {
        document.querySelector(id).value = "";
      });
    } else {
      alert(data.message || "创建失败");
    }
  } catch (_) {
    alert("网络错误");
  } finally {
    btn.disabled = false;
    btn.textContent = "✔ 创建连载";
  }
}

async function deleteNovel(novelId) {
  const uid = localStorage.getItem(USER_KEY) || "";
  try {
    await fetch(`/api/novels/${novelId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid })
    });
    window.serialNovels = window.serialNovels.filter((n) => n.id !== novelId);
    if (window.currentNovel?.id === novelId) {
      window.currentNovel = null;
      document.querySelector("#serialEmptyState").hidden = false;
      document.querySelector("#serialWorkspace").hidden = true;
      document.querySelector("#chapterReader").hidden = true;
    }
    renderNovelList();
  } catch (_) { alert("删除失败"); }
}

let isBatchGenerating = false;

async function generateChapterLogic(showReader = false) {
  if (!window.currentNovel) return false;
  const uid = localStorage.getItem(USER_KEY) || "";
  const modelConfig = readModelConfig();
  
  if (!modelConfig.apiKey) {
    alert("请先配置 API Key");
    return false;
  }

  try {
    const res = await fetch(`/api/novels/${window.currentNovel.id}/chapters/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, modelConfig })
    });
    const data = await res.json();
    if (data.ok) {
      window.currentNovel = data.novel;
      window.serialNovels = window.serialNovels.map(n => n.id === window.currentNovel.id ? window.currentNovel : n);
      selectNovel(window.currentNovel);
      if (showReader && data.chapter) openChapterReader(data.chapter);
      return true;
    } else {
      alert(data.message);
      return false;
    }
  } catch (_) {
    return false;
  }
}

async function convertChapterToScript(chapter) {
  if (!window.currentNovel) return;
  const btn = document.querySelector(`.chapter-script-btn[data-index="${chapter.index}"]`);
  const originalText = btn.textContent;
  
  btn.disabled = true;
  btn.textContent = "⏳ 转化中...";
  
  try {
    const res = await fetch("/api/generate/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        novelTitle: window.currentNovel.title,
        chapterIndex: chapter.index,
        content: chapter.content,
        modelConfig: readModelConfig()
      })
    });
    const data = await res.json();
    if (data.ok) {
      // 借用阅读器显示脚本内容
      openChapterReader({
        index: chapter.index,
        content: `【AI 生成剧本脚本】\n\n${data.script}`
      });
      document.querySelector("#chapterReaderLabel").textContent = `第 ${chapter.index} 章 - 短剧脚本`;
    } else {
      alert(data.message);
    }
  } catch (e) {
    alert("转化失败");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleGenerateSingle() {
  if (isBatchGenerating) return;
  if (window.currentNovel.chapters.length >= window.currentNovel.targetChapters) {
    if (!confirm("已达目标章数，确定继续生成？")) return;
  }
  setSerialGeneratingState(true, false);
  await generateChapterLogic(true);
  setSerialGeneratingState(false, false);
}

async function handleBatchGenerate() {
  if (!window.currentNovel) return;
  if (isBatchGenerating) {
    isBatchGenerating = false;
    document.querySelector("#batchGenerateBtn").textContent = "正在停止...";
    return;
  }

  if (window.currentNovel.chapters.length >= window.currentNovel.targetChapters) {
    alert("无需批量生成");
    return;
  }

  if (!confirm("开始批量全自动铸造？")) return;

  isBatchGenerating = true;
  setSerialGeneratingState(true, true);
  
  while (isBatchGenerating && window.currentNovel.chapters.length < window.currentNovel.targetChapters) {
    document.querySelector("#batchGenerateBtn").textContent = `⏹ 停止 (第 ${window.currentNovel.chapters.length + 1} 章)...`;
    const success = await generateChapterLogic(false);
    if (!success) {
      isBatchGenerating = false;
      break;
    }
    if (isBatchGenerating) {
      document.querySelector("#batchGenerateBtn").textContent = `⏳ 冷却 (3s)...`;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  isBatchGenerating = false;
  setSerialGeneratingState(false, true);
}

// --- 导出逻辑 ---

function exportFullText() {
  const novel = window.currentNovel;
  if (!novel?.chapters.length) return;
  const lines = [`《${novel.title}》`, `类型：${novel.genre}`, "", ""];
  novel.chapters.forEach(ch => {
    lines.push(`第 ${ch.index} 章`, "", ch.content, "", "---", "");
  });
  downloadBlob(`${novel.title}_全文.txt`, lines.join("\n"));
}

function exportDramaScript() {
  const novel = window.currentNovel;
  if (!novel?.chapters.length) return;
  const lines = [`【剧名】《${novel.title}》`, `【题材】${novel.genre}`, "====================", ""];
  novel.chapters.forEach(ch => {
    lines.push(`【第 ${ch.index} 场】`);
    ch.content.split(/\n+/).forEach(p => {
      const text = p.trim();
      if (!text) return;
      if (text.includes("“") && text.includes("”")) {
        lines.push(`[台词] ${text}`);
      } else {
        lines.push(`[画面] ${text}`);
      }
    });
    lines.push("", "--------------------", "");
  });
  downloadBlob(`${novel.title}_短剧脚本.txt`, lines.join("\n"));
}

function downloadBlob(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// 自动初始化
document.addEventListener("DOMContentLoaded", initSerialEvents);
