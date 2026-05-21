// ─── 任务设定：两步大纲生成 ──────────────────────────────────

function initTaskPanel() {
  // 监听连载铸造的小说切换，同步更新任务面板
  window.addEventListener("currentNovelChanged", (e) => {
    const novel = e.detail;
    refreshTaskPanel(novel);
  });

  // 如果已经选中了小说，直接刷新
  if (window.currentNovel) {
    refreshTaskPanel(window.currentNovel);
  }

  // 两步大纲生成按钮
  document.addEventListener("click", async (e) => {
    // 人物设定生成
    if (e.target.id === "generateCharactersBtn" || e.target.closest("#generateCharactersBtn")) {
      await handleGenerateCharacters();
    }
    // 复制人物设定
    if (e.target.id === "copyCharBtn") {
      const text = document.getElementById("taskCharContent")?.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        e.target.textContent = "已复制"; setTimeout(() => { e.target.textContent = "复制"; }, 2000);
      });
    }
    // 写入人物志
    if (e.target.id === "applyCharBtn") { handleApplyCharacters(); }

    // 大纲生成
    if (e.target.id === "generateOutlineBtn" || e.target.closest("#generateOutlineBtn")) {
      await handleGenerateOutline();
    }
    if (e.target.id === "copySettingBtn") {
      const text = document.getElementById("taskStep1Content")?.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        e.target.textContent = "已复制";
        setTimeout(() => { e.target.textContent = "复制"; }, 2000);
      });
    }
    if (e.target.id === "copyOutlineBtn") {
      const text = document.getElementById("taskStep2Content")?.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        e.target.textContent = "已复制";
        setTimeout(() => { e.target.textContent = "复制"; }, 2000);
      });
    }
    if (e.target.id === "applyOutlineBtn") {
      handleApplyOutline();
    }
  });
}

function refreshTaskPanel(novel) {
  const emptyState = document.getElementById("taskEmptyState");
  const panel = document.getElementById("taskPanel");
  if (!novel) {
    if (emptyState) emptyState.hidden = false;
    if (panel) panel.hidden = true;
    return;
  }
  if (emptyState) emptyState.hidden = true;
  if (panel) panel.hidden = false;

  // 填充小说信息
  const titleEl = document.getElementById("taskNovelTitle");
  const genreEl = document.getElementById("taskNovelGenre");
  const chaptersEl = document.getElementById("taskNovelChapters");
  const wordsEl = document.getElementById("taskNovelWords");
  if (titleEl) titleEl.textContent = novel.title || "未命名";
  if (genreEl) genreEl.textContent = novel.genre || "--";
  if (chaptersEl) chaptersEl.textContent = `${novel.targetChapters || "--"} 章`;
  if (wordsEl) wordsEl.textContent = `${novel.chapterLength || "--"} 字`;

  // 更新进度里程碑
  updateMilestones(novel);

  // 如果有历史生成的大纲，恢复显示
  if (novel.generatedSetting) {
    showStep1Result(novel.generatedSetting);
  }
  if (novel.generatedOutline) {
    showStep2Result(novel.generatedOutline);
  }
}

function updateMilestones(novel) {
  const m1 = document.getElementById("milestone1Icon");
  const m2 = document.getElementById("milestone2Icon");
  const m3 = document.getElementById("milestone3Icon");
  const m4 = document.getElementById("milestone4Icon");
  const m4text = document.getElementById("milestone4Text");
  const green = "background:linear-gradient(135deg, #10b981, #059669) !important;color:#fff !important;border-color:#10b981 !important;box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);";

  if (!m1) return;

  // 移除所有里程碑的 active 类和自定义背景，还原为默认
  document.querySelectorAll(".task-milestone-step").forEach((step, idx) => {
    step.classList.remove("active");
    const indicator = step.querySelector(".milestone-indicator");
    if (indicator) {
      indicator.style.cssText = "";
      indicator.textContent = String(idx + 1);
    }
  });

  // 始终激活第一步
  m1.closest(".task-milestone-step")?.classList.add("active");

  if (novel.generatedSetting) {
    m1.style.cssText = green;
    m1.textContent = "✓";
    m2.closest(".task-milestone-step")?.classList.add("active");
  }
  if (novel.generatedOutline) {
    m2.style.cssText = green;
    m2.textContent = "✓";
    m3.closest(".task-milestone-step")?.classList.add("active");
  }
  if (novel.chapters && novel.chapters.length > 0) {
    m3.style.cssText = green;
    m3.textContent = "✓";
    m4.closest(".task-milestone-step")?.classList.add("active");
  }
  if (m4text) {
    const count = novel.chapters?.length || 0;
    const total = novel.targetChapters || "?";
    m4text.textContent = `分章撰写故事正文`;
    const desc = m4text.nextElementSibling;
    if (desc) {
      desc.textContent = `当前进度：已生成 ${count} / ${total} 章正文，支持断点续传`;
    }
    if (count >= (novel.targetChapters || Infinity) && count > 0) {
      m4.style.cssText = green;
      m4.textContent = "✓";
    }
  }
}

