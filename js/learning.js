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

function initLearningEvents() {
  const tabShort = document.querySelector("#tabShort");
  const tabSerial = document.querySelector("#tabSerial");
  const tabLearn = document.querySelector("#tabLearn");
  
  const panelShort = document.querySelector("#panelShort");
  const panelSerial = document.querySelector("#panelSerial");
  const panelLearn = document.querySelector("#panelLearn");

  if (tabLearn) {
    tabLearn.addEventListener("click", () => {
      tabLearn.classList.add("active");
      if (tabShort) tabShort.classList.remove("active");
      if (tabSerial) tabSerial.classList.remove("active");
      
      if (panelLearn) panelLearn.hidden = false;
      if (panelShort) panelShort.hidden = true;
      if (panelSerial) panelSerial.hidden = true;
      
      loadKnowledgeList(); // 每次切换面板，自动重载列表
    });
  }

  // 确保其他 Tab 点击时，隐藏学习面板
  if (tabShort) {
    tabShort.addEventListener("click", () => {
      tabShort.classList.add("active");
      if (tabSerial) tabSerial.classList.remove("active");
      if (tabLearn) tabLearn.classList.remove("active");
      
      if (panelShort) panelShort.hidden = false;
      if (panelSerial) panelSerial.hidden = true;
      if (panelLearn) panelLearn.hidden = true;
    });
  }

  if (tabSerial) {
    tabSerial.addEventListener("click", () => {
      tabSerial.classList.add("active");
      if (tabShort) tabShort.classList.remove("active");
      if (tabLearn) tabLearn.classList.remove("active");
      
      if (panelSerial) panelSerial.hidden = false;
      if (panelShort) panelShort.hidden = true;
      if (panelLearn) panelLearn.hidden = true;
    });
  }

  // 绑定拆解按钮
  const startBtn = document.querySelector("#startLearnBtn");
  if (startBtn) {
    startBtn.addEventListener("click", handleStartDissect);
  }

  // 绑定保存按钮
  const saveBtn = document.querySelector("#saveInspirationBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleSaveInspiration);
  }

  // 绑定 TXT 导入按钮事件
  const importEl = document.querySelector("#learnImportTxt");
  if (importEl) {
    importEl.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const textarea = document.querySelector("#learnRawText");
        if (textarea) {
          textarea.value = text;
          // 友情提示导入成功
          alert(`🎉 成功导入文件: ${file.name} (${file.size} 字节)`);
        }
      };
      reader.onerror = () => {
        alert("读取文件失败，请确保文件编码为 UTF-8！");
      };
      reader.readAsText(file, "utf-8");
      // 重置以允许重复导入同一文件
      importEl.value = "";
    });
  }
}

async function handleStartDissect() {
  const btn = document.querySelector("#startLearnBtn");
  const rawText = document.querySelector("#learnRawText").value.trim();
  const genre = document.querySelector("#learnGenre").value;

  if (!rawText) {
    alert("请粘贴爆款文章原文！");
    return;
  }

  if (rawText.length < 200) {
    alert("粘贴内容过少，建议提供至少 200 字以上的内容以供 AI 准确拆解。");
    return;
  }

  btn.disabled = true;
  btn.textContent = "⚡ AI 正在深度阅读与拆解中...";

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
    if (data.ok) {
      window.currentDissected = {
        genre,
        theme: data.theme,
        hook: data.hook,
        outline: data.outline,
        rawText
      };

      // 渲染页面
      document.querySelector("#learnResultTheme").textContent = data.theme;
      document.querySelector("#learnResultHook").textContent = data.hook;
      document.querySelector("#learnResultOutline").textContent = data.outline.split(";").join("\n");
      
      document.querySelector("#learnEmptyState").style.display = "none";
      document.querySelector("#learnResultArea").style.display = "flex";
    } else {
      alert(data.message || "AI 拆解失败，请检查模型配置");
    }
  } catch (e) {
    console.error(e);
    alert("网络错误或 AI 处理异常");
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ 让 AI 开始拆解学习";
  }
}

