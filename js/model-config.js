// 模块: model-config.js — 模型配置 UI 与运行状态初始化
window.apiState = { checked: false, ready: false, model: "" };
window.currentPlan = null;

// 预设的主流大模型供应商常量
const PROVIDERS = {
  deepseek: {
    name: "DeepSeek (深度求索)",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    placeholderKey: "输入您的 sk-... 格式密钥",
    placeholderUrl: "https://api.deepseek.com"
  },
  siliconflow: {
    name: "SiliconFlow (硅基流动)",
    baseUrl: "https://api.siliconflow.cn",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    models: [
      "deepseek-ai/DeepSeek-V3", 
      "deepseek-ai/DeepSeek-R1", 
      "Qwen/Qwen2.5-72B-Instruct", 
      "Qwen/Qwen2.5-14B-Instruct", 
      "THUDM/glm-4-9b-chat"
    ],
    placeholderKey: "输入您的 sk-... 格式密钥",
    placeholderUrl: "https://api.siliconflow.cn"
  },
  openai: {
    name: "OpenAI (ChatGPT)",
    baseUrl: "https://api.openai.com",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "o1-mini", "o3-mini"],
    placeholderKey: "输入您的 sk-proj-... 格式密钥",
    placeholderUrl: "https://api.openai.com"
  },
  openrouter: {
    name: "OpenRouter (聚合平台)",
    baseUrl: "https://openrouter.ai/api",
    defaultModel: "google/gemini-2.5-flash",
    models: [
      "google/gemini-2.5-flash", 
      "deepseek/deepseek-chat", 
      "anthropic/claude-3.5-sonnet", 
      "meta-llama/llama-3.3-70b-instruct"
    ],
    placeholderKey: "输入您的 sk-or-... 格式密钥",
    placeholderUrl: "https://openrouter.ai/api"
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    placeholderKey: "输入您的 AIzaSy... 格式密钥",
    placeholderUrl: "https://generativelanguage.googleapis.com"
  },
  anthropic: {
    name: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-sonnet-latest",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
    placeholderKey: "输入您的 sk-ant-... 格式密钥",
    placeholderUrl: "https://api.anthropic.com"
  },
  ollama: {
    name: "Ollama (本地离线运行)",
    baseUrl: "http://localhost:11434",
    defaultModel: "qwen2.5:14b",
    models: ["qwen2.5:14b", "qwen2.5:7b", "llama3.1", "mistral"],
    placeholderKey: "本地 Ollama 无需配置 API Key",
    placeholderUrl: "http://localhost:11434"
  },
  custom: {
    name: "-- 完全自定义 --",
    baseUrl: "",
    defaultModel: "",
    models: [],
    placeholderKey: "自定义端点密钥",
    placeholderUrl: "https://your-custom-endpoint.com"
  }
};