async function handleGenerateCharacters() {
  const novel = window.currentNovel;
  if (!novel) { alert("请先在连载铸造中选择一部小说"); return; }
  
  if (!ModelConfigManager.hasValidKey()) {
    alert("请先在设置中填写 API Key");
    return;
  }
  const modelConfig = ModelConfigManager.get();

  const btn = document.getElementById("generateCharactersBtn");
  const progress = document.getElementById("taskCharProgress");
  const bar = document.getElementById("taskCharProgressBar");

  if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }
  if (progress) progress.hidden = false;

  // 模拟进度动画
  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(pct + 2, 90);
    if (bar) bar.style.width = pct + "%";
  }, 600);

  try {
    const res = await fetch(`/api/novels/${novel.id}/characters/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify({
        modelConfig,
        brainstorm: document.getElementById("charBrainstorm")?.value || "",
        characterCount: {
          protagonist: parseInt(document.getElementById("charCountProtagonist")?.value) || 1,
          male_lead:   parseInt(document.getElementById("charCountMaleLead")?.value)   || 1,
          villain:     parseInt(document.getElementById("charCountVillain")?.value)    || 1,
          supporting:  parseInt(document.getElementById("charCountSupporting")?.value) || 2
        }
      })
    });
    clearInterval(timer);
    if (bar) bar.style.width = "100%";

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "生成失败");

    // 显示结果
    const resultBox = document.getElementById("taskCharResult");
    const content = document.getElementById("taskCharContent");
    if (resultBox) resultBox.hidden = false;
    if (content) content.textContent = data.characters;

    // 更新缓存
    if (window.currentNovel) {
      window.currentNovel.generatedCharacters = data.characters;
      updateMilestones(window.currentNovel);
    }

    setTimeout(() => { if (progress) progress.hidden = true; }, 1500);

  } catch (err) {
    clearInterval(timer);
    if (bar) bar.style.background = "#e05454";
    alert("人物生成失败：" + (err.message || "未知错误"));
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ""; }
  }
}

async function saveNovelFields(novelId, fields) {
  try {
    const res = await fetch(`/api/novels/${novelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify(fields)
    });
    const data = await res.json();
    if (data.ok && data.novel) {
      window.currentNovel = data.novel;
      if (Array.isArray(window.serialNovels)) {
        window.serialNovels = window.serialNovels.map(n => n.id === novelId ? data.novel : n);
      }
      if (typeof renderNovelList === "function") renderNovelList();
    }
  } catch (err) {
    console.error("同步小说设定至后端失败", err);
  }
}

function handleApplyCharacters() {
  const text = document.getElementById("taskCharContent")?.textContent || "";
  if (!text.trim()) { alert("还没有生成人物设定"); return; }

  // 写入连载铸造的人物志字段
  const serialCharEl = document.getElementById("serialCharacters");
  if (serialCharEl) serialCharEl.value = text;

  // 更新当前小说缓存并上传后端
  if (window.currentNovel) {
    window.currentNovel.characters = text;
    saveNovelFields(window.currentNovel.id, { characters: text });
  }

  const btn = document.getElementById("applyCharBtn");
  if (btn) { btn.textContent = "✅ 已写入"; setTimeout(() => { btn.textContent = "写入人物志"; }, 2000); }
}

