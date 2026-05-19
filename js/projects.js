// ============================================================
// 模块: projects.js — 项目存储 / 历史记录 / 同步 / IO 工具
// 依赖: constants.js (STORAGE_KEY, USER_KEY), billing.js, planner.js
// ============================================================

function getUserId() {
  let userId = localStorage.getItem(USER_KEY);
  if (!userId) {
    userId = `local_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    localStorage.setItem(USER_KEY, userId);
  }
  return userId;
}

function renderUser() {
  userIdText.textContent = `匿名账号：${getUserId()}`;
}

function setSyncStatus(message) {
  syncStatus.textContent = message;
}

async function syncToBackend() {
  const response = await fetch("/api/account/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: getUserId(),
      billing: readBilling(),
      projects: readProjects()
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "同步失败");
  }
  setSyncStatus(`已同步：${formatTime(new Date().toISOString())}，云端 ${data.projects.length} 个草稿`);
}

async function pullFromBackend() {
  const response = await fetch(`/api/account?userId=${encodeURIComponent(getUserId())}`);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "拉取失败");
  }
  if (data.account) {
    writeBilling(data.account);
  }
  if (Array.isArray(data.projects) && data.projects.length) {
    writeProjects(data.projects);
  }
  renderBilling();
  renderHistory();
  setSyncStatus(`已拉取：${formatTime(new Date().toISOString())}，云端 ${data.projects.length} 个草稿`);
}

function readProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, 8)));
}

function formatTime(isoTime) {
  const date = new Date(isoTime);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderHistory() {
  const projects = readProjects();
  if (!projects.length) {
    historyList.innerHTML = `<p class="history-empty">还没有保存的草稿。生成方案后点“保存项目”，这里会保留最近 8 个。</p>`;
    return;
  }

  historyList.innerHTML = projects
    .map((project) => `
      <button class="history-item" type="button" data-project-id="${escapeHtml(project.id)}">
        <span class="history-title">${escapeHtml(project.profile.label)}｜${escapeHtml(project.input.theme)}</span>
        <span class="history-meta">${escapeHtml(formatTime(project.savedAt || project.createdAt))} · ${escapeHtml(project.input.length)} 字 · ${escapeHtml(project.input.tags.join("、") || "无标签")}</span>
      </button>
    `)
    .join("");
}

function loadProject(projectId) {
  const project = readProjects().find((item) => item.id === projectId);
  if (!project) return;
  currentPlan = project;
  syncFormFromPlan(project);
  if (typeof renderPlanData === "function") {
    renderPlanData(project);
  }
}

function syncFormFromPlan(plan) {
  document.querySelector("#genre").value = plan.input.genre;
  document.querySelector("#theme").value = plan.input.theme;
  document.querySelector("#viewpoint").value = plan.input.viewpoint;
  document.querySelector("#ending").value = plan.input.ending;
  lengthInput.value = plan.input.length;
  intensityInput.value = plan.input.intensity;
  const titleInput = document.querySelector("#storyTitle");
  if (titleInput) titleInput.value = plan.displayTitle || plan.titles?.[0] || "";
  document.querySelectorAll(".tag").forEach((tag) => {
    tag.classList.toggle("active", plan.input.tags.includes(tag.dataset.tag));
  });
  syncRangeLabels();
  if (typeof window.syncProjectChrome === "function") {
    window.syncProjectChrome(plan);
  }
}

function saveCurrentProject() {
  if (!currentPlan) return;
  const projects = readProjects().filter((project) => project.id !== currentPlan.id);
  const savedPlan = {
    ...currentPlan,
    displayTitle: getPlanDisplayTitle(currentPlan),
    savedAt: new Date().toISOString()
  };
  writeProjects([savedPlan, ...projects]);
  currentPlan = savedPlan;
  renderHistory();
  if (typeof window.syncProjectChrome === "function") {
    window.syncProjectChrome(savedPlan);
  }
}

function syncRangeLabels() {
  lengthOutput.value = `${lengthInput.value} 字`;
  intensityOutput.value = `${intensityInput.value} / 10`;
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // 浏览器可能因权限策略拒绝 Clipboard API，继续走兼容复制方案。
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch {
    // 在受限浏览器中复制可能不可用，但不阻断后续创作流程。
  }
  textarea.remove();
}

window.copyCurrentProposal = async function copyCurrentProposal() {
  if (!currentPlan) return;
  syncDraftFromEditor();
  await copyText(formatProposalPack(currentPlan.proposalPack));
};