function readModelConfig() {
  try {
    const raw = localStorage.getItem(MODEL_CONFIG_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    
    // 初始化多供应商子配置结构
    if (!cfg.providers) {
      cfg.providers = {};
    }
    
    // 向前兼容：若是老旧的单配置数据迁移
    if (!cfg.provider) {
      const oldUrl = cfg.baseUrl || "";
      if (oldUrl.includes("deepseek.com")) cfg.provider = "deepseek";
      else if (oldUrl.includes("siliconflow.cn")) cfg.provider = "siliconflow";
      else if (oldUrl.includes("openai.com")) cfg.provider = "openai";
      else if (oldUrl.includes("openrouter.ai")) cfg.provider = "openrouter";
      else if (oldUrl.includes("googleapis.com")) cfg.provider = "gemini";
      else if (oldUrl.includes("anthropic.com")) cfg.provider = "anthropic";
      else if (oldUrl.includes("localhost") || oldUrl.includes("127.0.0.1")) cfg.provider = "ollama";
      else if (oldUrl) cfg.provider = "custom";
      else cfg.provider = "deepseek"; // 默认设置为性价比最高的 DeepSeek
    }
    
    // 迁移并同步当前生效属性至对应的子供应商中
    if (!cfg.providers[cfg.provider]) {
      cfg.providers[cfg.provider] = {
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model
      };
    }
    
    // 确保其它预设供应商也有初始值
    for (const key in PROVIDERS) {
      if (!cfg.providers[key]) {
        cfg.providers[key] = {
          baseUrl: PROVIDERS[key].baseUrl,
          apiKey: "",
          model: PROVIDERS[key].defaultModel
        };
      }
    }
    
    // 🌟 强力兼容：确保外层扁平属性与当前激活子供应商的数据完全对齐同步！🌟
    const activeProvider = cfg.provider || "deepseek";
    if (cfg.providers && cfg.providers[activeProvider]) {
      cfg.baseUrl = cfg.providers[activeProvider].baseUrl || cfg.baseUrl || "";
      cfg.apiKey = cfg.providers[activeProvider].apiKey || cfg.apiKey || "";
      cfg.model = cfg.providers[activeProvider].model || cfg.model || "";
    }
    
    return cfg;
  } catch {
    // 降级构建一个全新的带预设供应商结构的配置
    const defaultCfg = {
      provider: "deepseek",
      baseUrl: PROVIDERS.deepseek.baseUrl,
      apiKey: "",
      model: PROVIDERS.deepseek.defaultModel,
      providers: {}
    };
    for (const key in PROVIDERS) {
      defaultCfg.providers[key] = {
        baseUrl: PROVIDERS[key].baseUrl,
        apiKey: "",
        model: PROVIDERS[key].defaultModel
      };
    }
    return defaultCfg;
  }
}

function hasClientModelConfig() {
  const cfg = readModelConfig();
  const currentProvider = cfg.provider || "deepseek";
  const pData = cfg.providers[currentProvider] || {};
  return Boolean(pData.apiKey || (currentProvider === "ollama"));
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
  const providerSelect = document.getElementById("modelProvider");
  const baseInput = document.getElementById("modelBaseUrl");
  const keyInput = document.getElementById("modelApiKey");
  const modelSelect = document.getElementById("modelName");
  const customInput = document.getElementById("customModelName");

  const currentProvider = cfg.provider || "deepseek";

  
  if (providerSelect) {
    providerSelect.value = currentProvider;
  }

  // 获取该供应商在子配置里的数据
  const providerData = cfg.providers[currentProvider] || {};
  const currentBaseUrl = currentProvider === "custom" 
    ? (providerData.baseUrl || "") 
    : PROVIDERS[currentProvider].baseUrl;

  if (baseInput) {
    baseInput.value = currentBaseUrl;
    baseInput.placeholder = PROVIDERS[currentProvider].placeholderUrl;
    if (currentProvider === "custom") {
      baseInput.removeAttribute("readonly");
      baseInput.style.background = "var(--bg-card)";
      baseInput.style.cursor = "text";
    } else {
      baseInput.setAttribute("readonly", "true");
      baseInput.style.background = "rgba(74, 67, 55, 0.08)";
      baseInput.style.cursor = "not-allowed";
    }
  }

  if (keyInput) {
    keyInput.value = providerData.apiKey || "";
    keyInput.placeholder = PROVIDERS[currentProvider].placeholderKey;
  }

  if (modelSelect) {
    // 渲染此供应商的模型选项
    modelSelect.innerHTML = "";
    
    // 如果本地之前拉取并保存过此供应商专属的模型名列表，优先使用
    const availableModels = providerData.loadedModels && providerData.loadedModels.length > 0
      ? providerData.loadedModels
      : PROVIDERS[currentProvider].models;

    availableModels.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      modelSelect.appendChild(opt);
    });

    // 依然添加“自定义输入”选项
    const customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "-- 自定义输入 --";
    modelSelect.appendChild(customOpt);

    const val = providerData.model || PROVIDERS[currentProvider].defaultModel;
    
    // 检查这个值是否在当前模型选项中
    let hasOption = false;
    for (let i = 0; i < modelSelect.options.length; i++) {
      if (modelSelect.options[i].value === val) {
        hasOption = true;
        break;
      }
    }

    if (hasOption) {
      modelSelect.value = val;
      if (customInput) {
        customInput.style.display = "none";
        customInput.value = "";
      }
    } else if (val) {
      // 说明是一个原本不在列表的自定义名字（例如之前配好的）
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      modelSelect.insertBefore(opt, modelSelect.firstChild);
      modelSelect.value = val;
      if (customInput) {
        customInput.style.display = "none";
        customInput.value = "";
      }
    } else {
      modelSelect.value = "custom";
      if (customInput) {
        customInput.style.display = "block";
        customInput.value = "";
      }
    }
  }

  const statusBadge = document.getElementById("modelConfigStatus");

  if (statusBadge) {
    const activeModel = providerData.model || PROVIDERS[currentProvider].defaultModel;
    const hasKey = Boolean(providerData.apiKey || (currentProvider === "ollama"));
    
    if (hasKey && activeModel) {
      statusBadge.textContent = `${PROVIDERS[currentProvider].name.split(" ")[0]} · ${activeModel.length > 16 ? activeModel.slice(0, 14) + "…" : activeModel}`;
      statusBadge.className = "mc-status-badge success";
    } else {
      statusBadge.textContent = "未配置 API Key";
      statusBadge.className = "mc-status-badge";
    }
  }
}

