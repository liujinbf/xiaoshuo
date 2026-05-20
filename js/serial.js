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

// 全局进度定时器与模拟参数
let progressTimer = null;

function startSerialProgressSimulation() {
  const card = document.getElementById("serialGenProgressCard");
  const fill = document.getElementById("serialGenProgressBarFill");
  const pctText = document.getElementById("serialGenProgressPct");
  const stepText = document.getElementById("serialGenProgressStep");
  
  if (!card || !fill || !pctText || !stepText) return;
  
  card.hidden = false;
  fill.style.width = "0%";
  fill.style.background = ""; // 重置样式
  pctText.textContent = "0%";
  stepText.textContent = "正在深度解析上一章上下文与世界观遗留设定...";
  
  let currentPct = 0;
  
  if (progressTimer) clearInterval(progressTimer);
  
  progressTimer = setInterval(() => {
    // 渐进式增加百分比，在前段增长快，后段接近极限时减速悬停，防卡死
    if (currentPct < 40) {
      currentPct += Math.floor(Math.random() * 8) + 4;
    } else if (currentPct < 75) {
      currentPct += Math.floor(Math.random() * 4) + 2;
    } else if (currentPct < 96) {
      currentPct += 1;
    }
    
    currentPct = Math.min(96, currentPct);
    fill.style.width = `${currentPct}%`;
    pctText.textContent = `${currentPct}%`;
    
    // 对应百分比展示多步骤文案
    if (currentPct < 25) {
      stepText.textContent = "正在深度解析上一章上下文与世界观遗留设定...";
    } else if (currentPct < 55) {
      stepText.textContent = "正在启动大模型分析当前大纲并铸造下一章核心冲突...";
    } else if (currentPct < 78) {
      stepText.textContent = "正在检索并应用学科常识约束规范，校准科学性与合理性设定...";
    } else if (currentPct < 92) {
      stepText.textContent = "正在精雕细琢人物台词与动作细节，生成高保真章节正文...";
    } else {
      stepText.textContent = "正文生成完毕，正在进行最后的语言润色与逻辑一致性校验...";
    }
  }, 300);
}

function finishSerialProgressSimulation(isSuccess) {
  if (progressTimer) clearInterval(progressTimer);
  
  const card = document.getElementById("serialGenProgressCard");
  const fill = document.getElementById("serialGenProgressBarFill");
  const pctText = document.getElementById("serialGenProgressPct");
  const stepText = document.getElementById("serialGenProgressStep");
  
  if (!card || !fill || !pctText || !stepText) return;
  
  if (isSuccess) {
    fill.style.width = "100%";
    pctText.textContent = "100%";
    stepText.textContent = "🎉 铸造成功，正在为您装载章节内容！";
    setTimeout(() => {
      card.hidden = true;
    }, 1200);
  } else {
    fill.style.width = "100%";
    fill.style.background = "var(--du-warn)"; // 变警告色
    pctText.textContent = "ERROR";
    stepText.textContent = "❌ 铸造中断，请检查模型 API Key 配置或网络连接。";
    setTimeout(() => {
      card.hidden = true;
    }, 4000);
  }
}

async function handleGenerateSingle() {
  if (isBatchGenerating) return;
  if (window.currentNovel.chapters.length >= window.currentNovel.targetChapters) {
    if (!confirm("已达目标章数，确定继续生成？")) return;
  }
  setSerialGeneratingState(true, false);
  startSerialProgressSimulation();
  
  let success = false;
  try {
    success = await generateChapterLogic(true);
  } finally {
    finishSerialProgressSimulation(success);
    setSerialGeneratingState(false, false);
  }
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
    
    startSerialProgressSimulation();
    let success = false;
    try {
      success = await generateChapterLogic(false);
    } finally {
      finishSerialProgressSimulation(success);
    }

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

// 自动初始化与全局方法挂载
window.loadNovels = loadNovels;
document.addEventListener("DOMContentLoaded", initSerialEvents);
