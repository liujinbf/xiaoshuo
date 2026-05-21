// ============================================================
// 模块: serial-render.js — 连载模块 UI 渲染与 DOM 交互
// ════════════════════════════════════════════════════════════
// 依赖: serial.js 提供数据与逻辑
// ============================================================

function renderNovelList() {
  const listEl = document.querySelector("#serialNovelList");
  if (!serialNovels.length) {
    listEl.innerHTML = `<p class="serial-empty-hint">暂无连载，创建一部开始吧</p>`;
    return;
  }
  listEl.innerHTML = serialNovels.map((novel) => `
    <div class="novel-card ${currentNovel?.id === novel.id ? "active" : ""}" data-id="${novel.id}">
      <div class="novel-card-info">
        <strong>${escapeHtml(novel.title)}</strong>
        <span>${novel.genre} · ${novel.chapters.length}/${novel.targetChapters} 章</span>
      </div>
      <button class="novel-delete-btn" data-id="${novel.id}" title="删除">×</button>
    </div>
  `).join("");

  listEl.querySelectorAll(".novel-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("novel-delete-btn")) return;
      const novel = serialNovels.find((n) => n.id === card.dataset.id);
      if (novel) selectNovel(novel);
    });
  });

  listEl.querySelectorAll(".novel-delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm("确定删除这部连载及全部章节？")) {
        deleteNovel(id);
      }
    });
  });
}

function selectNovel(novel) {
  window.currentNovel = novel;
  window.dispatchEvent(new CustomEvent("currentNovelChanged", { detail: novel })); // 触发广播事件

  document.querySelector("#serialEmptyState").hidden = true;
  document.querySelector("#serialWorkspace").hidden = false;
  document.querySelector("#chapterReader").hidden = true;
  document.querySelector("#serialWsTitle").textContent = novel.title;
  document.querySelector("#serialProgressBadge").textContent = `第 ${novel.chapters.length}/${novel.targetChapters} 章`;

  // 最新记忆
  const lastChapter = novel.chapters[novel.chapters.length - 1];
  const summaryBar = document.querySelector("#serialSummaryBar");
  const summaryText = document.querySelector("#serialLastSummary");
  if (lastChapter?.summary) {
    summaryBar.hidden = false;
    summaryText.textContent = lastChapter.summary;
  } else {
    summaryBar.hidden = true;
  }

  renderChapterList(novel);
  renderNovelList();
}

function renderChapterList(novel) {
  const listEl = document.querySelector("#serialChapterList");
  if (!novel.chapters.length) {
    listEl.innerHTML = `<p class="chapter-empty-hint">还没有章节，点击"铸造下一章"开始生成</p>`;
    return;
  }
  listEl.innerHTML = [...novel.chapters].reverse().map((ch) => `
    <div class="chapter-card">
      <div class="chapter-card-meta">
        <strong>第 ${ch.index} 章</strong>
        <span>${ch.wordCount?.toLocaleString() || 0} 字 · ${new Date(ch.createdAt).toLocaleDateString("zh-CN")}</span>
      </div>
      ${ch.summary ? `<p class="chapter-card-summary">${escapeHtml(ch.summary)}</p>` : ""}
      <div class="chapter-card-actions" style="display:flex; gap:8px;">
        <button class="chapter-read-btn" data-index="${ch.index}" style="flex:1;">阅读全文 →</button>
        <button class="chapter-script-btn ghost-action" data-index="${ch.index}" style="padding:4px 8px; font-size:11px;">🎭 AI 脚本</button>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".chapter-read-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ch = novel.chapters.find((c) => c.index === Number(btn.dataset.index));
      if (ch) openChapterReader(ch);
    });
  });

  listEl.querySelectorAll(".chapter-script-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ch = novel.chapters.find((c) => c.index === Number(btn.dataset.index));
      if (ch && typeof convertChapterToScript === "function") {
        convertChapterToScript(ch);
      }
    });
  });
}

function openChapterReader(chapter) {
  document.querySelector("#chapterReaderLabel").textContent = `第 ${chapter.index} 章`;
  document.querySelector("#chapterReaderBody").innerHTML = chapter.content
    .split(/\n+/)
    .map((p) => p.trim() ? `<p>${escapeHtml(p)}</p>` : "")
    .join("");
  document.querySelector("#chapterReader").hidden = false;
  document.querySelector("#chapterReader").scrollTop = 0;
}

function setSerialGeneratingState(isGenerating, isBatch = false) {
  const genBtn = document.querySelector("#generateChapterBtn");
  const batchBtn = document.querySelector("#batchGenerateBtn");
  
  if (isGenerating) {
    if (isBatch) {
      batchBtn.classList.add("danger-action");
    } else {
      genBtn.disabled = true;
      genBtn.textContent = "铸造中…";
    }
  } else {
    genBtn.disabled = false;
    genBtn.textContent = "✨ 单章铸造";
    batchBtn.classList.remove("danger-action");
    batchBtn.textContent = "🚀 批量全自动铸造";
  }
}