async function triggerSilentFetchModels(providerName) {
  const providerSelect = document.getElementById("modelProvider");
  // 竞争保护：仅在当前供应商确实是目标供应商时操作（初始化时providerSelect可能已被renderModelConfigForm设置正确）
  if (providerSelect && providerSelect.value && providerSelect.value !== providerName) return;

  const statusBadge = document.getElementById("modelConfigStatus");
  if (statusBadge) {
    statusBadge.textContent = "⚡ 同步中...";
    statusBadge.className = "mc-status-badge";
  }

  const cfg = readModelConfig();
  const providerData = cfg.providers[providerName] || {};
  const baseUrl = providerName === "custom" ? (providerData.baseUrl || "") : PROVIDERS[providerName].baseUrl;
  const apiKey = providerData.apiKey || "";

  try {
    const response = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, apiKey })
    });

    if (!response.ok) throw new Error("接口返回错误");
    const data = await response.json();

    // ✅ 严格检查：必须 ok===true 且 source==="api" 才保存到 localStorage
    // 禁止将任何 fallback/mock/error 来源的数据存入本地
    if (data && data.ok === true && data.source === "api" && Array.isArray(data.models) && data.models.length > 0) {
      // 重新读取一次最新配置，防止在异步期间用户做了别的修改
      const latestCfg = readModelConfig();
      if (latestCfg.provider !== providerName) return;

      latestCfg.providers[providerName].loadedModels = data.models;
      
      // 确定目标模型：优先保留当前选中的（如果它在新列表里），否则必须切换到推荐模型
      const currentModel = latestCfg.providers[providerName].model || "";
      let selectTarget;

      if (currentModel && data.models.includes(currentModel)) {
        selectTarget = currentModel;
      } else {
        // 旧模型名不在新列表里（如 deepseek-v4-flash 等虚假名），强制替换
        const preferKeywords = ["chat", "v3", "flash", "turbo", "instruct", "pro"];
        let matched = null;
        for (const kw of preferKeywords) {
          matched = data.models.find(m => m.toLowerCase().includes(kw));
          if (matched) break;
        }
        selectTarget = matched || data.models[0];
        console.log(`[ModelConfig] 旧模型名 "${currentModel}" 不在官方列表中，已自动切换为: ${selectTarget}`);
      }

      latestCfg.providers[providerName].model = selectTarget;
      latestCfg.model = selectTarget;
      
      writeModelConfig(latestCfg);
      renderModelConfigForm();

      const newStatus = document.getElementById("modelConfigStatus");
      if (newStatus) {
        newStatus.textContent = `已同步 ${data.models.length} 个模型`;
        newStatus.className = "mc-status-badge success";
      }
    } else if (data && !data.ok) {
      // 联网失败：不修改 localStorage，只在状态徽章提示原因
      console.warn("[ModelConfig] 模型列表获取失败:", data.message);
      const newStatus = document.getElementById("modelConfigStatus");
      if (newStatus && newStatus.textContent === "⚡ 同步中...") {
        // 只有在"同步中"状态才覆盖提示，避免覆盖用户已有的成功状态
        newStatus.textContent = data.source === "no-key" ? "请先填写 API Key" : "同步失败，请手动刷新";
        newStatus.className = "mc-status-badge";
      }
    }
  } catch (err) {
    const latestCfg = readModelConfig();
    if (latestCfg.provider !== providerName) return;
    // 网络异常：不修改任何配置，保持原有状态
    console.warn("[ModelConfig] 静默同步网络异常:", err.message);
  }
}