async function handleGenerateOutline() {
  const novel = window.currentNovel;
  if (!novel) {
    alert("请先在连载铸造中选择一部小说");
    return;
  }

  if (!ModelConfigManager.hasValidKey()) {
    alert("请先在设置中填写 API Key");
    return;
  }
  const modelConfig = ModelConfigManager.get();

  const brainstorm = document.getElementById("taskBrainstorm")?.value || "";
  const btn = document.getElementById("generateOutlineBtn");
  const progress = document.getElementById("taskOutlineProgress");
  const progressStep = document.getElementById("taskOutlineProgressStep");
  const progressBar = document.getElementById("taskOutlineProgressBar");
  const progressPct = document.getElementById("taskOutlineProgressPct");

  // 开始状态
  if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }
  if (progress) progress.hidden = false;
  if (progressStep) progressStep.textContent = "第一步：生成核心设定...";
  if (progressBar) progressBar.style.width = "30%";
  if (progressPct) progressPct.textContent = "30%";

  try {
    const res = await fetch(`/api/novels/${novel.id}/outline/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify({ modelConfig, brainstorm })
    });

    if (progressBar) progressBar.style.width = "70%";
    if (progressPct) progressPct.textContent = "70%";
    if (progressStep) progressStep.textContent = "第二步：生成章节大纲...";

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "生成失败");

    if (progressBar) progressBar.style.width = "100%";
    if (progressPct) progressPct.textContent = "100%";
    if (progressStep) progressStep.textContent = "✅ 生成完成！";

    showStep1Result(data.setting);
    showStep2Result(data.chapterOutlines);

    // 更新本地小说缓存
    if (window.currentNovel) {
      window.currentNovel.generatedSetting = data.setting;
      window.currentNovel.generatedOutline = data.chapterOutlines;
      updateMilestones(window.currentNovel);
    }

    if (typeof window.refreshSubjectKnowledge === "function") {
      window.refreshSubjectKnowledge(data.setting + " " + data.chapterOutlines);
    }

    setTimeout(() => { if (progress) progress.hidden = true; }, 2000);

  } catch (err) {
    if (progressStep) progressStep.textContent = "❌ " + (err.message || "生成失败");
    if (progressBar) progressBar.style.background = "#e05454";
    console.error("大纲生成失败:", err);
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ""; }
  }
}

function showStep1Result(text) {
  const container = document.getElementById("taskStep1Result");
  const content = document.getElementById("taskStep1Content");
  if (container) container.hidden = false;
  if (content) content.textContent = text;
}

function showStep2Result(text) {
  const container = document.getElementById("taskStep2Result");
  const content = document.getElementById("taskStep2Content");
  if (container) container.hidden = false;
  if (content) content.textContent = text;
}

function handleApplyOutline() {
  const outlineText = document.getElementById("taskStep2Content")?.textContent || "";
  if (!outlineText.trim()) { alert("还没有生成大纲"); return; }

  // 如果连载工作区有大纲输入框，填入
  const serialOutlineEl = document.getElementById("serialOutline");
  if (serialOutlineEl) {
    serialOutlineEl.value = outlineText;
  }
  // 更新当前小说的 outline 字段并上传后端
  if (window.currentNovel) {
    window.currentNovel.outline = outlineText;
    saveNovelFields(window.currentNovel.id, { outline: outlineText });
  }

  const btn = document.getElementById("applyOutlineBtn");
  if (btn) { btn.textContent = "✅ 已写入"; setTimeout(() => { btn.textContent = "写入小说大纲"; }, 2000); }
}

// ─── 世界设定页面逻辑 ─────────────────────────────────────────

// 内存存储与初始化结构
let worldData = {
  characters: [],
  worldview: { era: "", location: "", society: "", special: "" },
  rules: [],
  timeline: []
};

const ROLE_LABELS = {
  protagonist: "主角", antagonist: "反派",
  supporting: "配角", mentor: "导师", love: "感情线"
};

const GRADIENTS = [
  "linear-gradient(135deg, #3b82f6, #8b5cf6)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #d97706)",
  "linear-gradient(135deg, #ef4444, #dc2626)",
  "linear-gradient(135deg, #ec4899, #db2777)"
];

function initWorldPanel() {
  // Tab 切换代理
  document.addEventListener("click", (e) => {
    const tabBtn = e.target.closest(".world-tab-btn");
    if (tabBtn) {
      const target = tabBtn.dataset.worldTab;
      document.querySelectorAll(".world-tab-btn").forEach(b => b.classList.remove("active"));
      tabBtn.classList.add("active");
      document.querySelectorAll(".world-tab-panel").forEach(p => p.hidden = true);
      const panel = document.getElementById(`worldTab${target.charAt(0).toUpperCase() + target.slice(1)}`);
      if (panel) panel.hidden = false;
    }

    // 从大纲一键推演世界设定
    if (e.target.id === "inferWorldFromOutlineBtn" || e.target.closest("#inferWorldFromOutlineBtn")) {
      handleInferWorldFromOutline();
    }

    // 添加人物
    if (e.target.id === "addCharBtn") handleAddCharacter();

    // AI一键设定人物
    if (e.target.id === "aiGenCharactersBtn" || e.target.closest("#aiGenCharactersBtn")) {
      handleAiGenCharacters();
    }

    // 删除人物
    if (e.target.classList.contains("char-delete-btn")) {
      const idx = parseInt(e.target.dataset.idx);
      if (!isNaN(idx)) {
        worldData.characters.splice(idx, 1);
        saveWorldData();
        renderCharacters();
      }
    }

    // 保存世界观
    if (e.target.id === "saveWorldviewBtn") handleSaveWorldview();

    // AI一键推演世界观
    if (e.target.id === "aiGenWorldviewBtn" || e.target.closest("#aiGenWorldviewBtn")) {
      handleAiGenWorldview();
    }

    // 添加规则
    if (e.target.id === "addRuleBtn") handleAddRule();

    // 删除规则
    if (e.target.classList.contains("remove-rule-btn") || e.target.closest(".remove-rule-btn")) {
      const btn = e.target.classList.contains("remove-rule-btn") ? e.target : e.target.closest(".remove-rule-btn");
      // 如果是刚被DOM移除的非存盘临时节点直接交给浏览器默认移除，如果是存盘项我们重新统一收集并保存
      setTimeout(() => {
        handleSaveRulesSilently();
      }, 50);
    }

    // 保存规则
    if (e.target.id === "saveRulesBtn") handleSaveRules();

    // AI智能设计规则
    if (e.target.id === "aiGenRulesBtn" || e.target.closest("#aiGenRulesBtn")) {
      handleAiGenRules();
    }

    // 添加时间线节点
    if (e.target.id === "addTimelineBtn") handleAddTimeline();

    // AI自动编织时间线
    if (e.target.id === "aiGenTimelineBtn" || e.target.closest("#aiGenTimelineBtn")) {
      handleAiGenTimeline();
    }

    // 删除时间线节点
    if (e.target.classList.contains("remove-timeline-btn") || e.target.closest(".remove-timeline-btn")) {
      const btn = e.target.classList.contains("remove-timeline-btn") ? e.target : e.target.closest(".remove-timeline-btn");
      const idx = parseInt(btn.dataset.idx);
      if (!isNaN(idx) && worldData.timeline) {
        worldData.timeline.splice(idx, 1);
        saveWorldData();
        renderTimeline();
      }
    }
  });

  // 绑定时间轴输入变动自动存盘
  document.addEventListener("input", (e) => {
    if (e.target.classList.contains("timeline-time")) {
      const idx = parseInt(e.target.dataset.idx);
      if (worldData.timeline && worldData.timeline[idx]) {
        worldData.timeline[idx].time = e.target.value;
        saveWorldData();
      }
    }
    if (e.target.classList.contains("timeline-event")) {
      const idx = parseInt(e.target.dataset.idx);
      if (worldData.timeline && worldData.timeline[idx]) {
        worldData.timeline[idx].event = e.target.value;
        saveWorldData();
      }
    }
  });

    // 监听连载小说的切换，同步刷新世界设定
    window.addEventListener("currentNovelChanged", (e) => {
      const novel = e.detail;
      loadWorldDataForNovel(novel ? novel.id : null);
    });

    // 如果目前就已经选中了小说，直接加载该小说的专属世界设定
    if (window.currentNovel) {
      loadWorldDataForNovel(window.currentNovel.id);
    } else {
      loadWorldDataForNovel(null);
    }
  }

  function tryParseMarkdownToWorldData(markdown) {
    const data = {
      characters: [],
      worldview: { era: "", location: "", society: "", special: "" },
      rules: [],
      timeline: []
    };

    if (!markdown || !markdown.trim()) return null;

    const charSectionIndex = markdown.indexOf("### 登场角色志");
    const worldviewSectionIndex = markdown.indexOf("### 世界观基调");
    const rulesSectionIndex = markdown.indexOf("### 逻辑铁律与红线");
    const timelineSectionIndex = markdown.indexOf("### 剧情脉络时间轴");

    const getSectionText = (startIdx, endIdxs) => {
      if (startIdx === -1) return "";
      let endIdx = markdown.length;
      for (const idx of endIdxs) {
        if (idx !== -1 && idx > startIdx && idx < endIdx) {
          endIdx = idx;
        }
      }
      return markdown.substring(startIdx, endIdx).trim();
    };

    // 1. 解析角色志
    const charText = getSectionText(charSectionIndex, [worldviewSectionIndex, rulesSectionIndex, timelineSectionIndex]);
    if (charText) {
      const charRegex = /【([^】]+)】([^\n]+)\n\s*特征：([^\n]*)\n\s*动机：([^\n]*)/g;
      const labelsRev = { "主角": "protagonist", "反派": "antagonist", "配角": "supporting", "导师": "mentor", "感情线": "love" };
      let match;
      while ((match = charRegex.exec(charText)) !== null) {
        const roleName = match[1].trim();
        const role = labelsRev[roleName] || "supporting";
        const name = match[2].trim();
        const appearance = match[3].trim();
        const motive = match[4].trim();
        data.characters.push({ name, role, motive, appearance });
      }
    }

    // 2. 解析世界观基调
    const worldviewText = getSectionText(worldviewSectionIndex, [charSectionIndex, rulesSectionIndex, timelineSectionIndex]);
    if (worldviewText) {
      const eraMatch = worldviewText.match(/- \*\*时代背景\*\*：([^\n]*)/);
      const locMatch = worldviewText.match(/- \*\*主要场景\*\*：([^\n]*)/);
      const socMatch = worldviewText.match(/- \*\*社会风貌\*\*：([^\n]*)/);
      const specMatch = worldviewText.match(/- \*\*特殊秩序与脑洞\*\*：([^\n]*)/);
      if (eraMatch) data.worldview.era = eraMatch[1].trim();
      if (locMatch) data.worldview.location = locMatch[1].trim();
      if (socMatch) data.worldview.society = socMatch[1].trim();
      if (specMatch) data.worldview.special = specMatch[1].trim();
    }

    // 3. 解析逻辑规则链
    const rulesText = getSectionText(rulesSectionIndex, [charSectionIndex, worldviewSectionIndex, timelineSectionIndex]);
    if (rulesText) {
      const ruleLines = rulesText.split("\n");
      const typeRev = { "必须遵循": "must", "绝对禁止": "cannot", "设定事实": "fact" };
      ruleLines.forEach(line => {
        const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s*([^\n]+)/);
        if (match) {
          const typeLabel = match[1].trim();
          const content = match[2].trim();
          data.rules.push({
            type: typeRev[typeLabel] || "must",
            content: content
          });
        }
      });
    }

    // 4. 解析剧情时间轴
    const timelineText = getSectionText(timelineSectionIndex, [charSectionIndex, worldviewSectionIndex, rulesSectionIndex]);
    if (timelineText) {
      const nodeLines = timelineText.split("\n");
      nodeLines.forEach(line => {
        const match = line.match(/^-\s*\*\*\[([^\]]+)\]\*\*\s*([^\n]+)/);
        if (match) {
          const time = match[1].trim();
          const event = match[2].trim();
          data.timeline.push({ time, event });
        }
      });
    }

    const hasData = data.characters.length > 0 ||
                    data.worldview.era || data.worldview.location || data.worldview.society || data.worldview.special ||
                    data.rules.length > 0 ||
                    data.timeline.length > 0;
    return hasData ? data : null;
  }

  function loadWorldDataForNovel(novelId) {
    if (!novelId) {
      worldData = {
        characters: [],
        worldview: { era: "", location: "", society: "", special: "" },
        rules: [],
        timeline: []
      };
      renderAll();
      return;
    }

    const key = `worldData_${novelId}`;
    let saved = localStorage.getItem(key);

    // 🌟 向前兼容性自愈迁移：如果当前小说还没有专属设定，但全局存在旧版 worldData，则迁移旧数据，防止用户配置丢失
    if (!saved) {
      const globalSaved = localStorage.getItem("worldData");
      if (globalSaved) {
        try {
          const parsedGlobal = JSON.parse(globalSaved);
          if (parsedGlobal.characters?.length > 0 || parsedGlobal.worldview?.era || parsedGlobal.rules?.length > 0 || parsedGlobal.timeline?.length > 0) {
            console.log(`[Migration] 成功将全局旧版世界设定迁移到小说专属设定: ${key}`);
            localStorage.setItem(key, globalSaved);
            saved = globalSaved;
          }
        } catch (err) {
          console.error("解析旧全局世界设定失败", err);
        }
      }
    }

    // 🌟 反向关联与数据防丢恢复：如果前两步还是没有在 localStorage 中找到设定，但小说的 characters 字段中有 Markdown 富文本设定，则进行逆向解析填充
    if (!saved && window.currentNovel && window.currentNovel.id === novelId && window.currentNovel.characters) {
      try {
        const inferredData = tryParseMarkdownToWorldData(window.currentNovel.characters);
        if (inferredData) {
          console.log(`[Reverse Parsing] 成功从小说的 Markdown 人设立场逆向恢复世界设定至 ${key}`);
          localStorage.setItem(key, JSON.stringify(inferredData));
          saved = JSON.stringify(inferredData);
        }
      } catch (err) {
        console.error("反向解析小说 characters Markdown 失败:", err);
      }
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        worldData = {
          characters: parsed.characters || [],
          worldview: parsed.worldview || { era: "", location: "", society: "", special: "" },
          rules: parsed.rules || [],
          timeline: parsed.timeline || []
        };
      } catch (e) {
        console.error("加载世界设定存档失败", e);
        worldData = {
          characters: [],
          worldview: { era: "", location: "", society: "", special: "" },
          rules: [],
          timeline: []
        };
      }
    } else {
      worldData = {
        characters: [],
        worldview: { era: "", location: "", society: "", special: "" },
        rules: [],
        timeline: []
      };
    }
    renderAll();
  }

function saveWorldData() {
  if (window.currentNovel && window.currentNovel.id) {
    localStorage.setItem(`worldData_${window.currentNovel.id}`, JSON.stringify(worldData));
    
    // 优雅聚合整套设定 Markdown 富文本 (包含登场人物卡池、世界观背景基调、逻辑铁律红线、剧情时间轴)
    const sections = [];
    
    // 1. 人物卡池
    if (worldData.characters && worldData.characters.length > 0) {
      const charText = worldData.characters
        .map(c => `【${ROLE_LABELS[c.role] || "配角"}】${c.name}\n  特征：${c.appearance || "无"}\n  动机：${c.motive || "无"}`)
        .join("\n\n");
      sections.push(`### 登场角色志\n${charText}`);
    }
    
    // 2. 世界观设定
    const w = worldData.worldview || {};
    if (w.era || w.location || w.society || w.special) {
      const worldviewText = [
        w.era ? `- **时代背景**：${w.era}` : "",
        w.location ? `- **主要场景**：${w.location}` : "",
        w.society ? `- **社会风貌**：${w.society}` : "",
        w.special ? `- **特殊秩序与脑洞**：${w.special}` : ""
      ].filter(Boolean).join("\n");
      if (worldviewText) {
        sections.push(`### 世界观基调\n${worldviewText}`);
      }
    }
    
    // 3. 逻辑制约规则
    if (worldData.rules && worldData.rules.length > 0) {
      const typeLabels = { must: "必须遵循", cannot: "绝对禁止", fact: "设定事实" };
      const rulesText = worldData.rules
         .map((r, i) => `${i + 1}. [${typeLabels[r.type] || "约束"}] ${r.content}`)
        .join("\n");
      sections.push(`### 逻辑铁律与红线\n${rulesText}`);
    }
    
    // 4. 故事时间线
    if (worldData.timeline && worldData.timeline.length > 0) {
      const timelineText = worldData.timeline
        .filter(n => n.time || n.event)
        .map(n => `- **[${n.time || "待定"}]** ${n.event || "发生事件"}`)
        .join("\n");
      if (timelineText) {
        sections.push(`### 剧情脉络时间轴\n${timelineText}`);
      }
    }
    
    const combinedConfigText = sections.join("\n\n");
    
    // 写入内存并同步保存至后端
    window.currentNovel.characters = combinedConfigText;
    saveNovelFields(window.currentNovel.id, { characters: combinedConfigText });
  } else {
    localStorage.setItem("worldData", JSON.stringify(worldData));
  }
}

