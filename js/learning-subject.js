// ============================================================
// 模块: learning-subject.js — 学科常识规范库列表与扩充交互
// ============================================================

const categoryLabels = {
  history: "历史常识",
  geography: "地理生态",
  physics: "物理规律",
  chemistry: "化学毒理",
  science: "通用科学",
  people: "人物生平"
};

const categoryColors = {
  history: { bg: "rgba(249,115,22,0.15)", text: "#f97316", border: "rgba(249,115,22,0.2)" },
  geography: { bg: "rgba(14,165,233,0.15)", text: "#0ea5e9", border: "rgba(14,165,233,0.2)" },
  physics: { bg: "rgba(168,85,247,0.15)", text: "#a855f7", border: "rgba(168,85,247,0.2)" },
  chemistry: { bg: "rgba(236,72,153,0.15)", text: "#ec4899", border: "rgba(236,72,153,0.2)" },
  science: { bg: "rgba(16,185,129,0.15)", text: "#10b981", border: "rgba(16,185,129,0.2)" },
  people: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6", border: "rgba(59,130,246,0.2)" }
};

function getKnowledgeUserQuery() {
  return typeof knowledgeUserIdQuery === "function" ? knowledgeUserIdQuery() : "";
}

async function loadSubjectKnowledgeFullList() {
  const listEl = document.querySelector("#subjectKnowledgeFullList");
  const countEl = document.querySelector("#subjectKnowledgeCount");
  const emptyEl = document.querySelector("#subjectKnowledgeEmptyState");
  if (!listEl) return;

  try {
    const res = await fetch(`/api/knowledge/list${getKnowledgeUserQuery()}`);
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.list)) {
      if (countEl) countEl.textContent = data.message || "加载失败";
      return;
    }

    const list = data.list;
    if (list.length === 0) {
      if (countEl) countEl.textContent = "暂无常识约束";
      if (emptyEl) emptyEl.style.display = "block";
      listEl.style.display = "none";
      listEl.innerHTML = "";
      return;
    }

    if (countEl) countEl.textContent = `已收录 ${list.length} 个学科常识实体`;
    if (emptyEl) emptyEl.style.display = "none";
    listEl.style.display = "grid";
    listEl.innerHTML = list.map((item) => {
      const color = categoryColors[item.category] || { bg: "rgba(100,116,139,0.15)", text: "#64748b", border: "rgba(100,116,139,0.2)" };
      const idText = String(item.id || "").split("_").slice(0, 2).join("_") || "local";
      return `
        <div class="knowledge-card">
          <div class="knowledge-card-head">
            <span class="knowledge-card-tag" style="background:${color.bg};color:${color.text};border-color:${color.border};">
              ${escapeHtml(categoryLabels[item.category] || item.category || "未分类")}
            </span>
            <span class="knowledge-card-id">ID: ${escapeHtml(idText)}</span>
          </div>
          <h4>${escapeHtml(item.entity || "未命名实体")}</h4>
          <p>${escapeHtml(item.content || "暂无内容")}</p>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("加载学科常识库失败：", error);
    if (countEl) countEl.textContent = "网络异常";
  }
}

async function expandSubjectKnowledge(entity, triggerButton) {
  const normalizedEntity = String(entity || "").trim();
  if (!normalizedEntity) {
    alert("请输入有效的常识实体名称。");
    return false;
  }

  const originalText = triggerButton?.textContent || "";
  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.textContent = "联网/AI 扩充中...";
  }

  try {
    const hasClient = typeof hasClientModelConfig === "function" && hasClientModelConfig();
    const clientCfg = typeof readModelConfig === "function" ? readModelConfig() : {};
    const modelConfig = hasClient
      ? { apiKey: clientCfg.apiKey, baseUrl: clientCfg.baseUrl || undefined, model: clientCfg.model }
      : null;

    const res = await fetch(`/api/knowledge/auto-expand${getKnowledgeUserQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: normalizedEntity, modelConfig })
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || "扩充常识失败");
      return false;
    }

    const item = data.item || {};
    alert(`已扩充常识实体：“${item.entity || normalizedEntity}”`);
    await loadSubjectKnowledgeFullList();
    if (typeof window.refreshSubjectKnowledge === "function") {
      window.refreshSubjectKnowledge(normalizedEntity);
    }
    return true;
  } catch (error) {
    console.error("自动扩充学科常识失败：", error);
    alert("请求接口出错，请检查网络或模型配置。");
    return false;
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = originalText;
    }
  }
}

function bindExpandInput(buttonSelector, inputSelector) {
  const button = document.querySelector(buttonSelector);
  const input = document.querySelector(inputSelector);
  if (!button || !input) return;

  button.addEventListener("click", async () => {
    const success = await expandSubjectKnowledge(input.value, button);
    if (success) input.value = "";
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      button.click();
    }
  });
}

function initSubjectKnowledgeExpandEvents() {
  bindExpandInput("#expandKnowledgeBtn", "#expandEntityInput");
  bindExpandInput("#quickExpandBtn", "#quickExpandInput");
}

window.loadSubjectKnowledgeFullList = loadSubjectKnowledgeFullList;
window.initSubjectKnowledgeExpandEvents = initSubjectKnowledgeExpandEvents;