function initModelConfigUi() {
  ensureLocalUserId();
  bindLegacyDomGlobals();
  renderModelConfigForm();

  // 💡 页面加载时：如果当前供应商配置了有效 Key，自动静默拉取最新模型列表
  (() => {
    const initCfg = readModelConfig();
    const initProvider = initCfg.provider || "deepseek";
    const initProviderData = initCfg.providers[initProvider] || {};
    const initKey = initProviderData.apiKey || "";
    if (initProvider !== "ollama" && initProvider !== "custom" && initKey && !initKey.startsWith("sk-your")) {
      triggerSilentFetchModels(initProvider);
    }
  })();

  const providerSelect = document.getElementById("modelProvider");
  const modelSelect = document.getElementById("modelName");
  const customInput = document.getElementById("customModelName");

  // 监听供应商选择改变事件
  providerSelect?.addEventListener("change", async (e) => {
    const selectedProvider = e.target.value;
    const cfg = readModelConfig();
    
    // 切换当前激活的供应商
    cfg.provider = selectedProvider;
    // 写入扁平状态层，方便外部模块读取
    const providerData = cfg.providers[selectedProvider] || {};
    cfg.baseUrl = selectedProvider === "custom" ? (providerData.baseUrl || "") : PROVIDERS[selectedProvider].baseUrl;
    cfg.apiKey = providerData.apiKey || "";
    cfg.model = providerData.model || PROVIDERS[selectedProvider].defaultModel;
    
    writeModelConfig(cfg);
    renderModelConfigForm();

    // 💡 自动联网同步最新模型：如果该供应商配置了有效 Key，静默同步
    if (selectedProvider !== "ollama" && selectedProvider !== "custom" && providerData.apiKey && !providerData.apiKey.startsWith("sk-your")) {
      triggerSilentFetchModels(selectedProvider);
    }
  });

  // 监听 select 改变事件以显示/隐藏自定义输入框
  modelSelect?.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      if (customInput) {
        customInput.style.display = "block";
        customInput.focus();
      }
    } else {
      if (customInput) customInput.style.display = "none";
    }
  });

  // 保存配置
  document.getElementById("saveModelConfigBtn")?.addEventListener("click", () => {
    const currentProvider = providerSelect?.value || "deepseek";
    let finalModel = modelSelect?.value || PROVIDERS[currentProvider].defaultModel;
    if (finalModel === "custom") {
      finalModel = customInput?.value.trim() || "";
      if (!finalModel) {
        alert("请输入自定义的大模型名称！");
        return;
      }
    }

    const cfg = readModelConfig();
    const inputBaseUrl = document.getElementById("modelBaseUrl")?.value.trim() || "";
    const inputApiKey = document.getElementById("modelApiKey")?.value.trim() || "";

    // 1. 更新对应供应商的子配置
    if (!cfg.providers[currentProvider]) {
      cfg.providers[currentProvider] = {};
    }
    cfg.providers[currentProvider].baseUrl = currentProvider === "custom" ? inputBaseUrl : PROVIDERS[currentProvider].baseUrl;
    cfg.providers[currentProvider].apiKey = inputApiKey;
    cfg.providers[currentProvider].model = finalModel;

    // 2. 将此供应商子配置同步存入全局当前生效字段
    cfg.provider = currentProvider;
    cfg.baseUrl = cfg.providers[currentProvider].baseUrl;
    cfg.apiKey = cfg.providers[currentProvider].apiKey;
    cfg.model = cfg.providers[currentProvider].model;

    writeModelConfig(cfg);
    renderModelConfigForm();

    // 保存成功：按鈕内联反馈（替代alert）
    const saveBtn = document.getElementById("saveModelConfigBtn");
    if (saveBtn) {
      const prev = saveBtn.textContent;
      saveBtn.textContent = "✓ 已保存";
      saveBtn.style.background = "linear-gradient(135deg, #22a078, #176b54)";
      setTimeout(() => {
        saveBtn.textContent = prev;
        saveBtn.style.background = "";
      }, 1800);
    }

    if (typeof setApiStatus === "function") setApiStatus({ checked: true });

    // 保存完毕后，自动联网获取最新模型名称
    if (currentProvider !== "ollama" && currentProvider !== "custom" && inputApiKey && !inputApiKey.startsWith("sk-your")) {
      triggerSilentFetchModels(currentProvider);
    }
  });

  // 清空配置
  document.getElementById("clearModelConfigBtn")?.addEventListener("click", () => {
    const currentProvider = providerSelect?.value || "deepseek";
    const cfg = readModelConfig();
    
    if (cfg.providers[currentProvider]) {
      cfg.providers[currentProvider].apiKey = "";
      cfg.providers[currentProvider].model = PROVIDERS[currentProvider].defaultModel;
      cfg.providers[currentProvider].loadedModels = [];
    }

    if (cfg.provider === currentProvider) {
      cfg.apiKey = "";
      cfg.model = PROVIDERS[currentProvider].defaultModel;
    }

    if (customInput) customInput.value = "";
    
    writeModelConfig(cfg);
    renderModelConfigForm();
    
    if (typeof setApiStatus === "function") setApiStatus({ checked: true });
  });

  // 联网获取大模型可用列表（手动刷新）
  document.getElementById("fetchRemoteModelsBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const originalText = btn.textContent;
    btn.textContent = "⚡ 正在联网获取模型列表...";
    btn.disabled = true;

    const currentProvider = providerSelect?.value || "deepseek";
    const baseVal = document.getElementById("modelBaseUrl")?.value.trim() || "";
    const keyVal = document.getElementById("modelApiKey")?.value.trim() || "";

    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseVal, apiKey: keyVal })
      });

      if (!response.ok) throw new Error("代理接口请求失败");
      const data = await response.json();

      // ✅ 同样严格：必须 ok===true 且 source==="api" 才接受
      if (data && data.ok === true && data.source === "api" && Array.isArray(data.models) && data.models.length > 0) {
        const cfg = readModelConfig();
        cfg.providers[currentProvider].loadedModels = data.models;
        
        // 强制替换旧无效模型名
        const currentModel = cfg.providers[currentProvider].model || "";
        let selectTarget;
        if (currentModel && data.models.includes(currentModel)) {
          selectTarget = currentModel;
        } else {
          const preferKeywords = ["chat", "v3", "flash", "turbo", "instruct", "pro"];
          let matched = null;
          for (const kw of preferKeywords) {
            matched = data.models.find(m => m.toLowerCase().includes(kw));
            if (matched) break;
          }
          selectTarget = matched || data.models[0];
        }
        cfg.providers[currentProvider].model = selectTarget;
        cfg.model = selectTarget;

        writeModelConfig(cfg);
        renderModelConfigForm();

        // 成功内联反馈
        btn.textContent = `✓ 已载入 ${data.models.length} 个模型`;
        btn.style.color = "#176b54";
        setTimeout(() => { btn.style.color = ""; }, 2000);
      } else {
        // data.ok===false，显示服务端返回的真实错误原因
        throw new Error(data.message || "获取模型列表失败");
      }
    } catch (err) {
      alert(`联网获取模型失败: ${err.message || err}\n\n请确认 API Key 已填写并保存，或检查网络连接。`);
      // ❌ 不再回写任何硬编码模型，保持 localStorage 原有状态不变
    } finally {
      setTimeout(() => {

        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);

    }
  });

  // 测试连接
  document.getElementById("testModelConnectionBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const originalText = btn.textContent;
    btn.textContent = "⚡ 正在测试...";
    btn.disabled = true;

    const currentProvider = providerSelect?.value || "deepseek";
    const baseVal = document.getElementById("modelBaseUrl")?.value.trim() || "";
    const keyVal = document.getElementById("modelApiKey")?.value.trim() || "";
    let finalModel = modelSelect?.value || PROVIDERS[currentProvider].defaultModel;
    if (finalModel === "custom") {
      finalModel = customInput?.value.trim() || "";
    }

    let succeeded = false; // 标记是否成功，控制 finally 的行为

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseVal, apiKey: keyVal, model: finalModel })
      });

      if (!response.ok) throw new Error("连接测试接口请求失败");
      const data = await response.json();

      if (data && data.ok) {
        succeeded = true;
        // 成功：显示绿色反馈，2秒后自行恢复（不依赖 finally）
        btn.textContent = "✓ 连接正常";
        btn.style.background = "rgba(23, 107, 84, 0.12)";
        btn.style.borderColor = "rgba(23, 107, 84, 0.5)";
        btn.disabled = false;
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = "";
          btn.style.borderColor = "";
        }, 2000);

        const statusBadge = document.getElementById("modelConfigStatus");
        if (statusBadge) {
          statusBadge.textContent = `✓ 连接正常`;
          statusBadge.className = "mc-status-badge success";
        }
      } else {
        throw new Error(data.message || "未知原因连接失败");
      }
    } catch (err) {
      alert(`❌ 大模型连接测试失败\n\n具体原因：${err.message || err}\n\n诊断建议：请检查当前供应商 [${PROVIDERS[currentProvider].name}] 的配置项。\n1. 请检查您的 API Key 是否正确填写；\n2. 检查网络代理；\n3. 检查选中的模型 [${finalModel}] 是否被该端点支持。`);
      const statusBadge = document.getElementById("modelConfigStatus");
      if (statusBadge) {
        statusBadge.textContent = `✗ 连接失败`;
        statusBadge.className = "mc-status-badge error";
      }
    } finally {
      // 只有失败时才在 finally 恢复按钮（成功时已在 try 块内处理）
      if (!succeeded) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (typeof logout === "function") logout();
  });
}

const ModelConfigManager = {
  get() {
    const cfg = readModelConfig();
    const activeProvider = cfg.provider || "deepseek";
    const pData = (cfg.providers && cfg.providers[activeProvider]) ? cfg.providers[activeProvider] : {};
    return {
      provider: activeProvider,
      apiKey: pData.apiKey || cfg.apiKey || "",
      baseUrl: pData.baseUrl || cfg.baseUrl || "",
      model: pData.model || cfg.model || ""
    };
  },
  hasValidKey() {
    const cfg = readModelConfig();
    const currentProvider = cfg.provider || "deepseek";
    if (currentProvider === "ollama") return true;
    const pData = cfg.providers[currentProvider] || {};
    const key = pData.apiKey || "";
    return Boolean(key && !key.startsWith("sk-your") && !key.includes("your-api-key"));
  },
  read() {
    return readModelConfig();
  },
  write(cfg) {
    writeModelConfig(cfg);
  }
};
window.ModelConfigManager = ModelConfigManager;

function getActiveModelConfig() {
  return ModelConfigManager.get();
}
window.getActiveModelConfig = getActiveModelConfig;

document.addEventListener("DOMContentLoaded", initModelConfigUi);