function handleAddCharacter() {
  const nameEl = document.getElementById("charName");
  const roleEl = document.getElementById("charRole");
  const motiveEl = document.getElementById("charMotive");
  const appEl = document.getElementById("charAppearance");

  const name = nameEl?.value.trim();
  const role = roleEl?.value || "supporting";
  const motive = motiveEl?.value.trim() || "";
  const appearance = appEl?.value.trim() || "";

  if (!name) { alert("请输入角色姓名"); return; }

  if (!worldData.characters) worldData.characters = [];
  const existingIdx = worldData.characters.findIndex(c => c.name === name);
  if (existingIdx !== -1) {
    const confirmOverwrite = confirm(`人物卡池中已存在名为“${name}”的角色，是否覆盖其设定？`);
    if (!confirmOverwrite) return;
    worldData.characters[existingIdx] = { name, role, motive, appearance };
  } else {
    worldData.characters.push({ name, role, motive, appearance });
  }

  saveWorldData();
  renderCharacters();

  // 清空输入项
  if (nameEl) nameEl.value = "";
  if (motiveEl) motiveEl.value = "";
  if (appEl) appEl.value = "";
}

function renderCharacters() {
  const container = document.getElementById("characterCards");
  const countEl = document.getElementById("charPoolCount");
  if (!container) return;

  const count = worldData.characters ? worldData.characters.length : 0;
  if (countEl) countEl.textContent = `共 ${count} 个登场设定`;

  if (count === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: var(--du-paper); border: 1px dashed var(--border2); border-radius: 12px; color: var(--du-muted); font-size: 13px;">
        暂无人物入籍，请在左侧填写并添加登场人物
      </div>
    `;
    return;
  }

  container.innerHTML = worldData.characters.map((char, i) => {
    const grad = GRADIENTS[i % GRADIENTS.length];
    const initial = char.name ? char.name.charAt(0) : "👤";
    return `
      <div class="character-card">
        <button class="char-delete-btn" data-idx="${i}" type="button"
          style="position: absolute; top: 12px; right: 12px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 6px; font-size: 11px; color: #ef4444; cursor: pointer; padding: 3px 8px; transition: all 0.2s;">删除</button>
        
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px; margin-top: 4px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: ${grad}; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;">${initial}</div>
          <div>
            <div style="font-size: 15px; font-weight: 800; color: var(--du-ink);">${char.name}</div>
            <span class="char-badge ${char.role}" style="margin-top: 4px;">${ROLE_LABELS[char.role] || char.role}</span>
          </div>
        </div>

        ${char.motive ? `<div style="font-size: 12px; color: var(--du-muted); line-height: 1.5; margin-top: 4px; border-top: 1px solid var(--border); padding-top: 8px;"><strong>动机与秘密：</strong>${char.motive}</div>` : ""}
        ${char.appearance ? `<div style="font-size: 12px; color: var(--du-muted); line-height: 1.5;"><strong>标志特征：</strong>${char.appearance}</div>` : ""}
      </div>
    `;
  }).join("");
}

function handleSaveWorldview() {
  worldData.worldview = {
    era: document.getElementById("worldEra")?.value.trim() || "",
    location: document.getElementById("worldLocation")?.value.trim() || "",
    society: document.getElementById("worldSociety")?.value.trim() || "",
    special: document.getElementById("worldSpecial")?.value.trim() || ""
  };
  saveWorldData();
  const tip = document.getElementById("worldviewSaved");
  if (tip) {
    tip.hidden = false;
    setTimeout(() => { tip.hidden = true; }, 3000);
  }
}

function renderWorldview() {
  const w = worldData.worldview || {};
  const eraEl = document.getElementById("worldEra");
  const locEl = document.getElementById("worldLocation");
  const socEl = document.getElementById("worldSociety");
  const speEl = document.getElementById("worldSpecial");

  if (eraEl) eraEl.value = w.era || "";
  if (locEl) locEl.value = w.location || "";
  if (socEl) socEl.value = w.society || "";
  if (speEl) speEl.value = w.special || "";
}

function handleAddRule() {
  const container = document.getElementById("rulesContainer");
  if (!container) return;
  const item = document.createElement("div");
  item.className = "rule-item";
  item.style.cssText = "display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid var(--border);";
  item.innerHTML = `
    <select class="rule-type" style="padding: 7px 10px; border: 1px solid var(--border2); border-radius: 6px; font-size: 12px; background: var(--bg); color: var(--txt); width: 100px; flex-shrink: 0; outline: none;">
      <option value="must">必须遵循</option>
      <option value="cannot">绝对禁止</option>
      <option value="fact">设定事实</option>
    </select>
    <input type="text" class="rule-content" placeholder="输入制约限制限制规则..." style="flex: 1; padding: 7px 12px; border: 1px solid var(--border2); border-radius: 6px; font-size: 13px; background: var(--bg); color: var(--txt); outline: none;">
    <button class="remove-rule-btn" type="button" style="padding: 7px 10px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; font-size: 12px; color: #ef4444; cursor: pointer; flex-shrink: 0; transition: all 0.2s;">✕</button>
  `;
  container.appendChild(item);
}

function handleSaveRules() {
  const items = document.querySelectorAll(".rule-item");
  worldData.rules = Array.from(items).map(item => ({
    type: item.querySelector(".rule-type")?.value,
    content: item.querySelector(".rule-content")?.value.trim()
  })).filter(r => r.content);
  saveWorldData();
  const tip = document.getElementById("rulesSaved");
  if (tip) {
    tip.hidden = false;
    setTimeout(() => { tip.hidden = true; }, 3000);
  }
}

function handleSaveRulesSilently() {
  const items = document.querySelectorAll(".rule-item");
  worldData.rules = Array.from(items).map(item => ({
    type: item.querySelector(".rule-type")?.value,
    content: item.querySelector(".rule-content")?.value.trim()
  })).filter(r => r.content);
  saveWorldData();
}

function renderRules() {
  const container = document.getElementById("rulesContainer");
  if (!container) return;

  if (!worldData.rules || worldData.rules.length === 0) {
    container.innerHTML = `
      <div class="rule-item" style="display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid var(--border);">
        <select class="rule-type" style="padding: 7px 10px; border: 1px solid var(--border2); border-radius: 6px; font-size: 12px; background: var(--bg); color: var(--txt); width: 100px; flex-shrink: 0; outline: none;">
          <option value="must">必须遵循</option>
          <option value="cannot">绝对禁止</option>
          <option value="fact">设定事实</option>
        </select>
        <input type="text" class="rule-content" placeholder="输入具体的逻辑制约限制，如：男主对女主的怀疑度在前五章绝不能低于80%" style="flex: 1; padding: 7px 12px; border: 1px solid var(--border2); border-radius: 6px; font-size: 13px; background: var(--bg); color: var(--txt); outline: none;">
        <button class="remove-rule-btn" type="button" style="padding: 7px 10px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; font-size: 12px; color: #ef4444; cursor: pointer; flex-shrink: 0; transition: all 0.2s;">✕</button>
      </div>
    `;
    return;
  }

  container.innerHTML = worldData.rules.map(rule => `
    <div class="rule-item" style="display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid var(--border);">
      <select class="rule-type" style="padding: 7px 10px; border: 1px solid var(--border2); border-radius: 6px; font-size: 12px; background: var(--bg); color: var(--txt); width: 100px; flex-shrink: 0; outline: none;">
        <option value="must" ${rule.type === 'must' ? 'selected' : ''}>必须遵循</option>
        <option value="cannot" ${rule.type === 'cannot' ? 'selected' : ''}>绝对禁止</option>
        <option value="fact" ${rule.type === 'fact' ? 'selected' : ''}>设定事实</option>
      </select>
      <input type="text" class="rule-content" placeholder="输入制约限制限制规则..." value="${rule.content || ''}" style="flex: 1; padding: 7px 12px; border: 1px solid var(--border2); border-radius: 6px; font-size: 13px; background: var(--bg); color: var(--txt); outline: none;">
      <button class="remove-rule-btn" type="button" style="padding: 7px 10px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; font-size: 12px; color: #ef4444; cursor: pointer; flex-shrink: 0; transition: all 0.2s;">✕</button>
    </div>
  `).join("");
}

function handleAddTimeline() {
  if (!worldData.timeline) worldData.timeline = [];
  worldData.timeline.push({ time: "", event: "" });
  saveWorldData();
  renderTimeline();
}

function renderTimeline() {
  const container = document.getElementById("timelineContainer");
  if (!container) return;

  const list = worldData.timeline || [];
  if (list.length === 0) {
    container.innerHTML = `
      <div style="padding: 48px; text-align: center; border: 1px dashed var(--border2); border-radius: 8px; color: var(--du-muted); font-size: 13px; width: 100%;">
        时间脉络尚空，点击右上角「添加时间节点」勾勒纪元故事。
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((node, i) => `
    <div class="timeline-node" data-idx="${i}">
      <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
        <input type="text" class="timeline-time" data-idx="${i}" placeholder="时间点（如：第 3 章 / 故事第 7 天）" value="${node.time || ''}"
          style="width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid var(--border2); border-radius: 6px; font-size: 12px; background: var(--bg); color: var(--txt); font-weight: 600;">
        <input type="text" class="timeline-event" data-idx="${i}" placeholder="发生了什么关键事件？" value="${node.event || ''}"
          style="width: 100%; box-sizing: border-box; padding: 7px 10px; border: 1px solid var(--border2); border-radius: 6px; font-size: 13px; background: var(--bg); color: var(--txt);">
      </div>
      <button type="button" class="remove-timeline-btn" data-idx="${i}"
        style="padding: 5px 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 5px; font-size: 11px; color: #ef4444; cursor: pointer; margin-top: 4px; flex-shrink: 0; transition: all 0.2s;">✕</button>
    </div>
  `).join("");
}

function renderAll() {
  renderCharacters();
  renderWorldview();
  renderRules();
  renderTimeline();
}

// ─── AI 一键智能推演与生成 ────────────────────────────────────

function getActiveNovelOrPlan() {
  if (window.currentNovel) {
    return {
      type: "serial",
      id: window.currentNovel.id,
      title: window.currentNovel.title || "未命名故事",
      genre: window.currentNovel.genre || "history",
      outline: window.currentNovel.outline || window.currentNovel.generatedOutline || "未生成大纲"
    };
  } else if (window.currentPlan) {
    return {
      type: "plan",
      id: window.currentPlan.id || "short_plan",
      title: window.currentPlan.input?.title || "未命名短篇",
      genre: window.currentPlan.input?.genre || "family",
      outline: window.currentPlan.input?.theme || window.currentPlan.input?.notes || "未设定大纲"
    };
  }
  return null;
}

function cleanAndParseJson(text) {
  if (!text) return null;
  let clean = text.trim();

  // 1. 智能提取最外层大括号 {...} 或者是中括号 [...] 的核心，瞬间撕除所有前后缀前言后语
  const startBrace = clean.indexOf("{");
  const startBracket = clean.indexOf("[");
  if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
    const endBrace = clean.lastIndexOf("}");
    if (endBrace !== -1) {
      clean = clean.substring(startBrace, endBrace + 1);
    }
  } else if (startBracket !== -1) {
    const endBracket = clean.lastIndexOf("]");
    if (endBracket !== -1) {
      clean = clean.substring(startBracket, endBracket + 1);
    }
  }

  // 2. 剥离可能残存的 markdown 块语法
  clean = clean.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  // 3. 第一阶段：标准原生 JSON.parse 尝试
  try {
    return JSON.parse(clean);
  } catch (err) {
    console.warn("[cleanAndParseJson] 标准 JSON 解析失败，启动高级清洗自愈...", err);
  }

  // 4. 第二阶段：高级语法清洗（修复尾随逗号、清除非法物理控制换行符等常见大模型病灶）
  try {
    let healed = clean;
    // 4.1 修复对象/数组内部的“尾随逗号” (Trailing Commas)
    healed = healed.replace(/,\s*([}\]])/g, '$1');
    // 4.2 清除并转义非法的物理控制换行符
    healed = healed.replace(/[\u0000-\u001F\u007F-\u009F]/g, function (match) {
      if (match === '\n') return '\\n';
      if (match === '\r') return '\\r';
      if (match === '\t') return '\\t';
      return '';
    });
    return JSON.parse(healed);
  } catch (err2) {
    console.warn("[cleanAndParseJson] 高级自愈解析失败。为避免执行不可信模型输出，已拒绝 Function 降级解析。", err2);
  }

  throw new Error("AI 返回的数据不符合标准 JSON 格式且无法自动纠错");
}

