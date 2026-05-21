// 全局变量定义
let apiStatus, aiDraftBtn;

function setApiStatus(nextState) {
  if (!apiStatus) {
    apiStatus = document.getElementById("apiStatus");
    aiDraftBtn = document.getElementById("aiDraftBtn");
  }
  if (!apiStatus) return; // 容错处理

  apiState = { ...apiState, ...nextState };
  apiStatus.classList.remove("ready", "offline", "client-ready");

  if (!apiState.checked) {
    apiStatus.textContent = "检测 AI 服务中";
    if (aiDraftBtn) aiDraftBtn.disabled = true;
    return;
  }

  const hasClient = ModelConfigManager.hasValidKey();
  const clientCfg = ModelConfigManager.get();

  if (apiState.ready) {
    apiStatus.textContent = `服务端 AI：${apiState.model}`;
    apiStatus.classList.add("ready");
  } else if (hasClient) {
    apiStatus.textContent = `客户端 AI：${clientCfg.model}`;
    apiStatus.classList.add("client-ready");
  } else {
    apiStatus.textContent = "未配置 API Key";
    apiStatus.classList.add("offline");
  }
  if (typeof renderBilling === "function") {
    renderBilling();
  } else {
    renderAiStatusButtonState();
  }
}

function renderAiStatusButtonState() {
  if (!aiDraftBtn) return;
  // 不再物理禁用按钮，让用户能点，点开后如果没配置再提示
  aiDraftBtn.disabled = false;
  aiDraftBtn.style.opacity = (apiState.ready || ModelConfigManager.hasValidKey()) ? "1" : "0.5";
}

// 启动检测
window.addEventListener("DOMContentLoaded", () => {
  checkApiHealth();
});

async function checkApiHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("服务不可用");
    const data = await response.json();
    setApiStatus({
      checked: true,
      ready: Boolean(data.hasApiKey),
      model: data.model || ""
    });
  } catch {
    setApiStatus({
      checked: true,
      ready: false,
      model: ""
    });
  }
}

let aiProgressTimer = null;

function setAiLoading(isLoading, label = "AI 生成正文") {
  const wrap = document.querySelector(".draft-progress-wrap");
  const fill = document.querySelector("#draftProgressFill");
  
  if (aiDraftBtn) {
    aiDraftBtn.disabled = isLoading || (!apiState.ready && !ModelConfigManager.hasValidKey());
    aiDraftBtn.textContent = isLoading ? "正在思考中..." : label;
  }

  if (isLoading) {
    wrap?.classList.add("loading", "ai-generating");
    if (fill) {
      fill.style.width = "0%";
      // 模拟步进滑行：前段快，后段接近极限时减速悬停，保障极佳等待体验
      let progress = 0;
      clearInterval(aiProgressTimer);
      aiProgressTimer = setInterval(() => {
        if (progress < 40) {
          progress += Math.floor(Math.random() * 6) + 3;
        } else if (progress < 75) {
          progress += Math.floor(Math.random() * 3) + 1;
        } else if (progress < 96) {
          progress += 0.5;
        }
        progress = Math.min(96, progress);
        fill.style.width = progress + "%";
      }, 300);
    }
  } else {
    clearInterval(aiProgressTimer);
    if (fill) {
      fill.style.width = "100%";
      setTimeout(() => {
        wrap?.classList.remove("loading", "ai-generating");
        // 如果没有正文内容，则重置为 0，如果有则保持 100% (代表完成)
        if (!document.querySelector("#draftEditor")?.value) {
            fill.style.width = "0%";
        }
      }, 800);
    }
  }
}

async function requestAiGeneration(mode, direction = "") {
  // 关键：直接引用全局方案
  const plan = window.currentPlan;
  if (!plan) return;
  const hasClient = ModelConfigManager.hasValidKey();
  const clientCfg = ModelConfigManager.get();
  const modelConfig = hasClient ? clientCfg : null;

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: localStorage.getItem(USER_KEY) || "",
      mode,
      direction,
      input: plan.input,
      prompt: plan.prompt,
      existingDraft: getDraftText(),
      modelConfig
    })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "AI 生成失败");
  }
  if (Array.isArray(data.knowledgeUsed)) {
    plan.knowledgeUsed = data.knowledgeUsed;
    const knowledgeEl = document.getElementById("genKnowledgeUsed");
    if (knowledgeEl) {
      knowledgeEl.textContent = data.knowledgeUsed.length
        ? `${data.knowledgeUsed.length} 条素材策略`
        : "未召回";
      knowledgeEl.title = data.knowledgeUsed.map((item) => item.theme).join("\n");
    }
  }
  if (data.text && typeof window.refreshSubjectKnowledgeDebounced === "function") {
    window.refreshSubjectKnowledgeDebounced(data.text);
  }
  return data.text;
}

function splitParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesAny(text, candidates) {
  return candidates.some((candidate) => candidate && text.includes(candidate));
}

function shortToken(value) {
  return compactTheme(String(value || ""));
}

function checkDraftConsistency(plan) {
  const text = getDraftText();
  const paragraphs = getDraftParagraphs();
  const result = [];

  if (!text) {
    return [{ level: "risk", title: "正文为空", detail: "先写入正文，再做一致性检查。" }];
  }

  if (!plan || !plan.input || !plan.hook) {
    return [{ level: "risk", title: "方案未生成", detail: "请先点击「生成方案」，再检查一致性。" }];
  }

  const hookTokens = [
    shortToken(plan.input.theme),
    shortToken(plan.hook),
    ...(Array.isArray(plan.input.tags) ? plan.input.tags : [])
  ];
  result.push({
    level: includesAny(text, hookTokens) ? "ok" : "risk",
    title: "开篇钩子",
    detail: includesAny(text, hookTokens)
      ? "正文已经承接核心矛盾和标签，开局方向成立。"
      : "正文里没有明显出现核心矛盾或标签，建议第一段直接抛出事件。"
  });

  const evidenceHits = plan.evidenceChain.filter((item) => {
    const clue = shortToken(item.clue);
    return text.includes(item.clue) || text.includes(clue);
  });
  result.push({
    level: evidenceHits.length >= Math.min(2, plan.evidenceChain.length) ? "ok" : evidenceHits.length ? "warn" : "risk",
    title: "证据链覆盖",
    detail: `已出现 ${evidenceHits.length}/${plan.evidenceChain.length} 条证据。建议至少让开篇伏笔和误导证据进入正文。`
  });

  const characterHits = plan.characters.filter((item) => {
    const name = shortToken(item.name);
    const role = shortToken(item.role);
    const firstPersonHit = item.role === "主角" && plan.input.viewpoint === "first" && text.includes("我");
    const opponentHit = item.role === "对抗者" && (text.includes("他们") || text.includes("丈夫") || text.includes("对方"));
    return firstPersonHit || opponentHit || text.includes(item.name) || text.includes(name) || text.includes(role);
  });
  result.push({
    level: characterHits.length >= 2 ? "ok" : "warn",
    title: "人物动机",
    detail: characterHits.length >= 2
      ? "主角和对抗力量已经有可感知位置。"
      : "人物关系还不够清楚，建议补一段对抗者施压或关键证人露面。"
  });

  const emotionWords = ["崩溃", "羞辱", "背叛", "害怕", "沉默", "反击", "求我", "代价", "公开", "证据"];
  const emotionCount = emotionWords.filter((word) => text.includes(word)).length;
  result.push({
    level: emotionCount >= 4 ? "ok" : emotionCount >= 2 ? "warn" : "risk",
    title: "情绪推进",
    detail: `检测到 ${emotionCount} 个情绪/冲突词。盐选短篇建议每 600-900 字有一次关系或情绪升级。`
  });

  result.push({
    level: paragraphs.length >= 4 ? "ok" : "warn",
    title: "移动端可读性",
    detail: paragraphs.length >= 4
      ? "段落密度适合移动端阅读。"
      : "段落偏少，建议拆成更短的自然段，增强滑读节奏。"
  });

  const episodeHits = plan.dramaEpisodes.filter((episode) => text.includes(shortToken(episode.title)) || includesAny(text, episode.premise.split(/[，。、“”]/).map(shortToken)));
  result.push({
    level: episodeHits.length >= 2 ? "ok" : "warn",
    title: "短剧节拍",
    detail: `正文已覆盖约 ${episodeHits.length}/${plan.dramaEpisodes.length} 个分集节拍。若要短剧化，优先补“开局受辱、第一反击、公开对峙”。`
  });

  return result;
}

function renderConsistency(items) {
  const container = document.querySelector("#consistencyList");
  if (!container) return;
  container.innerHTML = items
    .map((item) => {
      const levelClass = item.level === "ok" ? "pass" : item.level === "warn" ? "warn" : "risk";
      const statusText = item.level === "ok" ? "通过" : item.level === "warn" ? "待加强" : "风险";
      return `
        <div class="desktop-check-item ${escapeHtml(levelClass)}">
          <div class="desktop-check-row">
            <span>${escapeHtml(item.title)}</span>
            <strong>${escapeHtml(statusText)}</strong>
          </div>
          <div class="desktop-check-detail">${escapeHtml(item.detail)}</div>
        </div>
      `;
    })
    .join("");
}

