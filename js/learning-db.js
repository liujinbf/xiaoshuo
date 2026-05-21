// ============================================================
// 模块: learning-db.js — 爆款拆解灵感数据库管理及打分检索机制
// ============================================================

// 题材智能归档对应的中文翻译字典
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

// 兜底 HTML 转义，防止 XSS 攻击
const localEscapeHtml = window.escapeHtml || ((str) => {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
});
if (!window.escapeHtml) {
  window.escapeHtml = localEscapeHtml;
}


// 获取本地专属的用户唯一标识查询串
function knowledgeUserIdQuery() {
  const key = typeof USER_KEY !== "undefined" ? USER_KEY : "novel_draft_user_id";
  let uid = localStorage.getItem(key);
  if (!uid) {
    if (typeof getUserId === "function") {
      uid = getUserId();
    } else {
      const cryptoObj = typeof window !== "undefined" ? (window.crypto || {}) : {};
      uid = `local_${cryptoObj.randomUUID ? cryptoObj.randomUUID() : Date.now()}`;
      localStorage.setItem(key, uid);
    }
  }
  return uid ? `?userId=${encodeURIComponent(uid)}` : "";
}

// 切割清洗召回匹配用分词词组
function tokenizeKnowledgeText(value) {
  return String(value || "")
    .split(/[，。！？、；：\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

// 召回打分逻辑：题材契合得 30 分，每个特征词匹配得 10 分
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

// 特殊噪声文本清理过滤正则化
function normalizeKnowledgeText(value = "") {
  return String(value)
    .replace(/[|｜/\\.\[\]【】（）(){}<>《》「」『』·*＊_\-—=~～!！^]+/g, "")
    .replace(/\s+/g, "");
}

// 过滤掉系统自带的脏词、推广广告及格式错误素材
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

// 基于当前大纲与题材召回最相关的 3 条灵感数据 (RAG)
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

// 保存当前爆款拆解结果到专属数据库中
async function handleSaveInspiration() {
  // 防止双重触发（模板 onclick + addEventListener 各触发一次）
  if (window._savingInspiration) {
    console.warn("[LearningDB] handleSaveInspiration called while already saving, ignoring duplicate.");
    return;
  }
  const btn = document.querySelector("#saveInspirationBtn");
  const dissected = window.currentDissected;
  if (!dissected) {
    if (typeof window.showToast === "function") {
      window.showToast("没有检测到已拆解的素材，请先粘贴原文并点击开始拆解学习", "error");
    } else {
      alert("没有检测到已拆解的素材，请先粘贴原文并点击开始拆解学习");
    }
    return;
  }

  window._savingInspiration = true;
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
      if (typeof window.showToast === "function") {
        window.showToast(data.message || "保存失败", "error");
      } else {
        alert(data.message || "保存失败");
      }
      return;
    }

    if (typeof window.showToast === "function") {
      window.showToast("拆解学习成功，该爆款设想已存入本地灵感库。", "success");
    } else {
      alert("拆解学习成功，该爆款设想已存入本地灵感库。");
    }
    const rawEl = document.querySelector("#learnRawText");
    const emptyEl = document.querySelector("#learnEmptyState");
    const resultEl = document.querySelector("#learnResultArea");
    if (rawEl) rawEl.value = "";
    if (emptyEl) {
      emptyEl.classList.remove("lp-hide");
      const iconEl = emptyEl.querySelector(".lp-empty-icon");
      const titleEl = emptyEl.querySelector(".lp-empty-title");
      const hintEl = emptyEl.querySelector(".lp-empty-hint");
      if (iconEl) {
        iconEl.textContent = "🧬";
        iconEl.classList.remove("lp-spin");
      }
      if (titleEl) titleEl.textContent = "等待拆解结果";
      if (hintEl) hintEl.textContent = "粘贴爆款原文并点击「让 AI 开始拆解学习」";
    }
    if (resultEl) resultEl.classList.add("lp-hide");
    window.currentDissected = null;
    loadKnowledgeList();
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === "function") {
      window.showToast("保存网络错误，请稍后再试", "error");
    } else {
      alert("保存网络错误。");
    }
  } finally {
    window._savingInspiration = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "保存为专属灵感库";
    }
  }
}