async function handleAiGenCharacters() {
  const active = getActiveNovelOrPlan();
  if (!active) {
    alert("请先在连载故事或短篇方案中选择/创建一个故事，AI需要根据您的题材和大纲进行推演。");
    return;
  }

  const btn = document.getElementById("aiGenCharactersBtn");
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "⚡ 生成中...";

  try {
    const modelConfig = ModelConfigManager.get();
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify({
        mode: "world_character",
        input: {
          genre: active.genre,
          theme: active.outline,
          title: active.title
        },
        modelConfig
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "生成失败");

    const characters = cleanAndParseJson(data.text);
    if (!Array.isArray(characters)) throw new Error("AI 未返回合法的角色数组");

    if (!worldData.characters) worldData.characters = [];
    if (worldData.characters.length > 0) {
      const isOverwrite = confirm("检测到当前卡池已存在登场人物。\n\n点击【确定】将[清空并覆盖]已有卡池，完全替换为 AI 重新推演的人物。\n点击【取消】将保留已有卡池，仅[智能合并]（同名角色更新设定，新角色直接追加）。");
      if (isOverwrite) {
        worldData.characters = characters;
      } else {
        characters.forEach(newChar => {
          const idx = worldData.characters.findIndex(c => c.name === newChar.name);
          if (idx !== -1) {
            worldData.characters[idx] = { ...worldData.characters[idx], ...newChar };
          } else {
            worldData.characters.push(newChar);
          }
        });
      }
    } else {
      worldData.characters = characters;
    }
    saveWorldData();
    renderCharacters();
  } catch (err) {
    alert("人物设定推演失败: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

async function handleAiGenWorldview() {
  const active = getActiveNovelOrPlan();
  if (!active) {
    alert("请先在连载故事或短篇方案中选择/创建一个故事，AI需要根据您的题材和大纲进行推演。");
    return;
  }

  const btn = document.getElementById("aiGenWorldviewBtn");
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "⚡ 推演中...";

  try {
    const modelConfig = ModelConfigManager.get();
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify({
        mode: "world_worldview",
        input: {
          genre: active.genre,
          theme: active.outline,
          title: active.title
        },
        modelConfig
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "生成失败");

    const worldview = cleanAndParseJson(data.text);
    if (!worldview || typeof worldview !== "object") throw new Error("AI 未返回合法的世界观配置");

    const eraEl = document.getElementById("worldEra");
    const locEl = document.getElementById("worldLocation");
    const socEl = document.getElementById("worldSociety");
    const speEl = document.getElementById("worldSpecial");

    if (eraEl) eraEl.value = worldview.era || "";
    if (locEl) locEl.value = worldview.location || "";
    if (socEl) socEl.value = worldview.society || "";
    if (speEl) speEl.value = worldview.special || "";

    handleSaveWorldview();
  } catch (err) {
    alert("世界观推演失败: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

async function handleAiGenRules() {
  const active = getActiveNovelOrPlan();
  if (!active) {
    alert("请先在连载故事或短篇方案中选择/创建一个故事，AI需要根据您的题材和大纲进行推演。");
    return;
  }

  const btn = document.getElementById("aiGenRulesBtn");
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "⚡ 设计中...";

  try {
    const modelConfig = ModelConfigManager.get();
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify({
        mode: "world_rules",
        input: {
          genre: active.genre,
          theme: active.outline,
          title: active.title
        },
        modelConfig
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "生成失败");

    const rules = cleanAndParseJson(data.text);
    if (!Array.isArray(rules)) throw new Error("AI 未返回合法的规则数组");

    const existingItems = document.querySelectorAll(".rule-item");
    const currentRules = Array.from(existingItems).map(item => ({
      type: item.querySelector(".rule-type")?.value,
      content: item.querySelector(".rule-content")?.value.trim()
    })).filter(r => r.content);

    if (currentRules.length > 0) {
      const isOverwrite = confirm("检测到当前已存在规则条目。\n\n点击【确定】将[清空并覆盖]已有规则，完全替换为 AI 重新设计的规则。\n点击【取消】将保留已有规则，仅[智能合并]（自动过滤完全相同的重复规则）。");
      if (isOverwrite) {
        worldData.rules = rules;
      } else {
        const mergedRules = [...currentRules];
        rules.forEach(newRule => {
          const exists = mergedRules.some(r => r.content.trim() === newRule.content.trim());
          if (!exists) {
            mergedRules.push(newRule);
          }
        });
        worldData.rules = mergedRules;
      }
    } else {
      worldData.rules = rules;
    }
    saveWorldData();
    renderRules();
  } catch (err) {
    alert("逻辑规则链设计失败: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

async function handleAiGenTimeline() {
  const active = getActiveNovelOrPlan();
  if (!active) {
    alert("请先在连载故事或短篇方案中选择/创建一个故事，AI需要根据您的题材和大纲进行推演。");
    return;
  }

  const btn = document.getElementById("aiGenTimelineBtn");
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "⚡ 编织中...";

  try {
    const modelConfig = ModelConfigManager.get();
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify({
        mode: "world_timeline",
        input: {
          genre: active.genre,
          theme: active.outline,
          title: active.title
        },
        modelConfig
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "生成失败");

    const timeline = cleanAndParseJson(data.text);
    if (!Array.isArray(timeline)) throw new Error("AI 未返回合法的时间线数组");

    if (!worldData.timeline) worldData.timeline = [];
    if (worldData.timeline.length > 0) {
      const isOverwrite = confirm("检测到当前已存在故事时间节点。\n\n点击【确定】将[清空并覆盖]已有脉络，完全替换为 AI 重新编织的时间线。\n点击【取消】将保留已有脉络，仅[智能合并]（自动过滤时间和事件完全重复的节点）。");
      if (isOverwrite) {
        worldData.timeline = timeline;
      } else {
        const mergedTimeline = [...worldData.timeline];
        timeline.forEach(newNode => {
          const exists = mergedTimeline.some(n => 
            String(n.time || "").trim() === String(newNode.time || "").trim() && 
            String(n.event || "").trim() === String(newNode.event || "").trim()
          );
          if (!exists) {
            mergedTimeline.push(newNode);
          }
        });
        worldData.timeline = mergedTimeline;
      }
    } else {
      worldData.timeline = timeline;
    }
    saveWorldData();
    renderTimeline();
  } catch (err) {
    alert("故事时间脉络编织失败: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

async function handleInferWorldFromOutline() {
  const novel = window.currentNovel;
  if (!novel) {
    alert("请先前往连载铸造区选择或创建一部小说！");
    return;
  }

  // 智能且宽容地检查是否有可用的大纲内容（包括正式大纲、生成大纲或生成设定）
  const outlineContent = novel.outline || novel.generatedOutline || novel.generatedSetting;
  if (!outlineContent || !outlineContent.trim()) {
    alert("当前小说尚未生成或填写大纲！\n请先前往【任务设定】页面完成人物及章节大纲生成，或在连载铸造区填写大纲内容。");
    return;
  }

  if (!ModelConfigManager.hasValidKey()) {
    alert("请先在设置中填写 API Key");
    return;
  }
  const modelConfig = ModelConfigManager.get();

  const btn = document.getElementById("inferWorldFromOutlineBtn");
  if (!btn) return;
  const oldHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `⚡ 深度推演中...`;

  try {
    // 发送 POST /api/generate
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(window._authHeaders ? window._authHeaders() : {})
      },
      body: JSON.stringify({
        mode: "world_infer",
        input: {
          id: novel.id,
          title: novel.title,
          genre: novel.genre,
          generatedCharacters: novel.generatedCharacters || novel.characters || "",
          generatedSetting: novel.generatedSetting || "",
          generatedOutline: novel.generatedOutline || novel.outline || "" // 🌟 核心参数兜底：透传正式大纲
        },
        modelConfig
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "推演失败");

    const inferred = cleanAndParseJson(data.text);
    if (!inferred || typeof inferred !== "object") {
      throw new Error("AI 返回的数据未能成功解析为设定对象");
    }

    const newCharacters = inferred.characters || [];
    const newWorldview = inferred.worldview || {};
    const newRules = inferred.rules || [];
    const newTimeline = inferred.timeline || [];

    // 检查是否已有设定
    const hasExisting = (worldData.characters && worldData.characters.length > 0) ||
                        (worldData.worldview && (worldData.worldview.era || worldData.worldview.location || worldData.worldview.society || worldData.worldview.special)) ||
                        (worldData.rules && worldData.rules.length > 0) ||
                        (worldData.timeline && worldData.timeline.length > 0);

    let isOverwrite = true;
    if (hasExisting) {
      isOverwrite = confirm("检测到当前已存在世界设定（人物、世界观、规则或时间线）。\n\n点击【确定】将[清空并覆盖]已有设定，完全替换为 AI 大纲推演的结果。\n点击【取消】将保留已有设定，仅进行[智能合并]（同名人物更新设定，新规则与时间轴去重追加）。");
    }

    if (isOverwrite) {
      worldData.characters = newCharacters;
      worldData.worldview = {
        era: newWorldview.era || "",
        location: newWorldview.location || "",
        society: newWorldview.society || "",
        special: newWorldview.special || ""
      };
      worldData.rules = newRules;
      worldData.timeline = newTimeline;
    } else {
      // 智能合并

      // 1. 人物合并：同名合并，异名追加
      if (!worldData.characters) worldData.characters = [];
      newCharacters.forEach(nc => {
        const idx = worldData.characters.findIndex(c => c.name === nc.name);
        if (idx !== -1) {
          worldData.characters[idx] = { ...worldData.characters[idx], ...nc };
        } else {
          worldData.characters.push(nc);
        }
      });

      // 2. 世界观合并：空值填充
      if (!worldData.worldview) {
        worldData.worldview = { era: "", location: "", society: "", special: "" };
      }
      ["era", "location", "society", "special"].forEach(field => {
        if (!worldData.worldview[field]) {
          worldData.worldview[field] = newWorldview[field] || "";
        }
      });

      // 3. 规则合并：去重追加
      if (!worldData.rules) worldData.rules = [];
      newRules.forEach(nr => {
        const exists = worldData.rules.some(r => r.content.trim() === nr.content.trim());
        if (!exists) {
          worldData.rules.push(nr);
        }
      });

      // 4. 时间线合并：去重追加
      if (!worldData.timeline) worldData.timeline = [];
      newTimeline.forEach(nt => {
        const exists = worldData.timeline.some(t => 
          String(t.time || "").trim() === String(nt.time || "").trim() && 
          String(t.event || "").trim() === String(nt.event || "").trim()
        );
        if (!exists) {
          worldData.timeline.push(nt);
        }
      });
    }

    // 保存并重绘
    saveWorldData();
    renderAll();

    // 炫光特效反馈
    const syncArea = document.getElementById("worldOutlineSyncArea");
    if (syncArea) {
      syncArea.style.transition = "all 0.5s ease";
      syncArea.style.boxShadow = "0 0 30px rgba(59, 130, 246, 0.6)";
      syncArea.style.borderColor = "#3b82f6";
      setTimeout(() => {
        syncArea.style.boxShadow = "";
        syncArea.style.borderColor = "";
      }, 1500);
    }

    alert("⚡ 设定深度推演并渲染成功！已为您同步大纲中的人物志、世界观、逻辑铁律及故事时间线。");

  } catch (err) {
    alert("推演世界设定失败: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldHtml;
  }
}

// ─── 初始化 ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // 稍微延迟等模板加载完毕
  setTimeout(() => {
    initTaskPanel();
    initWorldPanel();
  }, 800);
});
