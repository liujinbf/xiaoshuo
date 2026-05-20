// ============================================================
// desktop-ui.js — 桌面UI交互逻辑
// 处理工具栏代理点击、导航栏切换、生成状态更新
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // 1. 工具栏代理点击 (data-click-target)
  document.querySelectorAll('[data-click-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.viewMode) {
        window.currentShortViewMode = btn.dataset.viewMode;
      }
      const target = document.querySelector(btn.dataset.clickTarget);
      if (target) target.click();
    });
  });

  // 2. 统一路由选项卡管理器
  const resultGrid = document.querySelector('.result-grid');
  const tabShort = document.getElementById('tabShort');
  const tabSerial = document.getElementById('tabSerial');
  const tabLearn = document.getElementById('tabLearn');

  const panels = {
    short: document.getElementById('panelShort'),
    serial: document.getElementById('panelSerial'),
    learn: document.getElementById('panelLearn'),
    task: document.getElementById('panelTask'),
    world: document.getElementById('panelWorld'),
    admin: document.getElementById('panelAdmin')
  };
  const tabs = {
    short: tabShort,
    serial: tabSerial,
    learn: tabLearn,
    task: document.getElementById('tabTask'),
    world: document.getElementById('tabWorld'),
    admin: document.getElementById('tabAdmin')
  };

  function setEditMode() {
    if (resultGrid) resultGrid.classList.remove('show-plan');
  }
  function setPlanMode() {
    if (resultGrid) resultGrid.classList.add('show-plan');
  }

  function switchWorkspaceTab(targetName) {
    // 0. 联动左二侧栏对应的控制面板显隐
    const controlShort = document.getElementById('controlShortContainer');
    const controlSerial = document.getElementById('controlSerialContainer');
    const controlLearn = document.getElementById('controlLearnContainer');
    
    if (controlShort) controlShort.hidden = (targetName !== 'short');
    if (controlSerial) controlSerial.hidden = (targetName !== 'serial');
    if (controlLearn) controlLearn.hidden = (targetName !== 'learn');

    // 0.5 动态更新 body 类名实现网格自适应锁屏自锁
    document.body.classList.remove('layout-short', 'layout-serial', 'layout-learn', 'layout-task', 'layout-world', 'layout-admin');
    document.body.classList.add(`layout-${targetName}`);

    // === 强力动态布局重塑，彻底解决控制面板隐藏后的 390px 大留白和拉长问题 ===
    const appShell = document.querySelector('.app-shell');
    const controlPanel = document.querySelector('.control-panel');
    if (appShell && controlPanel) {
      if (targetName === 'task' || targetName === 'world' || targetName === 'admin') {
        controlPanel.style.setProperty('display', 'none', 'important');
        appShell.style.setProperty('grid-template-columns', '196px minmax(760px, 1fr) 350px', 'important');
      } else {
        controlPanel.style.removeProperty('display');
        appShell.style.removeProperty('grid-template-columns');
      }
    }

    // 1. 显隐工作面板
    Object.entries(panels).forEach(([name, panel]) => {
      if (panel) panel.hidden = (name !== targetName);
    });

    // 2. 选项卡高亮
    Object.entries(tabs).forEach(([name, tab]) => {
      if (tab) tab.classList.toggle('active', name === targetName);
    });

    // 2.5 联动左侧 Rail 导航项的高亮
    document.querySelectorAll('.desktop-rail-item').forEach(item => {
      const clickTarget = item.dataset.clickTarget || '';
      const matchName = clickTarget.replace('#tab', '').toLowerCase();
      if (matchName === 'short') {
        const itemMode = item.dataset.viewMode || 'edit';
        const activeMode = window.currentShortViewMode || 'edit';
        item.classList.toggle('active', itemMode === activeMode && targetName === 'short');
      } else {
        item.classList.toggle('active', matchName === targetName);
      }
    });

    // 3. 规划/编辑模式切换
    if (targetName === 'short') {
      const activeMode = window.currentShortViewMode || 'edit';
      if (activeMode === 'edit') {
        setEditMode();
      } else {
        setPlanMode();
      }
    } else {
      setEditMode();
    }

    // 4. 触发各个面板的生命周期数据加载
    if (targetName === 'serial') {
      if (typeof window.loadNovels === 'function') {
        window.loadNovels();
      }
    } else if (targetName === 'learn') {
      if (typeof window.loadKnowledgeList === 'function') {
        window.loadKnowledgeList();
      }
      if (typeof window.loadSubjectKnowledgeFullList === 'function') {
        window.loadSubjectKnowledgeFullList();
      }
    } else if (targetName === 'admin') {
      if (typeof window.initAdminPanel === 'function') {
        window.initAdminPanel();
      }
    }
  }

  // 暴露给全局以便其他脚本按需调用
  window.switchWorkspaceTab = switchWorkspaceTab;

  // 唯一绑定选项卡点击事件
  Object.entries(tabs).forEach(([name, tab]) => {
    if (tab) {
      tab.addEventListener('click', () => switchWorkspaceTab(name));
    }
  });

  // 默认编辑主视图（不加 show-plan）

  // 3. 导航栏点击切换高亮
  document.querySelectorAll('.desktop-rail-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.desktop-rail-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // 4. 编辑器实时状态栏更新
  const editor = document.getElementById('draftEditor');
  const elWordCount    = document.getElementById('editorWordCount');
  const elChapterWords = document.getElementById('editorChapterWords');
  const elReadTime     = document.getElementById('editorReadTime');
  const elAutoSave     = document.getElementById('editorAutoSave');

  function updateEditorStatus() {
    if (!editor) return;
    const text = editor.value;
    const len  = text.replace(/\s/g, '').length;
    const mins = Math.max(1, Math.ceil(len / 300));
    if (elWordCount)    elWordCount.textContent    = `字数 ${len}`;
    if (elChapterWords) elChapterWords.textContent = `章节字数 ${len}`;
    if (elReadTime)     elReadTime.textContent     = `预计阅读 ${mins} 分钟`;
  }

  if (editor) {
    editor.addEventListener('input', updateEditorStatus);
    updateEditorStatus();
  }

  // 保存时更新自动保存时间
  const saveBtn2 = document.getElementById('saveProjectBtn');
  const statusbarSaveEl = document.getElementById('statusbarSaveTime');
  if (saveBtn2 && elAutoSave) {
    saveBtn2.addEventListener('click', () => {
      setTimeout(() => {
        const now = new Date();
        const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        elAutoSave.textContent = `自动保存 ${t}`;
        if (statusbarSaveEl) statusbarSaveEl.textContent = `自动保存：${t}`;
      }, 400);
    });
  }

  // 5. 配额圆形进度图联动
  function updateQuotaCircle() {
    const arc    = document.getElementById('quotaArc');
    const pctEl  = document.getElementById('quotaPct');
    const totalEl  = document.getElementById('quotaTotal');
    const usedEl   = document.getElementById('quotaUsed');
    const remainEl = document.getElementById('quotaRemain');
    const resetEl  = document.getElementById('quotaReset');
    if (!arc || typeof readBilling !== 'function') return;

    const bs = readBilling();
    const tier = typeof effectiveTier === 'function' ? effectiveTier(bs) : (bs.tier || 'free');
    const limits = typeof QUOTA_LIMITS !== 'undefined' ? (QUOTA_LIMITS[tier] || QUOTA_LIMITS.free) : { ideas: 20, saves: 8, ai: 3 };
    const total = Object.values(limits).reduce((sum, value) => sum + Number(value || 0), 0);
    const used = Object.keys(limits).reduce((sum, key) => sum + Number(bs.usage?.[key] || 0), 0);
    const remain = Math.max(0, total - used);
    const pct    = Math.min(100, Math.round((used / total) * 100));

    const circumference = 276;
    const offset = circumference * (1 - pct / 100);
    arc.style.strokeDasharray = String(circumference);
    arc.style.strokeDashoffset = offset;

    if (pctEl)    pctEl.textContent    = `${pct}%`;
    if (totalEl)  totalEl.textContent  = total >= 10000 ? `${total.toLocaleString()}次` : `${total}次`;
    if (usedEl)   usedEl.textContent   = `${used}次`;
    if (remainEl) remainEl.textContent = remain >= 10000 ? `${remain.toLocaleString()}次` : `${remain}次`;

    // 重置时间：次日 00:00
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1); tmr.setHours(0,0,0,0);
    const diff = tmr - new Date();
    const h = String(Math.floor(diff/3600000)).padStart(2,'0');
    const m = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    const s = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    if (resetEl) resetEl.textContent = `${h}:${m}:${s}`;
  }

  // 6. 类型芯片联动隐藏下拉菜单
  window.setGenre = function(value, chipEl) {
    const sel = document.getElementById('genre');
    if (sel) sel.value = value;
    document.querySelectorAll('#genreChips .tag').forEach(b => b.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');
    // 触发 genre change 事件（更新主题预设）
    sel && sel.dispatchEvent(new Event('change'));
  };

  function updateProjectChromeFromTitleInput(value) {
    const title = value.trim();
    if (window.currentPlan) {
      if (title) {
        window.currentPlan.displayTitle = title;
      } else {
        delete window.currentPlan.displayTitle;
      }
    }
    if (typeof window.syncProjectChrome === "function") {
      window.syncProjectChrome(window.currentPlan, title ? { title } : {});
    }
  }

  // 7. 方案生成后，同步大纲到左侧面板
  const _origRenderPlan = window.renderPlan;
  if (typeof _origRenderPlan === 'function') {
    window.renderPlan = function(input) {
      _origRenderPlan(input);
      setTimeout(syncLeftOutline, 300);
    };
  }

  function syncLeftOutline() {
    const plan = window.currentPlan;
    const container = document.getElementById('leftOutlineList');
    if (!plan || !container) return;
    const titleInput = document.getElementById('storyTitle');
    if (titleInput && plan.titles && plan.titles[0]) {
      titleInput.value = plan.titles[0];
      updateProjectChromeFromTitleInput(plan.titles[0]);
    }
    if (plan.outline && plan.outline.length) {
      const labels = ['开端', '发展', '转折', '高潮', '结局'];
      container.innerHTML = plan.outline.slice(0, 5).map((item, i) => `
        <div class="left-outline-item">
          <div>
            <strong>${labels[i] || (i+1)+'.'}：</strong>
            <span>${item}</span>
          </div>
        </div>
      `).join('');
    }
  }

  const outlineBox = document.getElementById('leftOutlineList');
  if (outlineBox && !outlineBox.innerHTML.trim()) {
    outlineBox.innerHTML = '<div class="left-outline-empty">生成方案后自动填充...</div>';
  }

  const notes = document.getElementById('storyNotes');
  const noteCounter = document.querySelector('.note-counter');
  if (notes && noteCounter) {
    const syncNotes = () => { noteCounter.textContent = `${notes.value.length}/500`; };
    notes.addEventListener('input', syncNotes);
    syncNotes();
  }

  document.querySelectorAll('.desktop-model-tuning label').forEach((row) => {
    const input = row.querySelector('input[type="range"]');
    const output = row.querySelector('output');
    if (!input || !output) return;
    const sync = () => {
      const value = Number(input.value);
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
      output.textContent = input.step === '0.01' ? value.toFixed(2) : input.value;
      input.style.setProperty('--range-pct', `${Math.max(0, Math.min(100, pct))}%`);
    };
    input.addEventListener('input', sync);
    sync();
  });

  // 实时监听标题输入框修改，同步更新界面各处标题展示
  const storyTitleInput = document.getElementById('storyTitle');
  if (storyTitleInput) {
    storyTitleInput.addEventListener('input', (e) => {
      updateProjectChromeFromTitleInput(e.target.value);
    });
  }

  const themeInput = document.getElementById('theme');
  if (themeInput) {
    themeInput.addEventListener('input', () => {
      if (storyTitleInput?.value.trim()) return;
      const title = themeInput.value.trim()
        ? (typeof compactTheme === 'function' ? compactTheme(themeInput.value) : themeInput.value.trim())
        : '未命名故事';
      if (window.currentPlan) window.currentPlan.displayTitle = title;
      if (typeof window.syncProjectChrome === "function") {
        window.syncProjectChrome(window.currentPlan, { title });
      }
    });
  }

  // 配额圆弧定时更新
  setTimeout(updateQuotaCircle, 800);
  setInterval(updateQuotaCircle, 30000);





  // 3. 生成状态追踪 (监听 AI 生成按钮)
  const aiBtn = document.getElementById('aiDraftBtn');
  if (aiBtn) {
    const genStatus = document.getElementById('genStatusVal');
    const genStart  = document.getElementById('genStartTime');
    const genWords  = document.getElementById('genWordCount');
    const genTime   = document.getElementById('genElapsed');

    let startTs = null;
    let timer   = null;

    const observer = new MutationObserver(() => {
      const isLoading = aiBtn.textContent.includes('正在') || aiBtn.textContent.includes('生成中');
      if (isLoading && !startTs) {
        startTs = Date.now();
        if (genStatus) genStatus.textContent = '生成中…';
        const now = new Date();
        if (genStart) genStart.textContent =
          `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        timer = setInterval(() => {
          const s = Math.floor((Date.now() - startTs) / 1000);
          if (genTime) genTime.textContent =
            `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
        }, 1000);
      } else if (!isLoading && startTs) {
        clearInterval(timer);
        if (genStatus) genStatus.textContent = '空闲';
        startTs = null;
        // 读取字数
        const editor = document.getElementById('draftEditor');
        if (editor && genWords) {
          genWords.textContent = editor.value.replace(/\s/g, '').length + ' 字';
        }
      }
    });
    observer.observe(aiBtn, { attributes: true, characterData: true, childList: true });
  }

  // 4. 工具栏保存状态联动
  const saveBtn = document.getElementById('saveProjectBtn');
  const saveState = document.querySelector('.desktop-save-state');
  if (saveBtn && saveState) {
    saveBtn.addEventListener('click', () => {
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      setTimeout(() => { saveState.textContent = `✓ 已保存 ${t}`; }, 300);
    });
  }

  // 5. AI状态同步到工具栏
  const apiStatus = document.getElementById('apiStatus');
  if (apiStatus && saveState) {
    const syncApiStatus = () => {
      if (apiStatus.classList.contains('ok')) {
        saveState.textContent = '● AI 已就绪';
        saveState.style.color = 'var(--du-green)';
      } else if (apiStatus.textContent.includes('检测')) {
        saveState.textContent = '○ 检测 AI 中…';
        saveState.style.color = '';
      }
    };
    const apiObserver = new MutationObserver(syncApiStatus);
    apiObserver.observe(apiStatus, { attributes: true, childList: true, subtree: true });
    syncApiStatus();
  }
});