// 动态创建并渲染“清空全部”动作按钮
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

// 加载本地专属灵感数据库列表
async function loadKnowledgeList() {
  if (window._loadingKnowledge) {
    console.log("[LearningDB] loadKnowledgeList is already in progress, skipping.");
    return;
  }
  window._loadingKnowledge = true;

  console.log("[LearningDB] Starting loadKnowledgeList...");
  const listEl = document.querySelector("#knowledgeList");
  const countEl = document.querySelector("#knowledgeCount");
  const emptyEl = document.querySelector("#knowledgeEmptyState");
  if (!listEl) {
    console.warn("[LearningDB] #knowledgeList element not found, skipping list render.");
    window._loadingKnowledge = false;
    return;
  }

  // 显示加载中状态提示
  if (emptyEl) {
    emptyEl.style.display = "block";
    emptyEl.textContent = "🧬 正在努力从本地数据库加载专属灵感库...";
  }
  listEl.style.display = "none";

  try {
    const url = `/api/inspirations${knowledgeUserIdQuery()}`;
    console.log(`[LearningDB] Fetching inspirations from: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    console.log("[LearningDB] Received data:", data);
    
    if (!data.ok || !Array.isArray(data.inspirations)) {
      if (countEl) countEl.textContent = "加载失败";
      throw new Error(data.message || "接口返回了未预期的格式或 ok=false");
    }

    const rawList = data.inspirations;
    const list = rawList.filter((item, idx) => {
      const usable = isUsableKnowledgeItem(item);
      if (!usable) {
        console.warn(`[LearningDB] Item at index ${idx} filtered out by isUsableKnowledgeItem. Item:`, item);
      }
      return usable;
    }).slice(0, 100);
    
    console.log(`[LearningDB] Loaded ${list.length} usable items out of ${rawList.length} total raw items`);

    if (countEl) {
      // 新版 UI：knowledgeCount 是 lp-stat-num，只显示纯数字
      countEl.textContent = list.length;
      countEl.style.borderColor = "";
      ensureClearAllButton(countEl, list.length);
    }

    if (list.length === 0) {
      console.log("[LearningDB] No usable items to display. Rendering empty state.");
      if (emptyEl) { 
        emptyEl.style.display = "block"; 
        emptyEl.style.flex = ""; 
        emptyEl.textContent = `还没有学习过任何素材，快去拆解第一篇爆款吧！[诊断：请求URL=${url}, 接口返回原始条数=${rawList ? rawList.length : 'null'}, 过滤通过=${list.length}]`;
      }
      listEl.style.display = "none";
      listEl.innerHTML = "";
      window._loadingKnowledge = false;
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    listEl.style.display = "grid";
    listEl.innerHTML = list.map((item) => {
      let formattedDate = "未知";
      try {
        if (item.created_at) {
          const d = new Date(item.created_at);
          formattedDate = isNaN(d.getTime()) ? String(item.created_at) : d.toLocaleDateString();
        }
      } catch (dateErr) {
        console.error("[LearningDB] Error parsing item.created_at:", dateErr, item);
        formattedDate = String(item.created_at || "未知");
      }

      const safeGenre = localEscapeHtml(genreLabels[item.genre] || item.genre || "未分类");
      const safeUserId = localEscapeHtml(item.user_id || "");
      const safeId = localEscapeHtml(item.id || "");
      const safeTheme = localEscapeHtml(item.theme || "");
      const safeHook = localEscapeHtml(item.hook || "");
      const safeOutline = localEscapeHtml(String(item.outline || "").split(";").join(" -> "));
      const safeRawText = item.raw_text ? localEscapeHtml(item.raw_text) : "";
      const safeRawTextSlice = item.raw_text ? localEscapeHtml(String(item.raw_text).slice(0, 80)) : "";

      return `
        <div class="knowledge-card">
          <div class="knowledge-card-head">
            <div class="knowledge-card-tags">
              <span class="knowledge-card-tag primary">${safeGenre}</span>
              <span class="knowledge-card-tag ${safeUserId === "admin" ? "system" : "private"}">
                ${safeUserId === "admin" ? "批量导入" : "专属自学"}
              </span>
            </div>
            ${safeUserId !== "admin" ? `
              <button class="knowledge-delete-btn" onclick="handleDeleteInspiration('${safeId}')" title="删除已学模型">删除</button>
            ` : `
              <span class="knowledge-lock">系统锁定</span>
            `}
          </div>
          <h4>${safeTheme}</h4>
          <div class="knowledge-card-body">
            <div><strong>开篇钩子：</strong>${safeHook}</div>
            <div><strong>骨架大纲：</strong>${safeOutline}</div>
          </div>
          ${safeRawText ? `<p class="knowledge-card-quote" title="${safeRawText}">“${safeRawTextSlice}...”</p>` : ""}
          <div class="knowledge-card-meta">
            <span>学习时间：${localEscapeHtml(formattedDate)}</span>
            <span>RAG 已召回</span>
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("加载专属知识库失败：", error);
    if (countEl) countEl.textContent = "网络异常";
    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.textContent = "❌ 数据载入异常，请检查网络或刷新页面重试。";
    }
    const errorMsg = `加载专属知识库运行时异常:\n${error.message}\n${error.stack || ""}`;
    if (typeof window.showToast === "function") {
      window.showToast(errorMsg, "error");
    } else {
      alert(errorMsg);
    }
  } finally {
    window._loadingKnowledge = false;
  }
}