async function handleSaveInspiration() {
  const btn = document.querySelector("#saveInspirationBtn");
  const dissected = window.currentDissected;
  if (!dissected) return;

  btn.disabled = true;
  btn.textContent = "💾 正在存入灵感库...";

  try {
    const res = await fetch(`/api/inspirations${knowledgeUserIdQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dissected)
    });

    const data = await res.json();
    if (data.ok) {
      alert("🎉 拆解学习成功！该爆款设想已存入本地灵感库！");
      // 重置表单和结果
      document.querySelector("#learnRawText").value = "";
      document.querySelector("#learnEmptyState").style.display = "flex";
      document.querySelector("#learnResultArea").style.display = "none";
      window.currentDissected = null;
      loadKnowledgeList(); // 学习保存成功后，实时刷新知识库列表
    } else {
      alert(data.message || "保存失败");
    }
  } catch (_) {
    alert("保存网络错误");
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 保存为专属灵感库";
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  initLearningEvents();
  loadKnowledgeList(); // 初始加载知识库
});

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

async function loadKnowledgeList() {
  const listEl = document.querySelector("#knowledgeList");
  const countEl = document.querySelector("#knowledgeCount");
  const emptyEl = document.querySelector("#knowledgeEmptyState");
  if (!listEl) return;

  try {
    const res = await fetch(`/api/inspirations${knowledgeUserIdQuery()}`);
    const data = await res.json();
    
    if (data.ok && Array.isArray(data.inspirations)) {
      const list = data.inspirations.filter(isUsableKnowledgeItem);
      
      // 高性能渲染：融合展示个人手动拆解与批量导入数据，限制前 100 条以保护 DOM 不会卡死
      const userOwned = list.slice(0, 100);
      
      if (userOwned.length > 0) {
        countEl.textContent = `已学习 ${userOwned.length} 个专属写作模型`;
        countEl.style.borderColor = "var(--primary)";
        emptyEl.style.display = "none";
        listEl.style.display = "grid";
        
        listEl.innerHTML = userOwned.map(item => `
          <div class="knowledge-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px; transition: all 0.2s; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="display: flex; gap: 6px;">
                <span style="font-size: 11px; background: rgba(168,85,247,0.15); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid rgba(168,85,247,0.2);">
                  ${genreLabels[item.genre] || item.genre}
                </span>
                ${item.user_id === 'admin' ? `
                  <span style="font-size: 11px; background: rgba(16,185,129,0.15); color: #10b981; padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid rgba(16,185,129,0.2);">
                    批量导入
                  </span>
                ` : `
                  <span style="font-size: 11px; background: rgba(59,130,246,0.15); color: #3b82f6; padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid rgba(59,130,246,0.2);">
                    专属自学
                  </span>
                `}
              </div>
              ${item.user_id !== 'admin' ? `
                <button onclick="handleDeleteInspiration('${item.id}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 11px; padding: 2px 6px; border-radius: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'" title="删除已学模型">
                  🗑️ 删除
                </button>
              ` : `
                <span style="font-size: 11px; color: var(--text-muted); padding: 2px 6px; user-select: none;">
                  🔒 系统锁定
                </span>
              `}
            </div>
            
            <h4 style="margin: 0; font-size: 13px; color: var(--text-main); font-weight: 600; line-height: 1.4;">
              ${escapeHtml(item.theme)}
            </h4>
            
            <div style="font-size: 11px; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px; background: var(--bg-app); padding: 8px; border-radius: 6px; border: 1px solid var(--border);">
              <div><strong style="color: var(--text-main);">🪝 开篇钩子：</strong>${escapeHtml(item.hook)}</div>
              <div style="border-top: 1px solid var(--border); padding-top: 4px; margin-top: 4px;"><strong style="color: var(--text-main);">📜 骨架大纲：</strong>${escapeHtml(item.outline.split(';').join(' → '))}</div>
            </div>
            
            ${item.raw_text ? `
              <div style="font-size: 11px; color: var(--text-muted); font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; line-height: 1.4;" title="${escapeHtml(item.raw_text)}">
                “ ${escapeHtml(item.raw_text.slice(0, 80))}... ”
              </div>
            ` : ""}
            
            <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--border); font-size: 10px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
              <span>学习时间：${new Date(item.created_at).toLocaleDateString()}</span>
              <span style="color: #10b981; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 6px; height: 6px; background: #10b981; border-radius: 50%;"></span>
                RAG 已召回
              </span>
            </div>
          </div>
        `).join("");
      } else {
        countEl.textContent = "默认自学配置";
        countEl.style.borderColor = "var(--border)";
        emptyEl.style.display = "block";
        listEl.style.display = "none";
      }
    } else {
      countEl.textContent = "加载失败";
    }
  } catch (e) {
    console.error("加载专属知识库失败：", e);
    countEl.textContent = "网络异常";
  }
}

async function handleDeleteInspiration(id) {
  if (!confirm("⚠️ 确定要删除该专属爆款模型吗？删除后系统将无法检索以此段落进行写作风格学习。")) return;
  
  try {
    const res = await fetch(`/api/inspirations?id=${id}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (data.ok) {
      alert("🗑️ 删除成功！系统知识库已完成修剪。");
      loadKnowledgeList();
    } else {
      alert(data.message || "删除失败");
    }
  } catch (e) {
    alert("删除请求失败，请检查网络");
  }
}
window.handleDeleteInspiration = handleDeleteInspiration;
