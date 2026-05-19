// ============================================================
// 模块: js/auth.js — 登录与 JWT 鉴权
// ============================================================

let authToken = localStorage.getItem("auth_token") || "";
let authUser = JSON.parse(localStorage.getItem("auth_user") || "null");

function storageKey(name, fallback) {
  return typeof window[name] !== "undefined" ? window[name] : fallback;
}

function projectStorageKey() {
  return storageKey("STORAGE_KEY", "yanxuan-story-projects");
}

function userStorageKey() {
  return storageKey("USER_KEY", "yanxuan-story-user-id");
}

function billingStorageKey() {
  return storageKey("BILLING_KEY", "yanxuan-story-billing");
}

function modelConfigStorageKey() {
  return storageKey("MODEL_CONFIG_KEY", "yanxuan-story-model-config");
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function repairProjectStorageIfNeeded(userId) {
  const key = projectStorageKey();
  const raw = localStorage.getItem(key);
  if (raw && /^U\d+$/.test(raw.trim())) {
    localStorage.setItem(userStorageKey(), raw.trim());
    localStorage.setItem(key, "[]");
  }
  localStorage.setItem(userStorageKey(), userId);
}

// 拦截原生 fetch，自动注入 Authorization header
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  // 只拦截发往本站 /api 的请求
  if (typeof url === "string" && url.startsWith("/api/")) {
    options.headers = {
      ...options.headers,
      "Authorization": authToken ? `Bearer ${authToken}` : ""
    };
  }
  
  const response = await originalFetch.call(this, url, options);
  
  // 只有已登录用户的 token 失效时才强制重新登录。
  // 本地模式下部分账号接口可能返回 401，不能用登录弹窗遮挡整个工作台。
  if (response.status === 401 && authToken) {
    logout();
    showLoginModal();
  }
  
  return response;
};

function setAuthData(token, user) {
  authToken = token;
  authUser = user;
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
  repairProjectStorageIfNeeded(user.id);
}

function renderUserInfoBar() {
  const nameEl = document.getElementById("userInfoName");
  const adminLink = document.getElementById("adminLink");
  const authActionBtn = document.getElementById("logoutBtn");
  if (!nameEl) return;
  if (!authUser) {
    nameEl.textContent = "本地模式";
    if (authActionBtn) authActionBtn.textContent = "登录";
    if (adminLink) adminLink.style.display = "none";
    return;
  }
  nameEl.textContent = `👤 ${authUser.username}`;
  if (authActionBtn) authActionBtn.textContent = "退出";
  // 同时兼容新版 role 字段和旧版仅凭 username 判定
  const isAdmin = authUser.role === "admin" || authUser.username === "admin";
  if (adminLink && isAdmin) {
    adminLink.style.display = "inline";
  }
}

function logout() {
  if (!authToken && !authUser) {
    showLoginModal();
    return;
  }
  authToken = "";
  authUser = null;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  const nameEl = document.getElementById("userInfoName");
  if (nameEl) nameEl.textContent = "本地模式";
  const authActionBtn = document.getElementById("logoutBtn");
  if (authActionBtn) authActionBtn.textContent = "登录";
  const adminLink = document.getElementById("adminLink");
  if (adminLink) adminLink.style.display = "none";
}

function showLoginModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "flex";
}

function hideLoginModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
}

function publicModelConfig(config = {}) {
  const { presetId, baseUrl, model } = config || {};
  return { presetId, baseUrl, model };
}

async function handleLogin(username, password) {
  const res = await originalFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.ok) {
    setAuthData(data.token, { id: data.userId, username: data.username, role: data.role });
    hideLoginModal();
    renderUserInfoBar();
  } else {
    alert(data.message || "登录失败");
  }
}

async function handleRegister(username, password) {
  const res = await originalFetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.ok) {
    setAuthData(data.token, { id: data.userId, username: data.username, role: data.role });
    hideLoginModal();
    renderUserInfoBar();
  } else {
    alert(data.message || "注册失败");
  }
}

window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.hideLoginModal = hideLoginModal;
window.showLoginModal = showLoginModal;
window.logout = logout;

// ============================================================
// 账号同步功能
// ============================================================

async function pushSync() {
  if (!authToken) return alert("请先登录");
  const statusEl = document.getElementById("syncStatus");
  if (statusEl) statusEl.textContent = "正在同步...";

  // 收集本地所有需要同步的数据
  const modelConfig = readJsonStorage(modelConfigStorageKey(), {});
  const syncData = {
    projects: readJsonStorage(projectStorageKey(), []),
    billing: readJsonStorage(billingStorageKey(), null),
    modelConfig: publicModelConfig(modelConfig),
    history: readJsonStorage("story_history", []),
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch("/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncData })
    });
    const data = await res.json();
    if (data.ok) {
      if (statusEl) statusEl.textContent = "最近同步: " + new Date().toLocaleTimeString();
    } else {
      alert("同步失败: " + data.message);
    }
  } catch (e) {
    console.error(e);
    alert("网络错误，同步失败");
  }
}

async function pullSync() {
  if (!authToken) return alert("请先登录");
  const statusEl = document.getElementById("syncStatus");
  if (statusEl) statusEl.textContent = "正在拉取...";

  try {
    const res = await fetch("/api/auth/sync", { method: "GET" });
    const data = await res.json();
    if (data.ok && data.syncData) {
      const s = data.syncData;
      // 覆盖本地存储
      if (Array.isArray(s.projects)) localStorage.setItem(projectStorageKey(), JSON.stringify(s.projects));
      if (s.billing) localStorage.setItem(billingStorageKey(), JSON.stringify(s.billing));
      if (s.modelConfig) {
        const localConfig = readJsonStorage(modelConfigStorageKey(), {});
        localStorage.setItem(modelConfigStorageKey(), JSON.stringify({ ...s.modelConfig, apiKey: localConfig.apiKey || "" }));
      }
      if (s.history) localStorage.setItem("story_history", JSON.stringify(s.history));
      
      if (statusEl) statusEl.textContent = "拉取成功，即将刷新";
      setTimeout(() => window.location.reload(), 1000);
    } else {
      alert("服务器上暂无同步数据");
      if (statusEl) statusEl.textContent = "暂无备份";
    }
  } catch (e) {
    console.error(e);
    alert("拉取失败");
  }
}

// 绑定按钮
document.addEventListener("DOMContentLoaded", () => {
  renderUserInfoBar();
  const syncNowBtn = document.getElementById("syncNowBtn");
  const pullSyncBtn = document.getElementById("pullSyncBtn");
  if (syncNowBtn) syncNowBtn.addEventListener("click", pushSync);
  if (pullSyncBtn) pullSyncBtn.addEventListener("click", pullSync);
  
  const userIdText = document.getElementById("userIdText");
  if (userIdText && authUser) userIdText.textContent = `ID: ${authUser.id}`;
});

// 启动检查
window.addEventListener("DOMContentLoaded", () => {
  if (!authToken) {
    renderUserInfoBar();
  } else {
    renderUserInfoBar();
  }
});
