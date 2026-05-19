// 模块: model-config.js — 模型配置 UI 与运行状态初始化
window.apiState = { checked: false, ready: false, model: "" };
window.currentPlan = null;

function readModelConfig() {
  try {
    return JSON.parse(localStorage.getItem(MODEL_CONFIG_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function hasClientModelConfig() {
  const cfg = readModelConfig();
  return Boolean(cfg.apiKey && cfg.model);
}

function writeModelConfig(cfg) {
  localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(cfg || {}));
}

function ensureLocalUserId() {
  if (localStorage.getItem(USER_KEY)) return;
  const id = `local_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  localStorage.setItem(USER_KEY, id);
}

function bindLegacyDomGlobals() {
  window.lengthInput = document.getElementById("length");
  window.intensityInput = document.getElementById("intensity");
  window.lengthOutput = document.getElementById("lengthOutput");
  window.intensityOutput = document.getElementById("intensityOutput");
  window.historyList = document.getElementById("historyList");
  window.syncStatus = document.getElementById("syncStatus");
  window.userIdText = document.getElementById("userIdText");
}

function renderModelConfigForm() {
  const cfg = readModelConfig();
  const base = document.getElementById("modelBaseUrl");
  const key = document.getElementById("modelApiKey");
  const model = document.getElementById("modelName");
  const status = document.getElementById("modelConfigStatus");
  if (base) base.value = cfg.baseUrl || "";
  if (key) key.value = cfg.apiKey || "";
  if (model) model.value = cfg.model || "gpt-5.2";
  if (status) {
    status.textContent = hasClientModelConfig() ? `客户端模型：${cfg.model}` : "未配置客户端模型";
  }
}

function initModelConfigUi() {
  ensureLocalUserId();
  bindLegacyDomGlobals();
  renderModelConfigForm();

  document.getElementById("saveModelConfigBtn")?.addEventListener("click", () => {
    writeModelConfig({
      baseUrl: document.getElementById("modelBaseUrl")?.value.trim() || "",
      apiKey: document.getElementById("modelApiKey")?.value.trim() || "",
      model: document.getElementById("modelName")?.value.trim() || "gpt-5.2"
    });
    renderModelConfigForm();
    if (typeof setApiStatus === "function") setApiStatus({ checked: true });
  });

  document.getElementById("clearModelConfigBtn")?.addEventListener("click", () => {
    localStorage.removeItem(MODEL_CONFIG_KEY);
    renderModelConfigForm();
    if (typeof setApiStatus === "function") setApiStatus({ checked: true });
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (typeof logout === "function") logout();
  });
}

document.addEventListener("DOMContentLoaded", initModelConfigUi);
