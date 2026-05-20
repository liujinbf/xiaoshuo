// ============================================================
// 模块: learning.js — 爆款拆解学习器前端逻辑
// ============================================================

window.currentDissected = null;

function knowledgeUserIdQuery() {
  const uid = localStorage.getItem(USER_KEY) || "";
  return uid ? `?userId=${encodeURIComponent(uid)}` : "";
}

function tokenizeKnowledgeText(value) {
  return String(value || "")
    .split(/[，。！？、；：\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function scoreKnowledgeItem(input, item) {
  const queryWords = [
    ...tokenizeKnowledgeText(input.theme),
    ...(Array.isArray(input.tags) ? input.tags : [])
  ];
  const haystack = `${item.theme || ""} ${item.hook || ""} ${item.outline || ""}`.toLowerCase();
  let score = item.genre === input.genre ? 30 : 0;
  queryWords.forEach((word) => {
    if (haystack.includes(word.toLowerCase())) score += 10;
  });
  return score;
}

function normalizeKnowledgeText(value = "") {
  return String(value)
    .replace(/[|｜/\\.\[\]【】（）(){}<>《》「」『』·*＊_\-—=~～!！^]+/g, "")
    .replace(/\s+/g, "");
}

function isUsableKnowledgeItem(item) {
  const theme = String(item?.theme || "");
  const hook = String(item?.hook || "");
  const outline = String(item?.outline || "");
  if (!theme || !hook || !outline) return false;
  const text = `${theme} ${hook} ${outline}`;
  const normalized = normalizeKnowledgeText(text);
  if (/[━─=＿_—\-]{3,}|未知设定|精彩故事|公\s*[|/\\.\[\]（）()【】]*\s*(?:众|主)\s*[|/\\.\[\]（）()【】]*\s*号|闲\s*[|/\\.\[\]（）()【】*＊·\s-]*\s*书|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|来源来自网络/.test(text)) return false;
  if (/公众号|公主号|闲闲书|闲书|书坊|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|西图澜娅|来源来自网络/.test(normalized)) return false;
  return theme.length >= 6 && hook.length >= 10 && outline.length >= 10;
}

async function matchKnowledgeForInput(input) {
  try {
    const res = await fetch(`/api/inspirations${knowledgeUserIdQuery()}`);
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.inspirations)) return [];
    return data.inspirations
      .filter(isUsableKnowledgeItem)
      .map((item) => ({ ...item, _score: scoreKnowledgeItem(input, item) }))
      .filter((item) => item._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 3);
  } catch {
    return [];
  }
}

window.matchKnowledgeForInput = matchKnowledgeForInput;

// 统一面板路由控制已收拢至 desktop-ui.js

function initLearningEvents() {
  document.querySelector("#startLearnBtn")?.addEventListener("click", handleStartDissect);
  document.querySelector("#saveInspirationBtn")?.addEventListener("click", handleSaveInspiration);

  const importEl = document.querySelector("#learnImportTxt");
  if (importEl) {
    importEl.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const textarea = document.querySelector("#learnRawText");
        if (textarea) {
          textarea.value = loadEvent.target.result;
          alert(`成功导入文件：${file.name}（${file.size} 字节）`);
        }
      };
      reader.onerror = () => {
        alert("读取文件失败，请确保文件编码为 UTF-8。");
      };
      reader.readAsText(file, "utf-8");
      importEl.value = "";
    });
  }
}

