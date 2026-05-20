// ============================================================
// 模块: planner-render.js — 故事方案界面渲染与 DOM 交互
// 依赖: planner.js, utils.js, ai.js
// ============================================================

function getDraftEditorEl() { return document.querySelector("#draftEditor"); }
function getDraftStatsEl() { return document.querySelector("#draftStats"); }

function renderDraft(draft) {
  const el = getDraftEditorEl();
  if (el) {
    el.value = draft.join("\n\n");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  syncDraftFromEditor();
}

function getDraftText() {
  const el = getDraftEditorEl();
  return el ? el.value.trim() : "";
}

function getDraftParagraphs() {
  const el = getDraftEditorEl();
  return el ? splitParagraphs(el.value) : [];
}

function countChineseLikeChars(text) {
  return text.replace(/\s/g, "").length;
}

function getPlanDisplayTitle(plan = window.currentPlan) {
  const manualTitle = document.querySelector("#storyTitle")?.value?.trim();
  if (manualTitle) return manualTitle;
  if (plan?.displayTitle) return plan.displayTitle;
  if (plan?.titles?.[0]) return plan.titles[0];
  if (plan?.input?.theme) {
    return typeof compactTheme === "function" ? compactTheme(plan.input.theme) : plan.input.theme;
  }
  const themeTitle = document.querySelector("#theme")?.value?.trim();
  if (themeTitle) return typeof compactTheme === "function" ? compactTheme(themeTitle) : themeTitle;
  return "未命名故事";
}

function syncProjectChrome(plan = window.currentPlan, options = {}) {
  const title = options.title || getPlanDisplayTitle(plan);
  const safeTitle = typeof escapeHtml === "function" ? escapeHtml(title) : title;

  const topBarProj = document.querySelector("#desktopProjectName");
  if (topBarProj) topBarProj.textContent = `项目：${title}`;

  const edTitle = document.querySelector("#editorChapterTitle");
  if (edTitle) {
    edTitle.innerHTML = `第 1 章  <span class="ch-name">${safeTitle}</span> <span class="editor-action-tag">正文编辑</span>`;
  }

  const tabEl = document.querySelector("#chapterStrip button.active");
  if (tabEl) tabEl.textContent = `正文稿：${title} ×`;
}

window.syncProjectChrome = syncProjectChrome;

function updateDraftStats() {
  const text = getDraftText();
  const charCount = countChineseLikeChars(text);
  const paragraphCount = getDraftParagraphs().length;
  const statsEl = getDraftStatsEl();
  if (statsEl) statsEl.textContent = `${charCount} 字 · ${paragraphCount} 段`;

  const plan = window.currentPlan;
  const target = plan ? plan.input.length : 8000;
  const percent = Math.min(100, Math.round((charCount / target) * 100));
  const fill = document.querySelector("#draftProgressFill");
  if (fill) {
    fill.style.width = `${percent}%`;
    fill.classList.toggle("near", percent >= 75 && percent < 100);
    fill.classList.toggle("done", percent >= 100);
  }
}

function syncDraftFromEditor() {
  if (window.currentPlan) {
    window.currentPlan.draft = getDraftParagraphs();
  }
  updateDraftStats();
}

function renderPlanData(plan) {
  // 确保数据已标准化
  if (typeof normalizePlan === "function") {
    plan = normalizePlan(plan);
  }
  window.currentPlan = plan;
  
  document.querySelector("#projectTitle").textContent = `${plan.profile.label}：${plan.input.theme}`;
  syncProjectChrome(plan);
  
  document.querySelector("#titleList").innerHTML = plan.titles.map((title) => `<div class="title-item">${escapeHtml(title)}</div>`).join("");
  document.querySelector("#hookText").textContent = plan.hook;
  document.querySelector("#outlineList").innerHTML = plan.outline.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  
  const importBtn = document.querySelector("#importToSerialBtn");
  if (importBtn) importBtn.style.display = "inline-block";
  
  const memoryItems = [
    ...plan.characters.map((item, index) => ({
      title: item.name || item.role,
      type: item.role,
      weight: index === 0 ? "高" : index < 3 ? "中" : "低",
      text: item.motive,
      tags: [item.role, index === 0 ? "主线" : "伏笔"]
    })),
    ...plan.evidenceChain.slice(0, 2).map((item, index) => ({
      title: item.clue,
      type: item.stage || "线索",
      weight: index === 0 ? "高" : "中",
      text: item.purpose || item.payoff,
      tags: ["线索", item.appears || "回收"]
    })),
    {
      title: "旧物",
      type: "场景",
      weight: "中",
      text: plan.input?.theme || "承载故事核心情绪和关键记忆的物件。",
      tags: ["意象", "氛围"]
    }
  ].slice(0, 5);

  document.querySelector("#characterList").innerHTML = memoryItems
    .map((item, index) => `
      <div class="asset-item memory-card" data-type="${escapeHtml(item.type)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="memory-meta">${escapeHtml(item.type)} · 重要度：${escapeHtml(item.weight)}</span>
        <p>${escapeHtml(item.text)}</p>
        <em>${escapeHtml((item.tags || [])[0] || item.type)}</em>
      </div>
    `)
    .join("");

    
  document.querySelector("#marketList").innerHTML = plan.marketBeats
    .map((item) => `
      <div class="market-card">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text)}</p>
      </div>
    `)
    .join("");
    
  document.querySelector("#evidenceList").innerHTML = plan.evidenceChain
    .map((item) => `
      <div class="evidence-card">
        <span class="evidence-meta">${escapeHtml(item.stage)} · ${escapeHtml(item.appears)}</span>
        <strong>${escapeHtml(item.clue)}</strong>
        <p>${escapeHtml(item.purpose)}</p>
        <p>${escapeHtml(item.payoff)}</p>
      </div>
    `)
    .join("");
    
  document.querySelector("#episodeList").innerHTML = plan.dramaEpisodes
    .map((item) => `
      <div class="episode-card">
        <span class="episode-meta">第 ${escapeHtml(item.episode)} 集</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.premise)}</p>
        <p>${escapeHtml(item.cliffhanger)}</p>
      </div>
    `)
    .join("");
    
  renderDraft(plan.draft);
  
  if (typeof checkDraftConsistency === "function" && typeof renderConsistency === "function") {
    renderConsistency(checkDraftConsistency(plan));
  }
  
  document.querySelector("#scoreList").innerHTML = plan.scores
    .map(([name, value]) => `
      <div class="score-row">
        <div class="score-meta"><span>${name}</span><span>${value}</span></div>
        <div class="meter"><span style="width:${value}%"></span></div>
      </div>
    `)
    .join("");
    
  document.querySelector("#diagnosisText").textContent = plan.diagnosis;
  document.querySelector("#proposalPack").innerHTML = `
    <div class="proposal-header">
      <div class="proposal-score-badge">
        <span class="label">变现评分</span>
        <span class="value">${escapeHtml(plan.proposalPack.score)}</span>
      </div>
    </div>
    
    <div class="proposal-grid">
      ${plan.proposalPack.positioning
        .map((item) => `
          <div class="proposal-card">
            <div class="p-label">${escapeHtml(item.label)}</div>
            <div class="p-text">${escapeHtml(item.text)}</div>
          </div>
        `)
        .join("")}
    </div>

    <div class="pitch-container">
      <div class="p-section-title">投稿 Pitch</div>
      <div class="pitch-card">
        <h4 class="pitch-title">${escapeHtml(plan.proposalPack.pitch.title)}</h4>
        <div class="pitch-logline">${escapeHtml(plan.proposalPack.pitch.logline)}</div>
        <div class="pitch-synopsis">${escapeHtml(plan.proposalPack.pitch.synopsis)}</div>
        <div class="pitch-note">💡 ${escapeHtml(plan.proposalPack.pitch.editorNote)}</div>
      </div>
    </div>

    <div class="routes-container">
      <div class="p-section-title">商业化路径建议</div>
      <div class="route-grid">
        ${plan.proposalPack.routes
          .map((item) => `
            <div class="route-card">
              <div class="r-header">
                <span class="r-name">${escapeHtml(item.name)}</span>
                <span class="r-tag">${escapeHtml(item.speed)}</span>
              </div>
              <div class="r-revenue">${escapeHtml(item.revenue)}</div>
              <div class="r-action">${escapeHtml(item.action)}</div>
            </div>
          `)
          .join("")}
      </div>
    </div>

    <div class="checklist-container">
      <div class="p-section-title">投前自查清单</div>
      <ul class="proposal-checklist">
        ${plan.proposalPack.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderPlan(input) {
  if (typeof buildPlan !== "function") return;
  const plan = buildPlan(input);
  window.currentPlan = plan; 
  renderPlanData(plan);
}

// ── 从 planner.js 迁入：题材预设与标签云联动更新 ──
// planner.js 只调用此函数，不持有业务逻辑
/**
 * 根据选中的题材更新主题输入框和标签云
 * @param {string} genre - 题材标识符
 * @param {boolean} autoRandomTheme - 是否自动随机填入主题
 */
function updateGenrePresets(genre, autoRandomTheme = true) {
  const themeInput = document.querySelector("#theme");
  const tagCloud = document.querySelector("#tagCloud");

  if (themeInput && typeof inspirationPool !== "undefined" && typeof pick === "function") {
    const pool = inspirationPool[genre];
    if (pool && pool.length > 0 && autoRandomTheme) {
      themeInput.value = pick(pool);
    }
  }

  if (tagCloud && typeof genreTags !== "undefined") {
    const tags = genreTags[genre] || [];
    tagCloud.innerHTML = "";
    tags.forEach((tag, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = idx < 2 ? "tag active" : "tag";
      btn.dataset.tag = tag;
      btn.textContent = tag;
      tagCloud.appendChild(btn);
    });
  }
}

// ===== 学科知识库自动关联与渲染逻辑 =====

const CATEGORY_NAMES = {
  history: "历史",
  geography: "地理",
  physics: "物理",
  chemistry: "化学",
  science: "科技",
  people: "人物"
};

/**
 * 请求后端获取输入文本关联的公开常识库并渲染
 * @param {string} text 
 */
async function refreshSubjectKnowledge(text) {
  const listEl = document.getElementById("subjectKnowledgeList");
  if (!listEl) return;
  
  if (!text || text.trim().length < 2) {
    listEl.innerHTML = `<div class="empty-placeholder" style="color:var(--text-muted);font-size:12px;padding:10px;text-align:center;">暂无匹配常识约束</div>`;
    return;
  }

  try {
    const token = localStorage.getItem("token") || "mock-token";
    const res = await fetch("/api/knowledge/retrieve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ text, limit: 3 })
    });
    
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && Array.isArray(data.matched)) {
      if (data.matched.length === 0) {
        listEl.innerHTML = `<div class="empty-placeholder" style="color:var(--text-muted);font-size:12px;padding:10px;text-align:center;">暂无匹配常识约束</div>`;
      } else {
        listEl.innerHTML = data.matched.map(item => `
          <div class="consistency-item" style="border-left: 3px solid var(--accent); padding-left: 8px; margin-bottom: 8px; background: rgba(23, 107, 84, 0.05); padding: 6px 8px; border-radius: 4px;">
            <div style="font-weight: bold; font-size: 13px; color: var(--accent); margin-bottom: 2px;">
              [${CATEGORY_NAMES[item.category] || item.category}] ${escapeHtml(item.entity)}
            </div>
            <div style="font-size: 12px; line-height: 1.4; color: var(--text-color);">
              ${escapeHtml(item.content)}
            </div>
          </div>
        `).join("");
      }
    }
  } catch (error) {
    console.error("[Subject Knowledge Render] Failed to fetch and render:", error);
  }
}

let subjectKnowledgeTimeout = null;
function refreshSubjectKnowledgeDebounced(text) {
  if (subjectKnowledgeTimeout) clearTimeout(subjectKnowledgeTimeout);
  subjectKnowledgeTimeout = setTimeout(() => {
    refreshSubjectKnowledge(text);
  }, 400);
}

window.refreshSubjectKnowledge = refreshSubjectKnowledge;
window.refreshSubjectKnowledgeDebounced = refreshSubjectKnowledgeDebounced;