// 删除单条专属素材条目
async function handleDeleteInspiration(id) {
  if (!confirm("确定要删除该专属爆款模型吗？删除后系统将无法检索此段落进行写作风格学习。")) return;

  try {
    const res = await fetch(`/api/inspirations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      if (typeof window.showToast === "function") {
        window.showToast("删除成功，系统知识库已完成修剪。", "success");
      } else {
        alert("删除成功，系统知识库已完成修剪。");
      }
      loadKnowledgeList();
    } else {
      if (typeof window.showToast === "function") {
        window.showToast(data.message || "删除失败", "error");
      } else {
        alert(data.message || "删除失败");
      }
    }
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === "function") {
      window.showToast("删除请求失败，请检查网络。", "error");
    } else {
      alert("删除请求失败，请检查网络。");
    }
  }
}

// 清空所有自己保存的专属自学素材
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
      if (typeof window.showToast === "function") {
        window.showToast(`已清空 ${data.deleted} 条素材，系统已重置为默认状态。`, "success");
      } else {
        alert(`已清空 ${data.deleted} 条素材，系统已重置为默认状态。`);
      }
      loadKnowledgeList();
    } else {
      if (typeof window.showToast === "function") {
        window.showToast(data.message || "清空失败，请重试。", "error");
      } else {
        alert(data.message || "清空失败，请重试。");
      }
    }
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === "function") {
      window.showToast("网络错误，请检查连接。", "error");
    } else {
      alert("网络错误，请检查连接。");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "清空全部";
    }
  }
}

// 挂载到 window 全局以实现低耦合作用域互通
window.genreLabels = genreLabels;
window.knowledgeUserIdQuery = knowledgeUserIdQuery;
window.tokenizeKnowledgeText = tokenizeKnowledgeText;
window.scoreKnowledgeItem = scoreKnowledgeItem;
window.normalizeKnowledgeText = normalizeKnowledgeText;
window.isUsableKnowledgeItem = isUsableKnowledgeItem;
window.matchKnowledgeForInput = matchKnowledgeForInput;
window.handleSaveInspiration = handleSaveInspiration;
window.ensureClearAllButton = ensureClearAllButton;
window.loadKnowledgeList = loadKnowledgeList;
window.handleDeleteInspiration = handleDeleteInspiration;
window.handleClearAllInspirations = handleClearAllInspirations;