async function handleStartDissect() {
  const btn = document.querySelector("#startLearnBtn");
  const rawText = document.querySelector("#learnRawText")?.value.trim() || "";
  const genre = document.querySelector("#learnGenre")?.value || "suspense";

  if (!rawText) {
    alert("请粘贴爆款文章原文。");
    return;
  }

  if (rawText.length < 200) {
    alert("粘贴内容过少，建议提供至少 200 字以上的内容以供 AI 准确拆解。");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "AI 正在深度阅读与拆解中...";
  }

  try {
    const hasClient = typeof hasClientModelConfig === "function" && hasClientModelConfig();
    const clientCfg = typeof readModelConfig === "function" ? readModelConfig() : {};
    const modelConfig = hasClient
      ? { apiKey: clientCfg.apiKey, baseUrl: clientCfg.baseUrl || undefined, model: clientCfg.model }
      : null;

    const res = await fetch(`/api/inspirations/dissect${knowledgeUserIdQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, genre, modelConfig })
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || "AI 拆解失败，请检查模型配置。");
      return;
    }

    window.currentDissected = {
      genre,
      theme: data.theme,
      hook: data.hook,
      outline: data.outline,
      rawText
    };

    document.querySelector("#learnResultTheme").textContent = data.theme;
    document.querySelector("#learnResultHook").textContent = data.hook;
    document.querySelector("#learnResultOutline").textContent = String(data.outline || "").split(";").join("\n");
    document.querySelector("#learnEmptyState").style.display = "none";
    document.querySelector("#learnResultArea").style.display = "flex";
  } catch (error) {
    console.error(error);
    alert("网络错误或 AI 处理异常。");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "让 AI 开始拆解学习";
    }
  }
}

async function handleSaveInspiration() {
  const btn = document.querySelector("#saveInspirationBtn");
  const dissected = window.currentDissected;
  if (!dissected) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = "正在存入灵感库...";
  }

  try {
    const res = await fetch(`/api/inspirations${knowledgeUserIdQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dissected)
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || "保存失败");
      return;
    }

    alert("拆解学习成功，该爆款设想已存入本地灵感库。");
    const rawEl = document.querySelector("#learnRawText");
    const emptyEl = document.querySelector("#learnEmptyState");
    const resultEl = document.querySelector("#learnResultArea");
    if (rawEl) rawEl.value = "";
    if (emptyEl) emptyEl.style.display = "flex";
    if (resultEl) resultEl.style.display = "none";
    window.currentDissected = null;
    loadKnowledgeList();
  } catch {
    alert("保存网络错误。");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "保存为专属灵感库";
    }
  }
}

const genreLabels = {
  history: "历史错位爽文",
  rules: "规则怪谈脑洞",
  suspense: "悬疑反转",
  revenge: "婚恋复仇",
  heroine: "大女主爽文",
  family: "世情家庭",
  folklore: "中式志怪",
  workplace: "职场内幕"
};

function ensureClearAllButton(countEl, count) {
  let button = document.querySelector("#clearAllInspirationsBtn");
  if (!button) {
    button = document.createElement("button");
    button.id = "clearAllInspirationsBtn";
    button.className = "danger-inline-btn";
    button.type = "button";
    button.addEventListener("click", handleClearAllInspirations);
    // 优先注入到新版 lp-library-actions 容器
    const actionsEl = document.querySelector(".lp-library-actions");
    if (actionsEl) {
      actionsEl.appendChild(button);
    } else {
      countEl.parentNode?.insertBefore(button, countEl.nextSibling);
    }
  }
  button.textContent = `清空全部（${count}）`;
  button.style.display = count > 0 ? "inline-block" : "none";
}

