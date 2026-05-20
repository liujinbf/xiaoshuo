// ============================================================
// 模块: js/task-world.js — 任务设定 & 世界设定页面逻辑
// ============================================================

// ─── 任务设定：两步大纲生成 ──────────────────────────────────

function initTaskPanel() {
  // 监听连载铸造的小说切换，同步更新任务面板
  window.addEventListener("serialNovelChanged", (e) => {
    const novel = e.detail;
    refreshTaskPanel(novel);
  });

  // 如果已经选中了小说，直接刷新
  if (window.currentSerialNovel) {
    refreshTaskPanel(window.currentSerialNovel);
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
  const novel = window.currentSerialNovel;
  if (!novel) { alert("请先在连载铸造中选择一部小说"); return; }
  const modelConfig = window.getModelConfig ? window.getModelConfig() : {};
  if (!modelConfig.apiKey) { alert("请先在设置中填写 API Key"); return; }

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
    if (window.currentSerialNovel) {
      window.currentSerialNovel.generatedCharacters = data.characters;
      updateMilestones(window.currentSerialNovel);
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

function handleApplyCharacters() {
  const text = document.getElementById("taskCharContent")?.textContent || "";
  if (!text.trim()) { alert("还没有生成人物设定"); return; }

  // 写入连载铸造的人物志字段
  const serialCharEl = document.getElementById("serialCharacters");
  if (serialCharEl) serialCharEl.value = text;

  // 更新当前小说缓存
  if (window.currentSerialNovel) {
    window.currentSerialNovel.characters = text;
  }

  const btn = document.getElementById("applyCharBtn");
  if (btn) { btn.textContent = "✅ 已写入"; setTimeout(() => { btn.textContent = "写入人物志"; }, 2000); }
}

async function handleGenerateOutline() {
  const novel = window.currentSerialNovel;
  if (!novel) {
    alert("请先在连载铸造中选择一部小说");
    return;
  }

  const modelConfig = window.getModelConfig ? window.getModelConfig() : {};
  if (!modelConfig.apiKey) {
    alert("请先在设置中填写 API Key");
    return;
  }

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
    if (window.currentSerialNovel) {
      window.currentSerialNovel.generatedSetting = data.setting;
      window.currentSerialNovel.generatedOutline = data.chapterOutlines;
      updateMilestones(window.currentSerialNovel);
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
  // 更新当前小说的 outline 字段
  if (window.currentSerialNovel) {
    window.currentSerialNovel.outline = outlineText;
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

    // 添加人物
    if (e.target.id === "addCharBtn") handleAddCharacter();

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

    // 添加时间线节点
    if (e.target.id === "addTimelineBtn") handleAddTimeline();

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

  // 从 localStorage 恢复世界数据库
  const saved = localStorage.getItem("worldData");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      worldData = {
        characters: parsed.characters || [],
        worldview: parsed.worldview || { era: "", location: "", society: "", special: "" },
        rules: parsed.rules || [],
        timeline: parsed.timeline || []
      };
      renderAll();
    } catch (e) {
      console.error("加载世界设定存档失败", e);
    }
  }
}

function saveWorldData() {
  localStorage.setItem("worldData", JSON.stringify(worldData));
  // 将人物卡池数据同步写入当前小说角色的文本字段以支持生成依赖
  if (window.currentSerialNovel && worldData.characters.length > 0) {
    const charText = worldData.characters
      .map(c => `【${ROLE_LABELS[c.role] || "配角"}】${c.name}\n特征：${c.appearance || "无"}\n动机：${c.motive || "无"}`)
      .join("\n\n");
    window.currentSerialNovel.characters = charText;
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

  worldData.characters.push({ name, role, motive, appearance });
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

// ─── 初始化 ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // 稍微延迟等模板加载完毕
  setTimeout(() => {
    initTaskPanel();
    initWorldPanel();
  }, 800);
});