async function loadKnowledgeList() {
  const listEl = document.querySelector("#knowledgeList");
  const countEl = document.querySelector("#knowledgeCount");
  const emptyEl = document.querySelector("#knowledgeEmptyState");
  if (!listEl) return;

  try {
    const res = await fetch(`/api/inspirations${knowledgeUserIdQuery()}`);
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.inspirations)) {
      if (countEl) countEl.textContent = "加载失败";
      return;
    }

    const list = data.inspirations.filter(isUsableKnowledgeItem).slice(0, 100);
    if (countEl) {
      // 新版 UI：knowledgeCount 是 lp-stat-num，只显示纯数字
      countEl.textContent = list.length;
      countEl.style.borderColor = "";
      ensureClearAllButton(countEl, list.length);
    }

    if (list.length === 0) {
      if (emptyEl) { emptyEl.style.display = "block"; emptyEl.style.flex = ""; }
      listEl.style.display = "none";
      listEl.innerHTML = "";
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    listEl.style.display = "grid";
    listEl.innerHTML = list.map((item) => `
      <div class="knowledge-card">
        <div class="knowledge-card-head">
          <div class="knowledge-card-tags">
            <span class="knowledge-card-tag primary">${escapeHtml(genreLabels[item.genre] || item.genre || "未分类")}</span>
            <span class="knowledge-card-tag ${item.user_id === "admin" ? "system" : "private"}">
              ${item.user_id === "admin" ? "批量导入" : "专属自学"}
            </span>
          </div>
          ${item.user_id !== "admin" ? `
            <button class="knowledge-delete-btn" onclick="handleDeleteInspiration('${escapeHtml(item.id)}')" title="删除已学模型">删除</button>
          ` : `
            <span class="knowledge-lock">系统锁定</span>
          `}
        </div>
        <h4>${escapeHtml(item.theme)}</h4>
        <div class="knowledge-card-body">
          <div><strong>开篇钩子：</strong>${escapeHtml(item.hook)}</div>
          <div><strong>骨架大纲：</strong>${escapeHtml(String(item.outline || "").split(";").join(" -> "))}</div>
        </div>
        ${item.raw_text ? `<p class="knowledge-card-quote" title="${escapeHtml(item.raw_text)}">“${escapeHtml(String(item.raw_text).slice(0, 80))}...”</p>` : ""}
        <div class="knowledge-card-meta">
          <span>学习时间：${new Date(item.created_at).toLocaleDateString()}</span>
          <span>RAG 已召回</span>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("加载专属知识库失败：", error);
    if (countEl) countEl.textContent = "网络异常";
  }
}

async function handleDeleteInspiration(id) {
  if (!confirm("确定要删除该专属爆款模型吗？删除后系统将无法检索此段落进行写作风格学习。")) return;

  try {
    const res = await fetch(`/api/inspirations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      alert("删除成功，系统知识库已完成修剪。");
      loadKnowledgeList();
    } else {
      alert(data.message || "删除失败");
    }
  } catch {
    alert("删除请求失败，请检查网络。");
  }
}

async function handleClearAllInspirations() {
  const cards = document.querySelectorAll("#knowledgeList .knowledge-card");
  if (!confirm(`确定要清空 ${cards.length} 条个人学习素材吗？\n\n此操作不可恢复，清空后生成质量将依赖默认策略。`)) return;

  const btn = document.querySelector("#clearAllInspirationsBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "清空中...";
  }

  try {
    const res = await fetch("/api/inspirations/clear-all", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeAdmin: false })
    });
    const data = await res.json();
    if (data.ok) {
      alert(`已清空 ${data.deleted} 条素材，系统已重置为默认状态。`);
      loadKnowledgeList();
    } else {
      alert(data.message || "清空失败，请重试。");
    }
  } catch {
    alert("网络错误，请检查连接。");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "清空全部";
    }
  }
}

window.handleDeleteInspiration = handleDeleteInspiration;
window.handleClearAllInspirations = handleClearAllInspirations;
window.loadKnowledgeList = loadKnowledgeList;

document.addEventListener("DOMContentLoaded", () => {
  initLearningEvents();
  loadKnowledgeList();
  if (typeof loadSubjectKnowledgeFullList === "function") loadSubjectKnowledgeFullList();
  if (typeof initSubjectKnowledgeExpandEvents === "function") initSubjectKnowledgeExpandEvents();

  // ── 字数统计联动 ──
  const rawEl = document.getElementById("learnRawText");
  const countEl = document.getElementById("learnCharCount");
  if (rawEl && countEl) {
    const syncCount = () => { countEl.textContent = rawEl.value.replace(/\s/g, "").length; };
    rawEl.addEventListener("input", syncCount);
    syncCount();
  }

  // ── 文件导入名称显示 ──
  const importEl2 = document.getElementById("learnImportTxt");
  const importLabel = document.getElementById("learnImportLabel");
  const fileZone = document.querySelector(".lp-file-zone");
  if (importEl2 && importLabel) {
    importEl2.addEventListener("change", () => {
      const file = importEl2.files[0];
      if (file) {
        importLabel.textContent = `✓ ${file.name}`;
        if (fileZone) fileZone.classList.add("has-file");
      } else {
        importLabel.textContent = "选择文件 / 拖放至此";
        if (fileZone) fileZone.classList.remove("has-file");
      }
    });
  }

  // ── 结果区：初始隐藏 ──
  const resultArea = document.getElementById("learnResultArea");
  if (resultArea) resultArea.style.display = "none";
});
