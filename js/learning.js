// ============================================================
// 模块: learning.js — 爆款拆解学习器前端交互与反编译终端
// ============================================================

window.currentDissected = null;

// ══ 高颜值 Toast 消息提醒 ══
function showToast(message, type = "success") {
  let container = document.querySelector(".lp-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "lp-toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `lp-toast lp-toast-${type}`;
  
  const icon = document.createElement("span");
  icon.className = "lp-toast-icon";
  icon.textContent = type === "success" ? "✓" : "⚠";
  
  const text = document.createElement("span");
  text.className = "lp-toast-text";
  text.textContent = message;
  
  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);
  
  // 触发渐入动画
  setTimeout(() => {
    toast.classList.add("lp-toast-show");
  }, 10);
  
  // 自动关闭
  setTimeout(() => {
    toast.classList.remove("lp-toast-show");
    toast.classList.add("lp-toast-fade");
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 350);
  }, 4000);
}

window.showToast = showToast;

// 覆盖原生 alert，通过全局 window 代理，让所有解耦模块的 alert(msg) 都能调用高颜值的 Toast
window.alert = (msg) => {
  showToast(msg, /失败|错误|异常|少|空|请/.test(msg) ? "error" : "success");
};

// 🧬 智能识别字节集是否为 UTF-8 编码，防止 Windows 中文 TXT (GBK/GB2312) 导入乱码
function isUtf8Bytes(bytes) {
  let i = 0;
  const len = Math.min(bytes.length, 50000); // 截断前 50KB 做特征判定，大幅降低大文件耗时
  while (i < len) {
    if (bytes[i] <= 0x7F) { // 0xxxxxxx (ASCII)
      i += 1;
    } else if ((bytes[i] & 0xE0) === 0xC0) { // 110xxxxx 10xxxxxx
      if (i + 1 >= len || (bytes[i + 1] & 0xC0) !== 0x80) return false;
      i += 2;
    } else if ((bytes[i] & 0xF0) === 0xE0) { // 1110xxxx 10xxxxxx 10xxxxxx
      if (i + 2 >= len || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) return false;
      i += 3;
    } else if ((bytes[i] & 0xF8) === 0xF0) { // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (i + 3 >= len || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) return false;
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}

// 自动识别编码并将 ArrayBuffer 转换为文本，增加超大文件保护与切片截断
function autoDecodeText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const encoding = isUtf8Bytes(bytes) ? "utf-8" : "gbk";
  
  // 限制前 60000 字节以防超大文件导致解码卡死
  const isTruncated = bytes.length > 60000;
  const sliceBytes = isTruncated ? bytes.subarray(0, 60000) : bytes;
  
  let decoded = "";
  try {
    decoded = new TextDecoder(encoding).decode(sliceBytes);
  } catch (e) {
    decoded = new TextDecoder("utf-8").decode(sliceBytes);
  }
  
  // 截取前 1.8 万字，留存开篇黄金基调
  if (decoded.length > 18000) {
    return {
      text: decoded.slice(0, 18000),
      truncated: true
    };
  }
  return {
    text: decoded,
    truncated: isTruncated
  };
}

// 初始化爆款拆解模块相关的事件绑定
function initLearningEvents() {
  document.querySelector("#startLearnBtn")?.addEventListener("click", handleStartDissect);
  
  // 保存到灵感库按钮绑定学习库里的方法 handleSaveInspiration
  document.querySelector("#saveInspirationBtn")?.addEventListener("click", () => {
    if (typeof window.handleSaveInspiration === "function") {
      window.handleSaveInspiration();
    } else if (typeof handleSaveInspiration === "function") {
      handleSaveInspiration();
    }
  });

  const importEl = document.querySelector("#learnImportTxt");
  if (importEl) {
    importEl.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const textarea = document.querySelector("#learnRawText");
        if (textarea) {
          const decodeResult = autoDecodeText(loadEvent.target.result);
          textarea.value = decodeResult.text;
          // 主动分发 input 事件以完美联动字数统计
          textarea.dispatchEvent(new Event("input"));
          
          if (decodeResult.truncated) {
            alert(`已智能截取《${file.name}》开篇前 1.8 万字进行极速拆解，避免上传过慢`);
          } else {
            alert(`成功导入文件：${file.name}（${file.size} 字节，已完成智能字符集解码）`);
          }
        }
      };
      reader.onerror = () => {
        alert("读取文件失败，请确保文件未损坏。");
      };
      reader.readAsArrayBuffer(file);
      importEl.value = "";
    });
  }
}

// AI 网文基因反编译与拆解执行逻辑
async function handleStartDissect() {
  const btn = document.querySelector("#startLearnBtn");
  let rawText = document.querySelector("#learnRawText")?.value.trim() || "";
  const genre = document.querySelector("#learnGenre")?.value || "auto";

  if (!rawText) {
    alert("请粘贴爆款文章原文。");
    return;
  }

  if (rawText.length < 200) {
    alert("粘贴内容过少，建议提供至少 200 字以上的内容以供 AI 准确拆解。");
    return;
  }

  // 🛡️ 粘贴保护：限制发送至后端的原文上限为 1.8 万字，防止请求体过大 (413 Payload Too Large)
  if (rawText.length > 18000) {
    rawText = rawText.slice(0, 18000);
    showToast("检测到文本过长，已自动截取前 1.8 万字（开篇黄金段落）进行极速基因拆解", "success");
    const textarea = document.querySelector("#learnRawText");
    if (textarea) {
      textarea.value = rawText;
      textarea.dispatchEvent(new Event("input"));
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "AI 正在深度阅读与拆解中...";
  }

  // 获取各种状态面板
  const emptyEl = document.querySelector("#learnEmptyState");
  const loadingEl = document.querySelector("#learnLoadingState");
  const resultEl = document.querySelector("#learnResultArea");
  
  if (resultEl) resultEl.classList.add("lp-hide");
  if (emptyEl) emptyEl.classList.add("lp-hide");
  if (loadingEl) loadingEl.classList.remove("lp-hide");

  // 1. 初始化 4 大反编译核心步骤
  const steps = [
    { id: 1, text: "🔍 智能小说题材识别与冗余广告噪音过滤", status: "pending" },
    { id: 2, text: "🧬 深度扫描前1.8万字提取开篇黄金钩子公式", status: "pending" },
    { id: 3, text: "📊 测算正文对话比、叙事句式与段落情绪图谱", status: "pending" },
    { id: 4, text: "🤖 基因逆向工程就绪，拼装12项专属写作指纹看板", status: "pending" }
  ];

  const stepsContainer = document.querySelector("#learnLoadingSteps");
  if (stepsContainer) {
    stepsContainer.innerHTML = steps.map(step => `
      <div class="lp-step-item status-pending" id="lpStep-${step.id}">
        <span class="lp-step-icon-box">${step.id}</span>
        <span class="lp-step-text">${step.text}</span>
      </div>
    `).join("");
  }

  // 2. 初始化平滑步进驱动器（Progress Advancer）
  const barEl = document.querySelector("#learnLoadingProgressBar");
  const textEl = document.querySelector("#learnLoadingProgressVal");

  let currentProgress = 0;
  let isApiFinished = false;
  let progressInterval = null;

  const updateStepUI = (id, newStatus) => {
    const el = document.querySelector(`#lpStep-${id}`);
    if (!el) return;
    
    // 清理之前的 class
    el.classList.remove("status-pending", "status-active", "status-success");
    el.classList.add(`status-${newStatus}`);
    
    // 更新图标盒内容
    const iconBox = el.querySelector(".lp-step-icon-box");
    if (iconBox) {
      if (newStatus === "success") {
        iconBox.innerHTML = "✓";
      } else {
        iconBox.innerHTML = id;
      }
    }
  };

  progressInterval = setInterval(() => {
    if (!isApiFinished) {
      // API 未返回时，平滑演进进度：
      if (currentProgress < 25) {
        currentProgress += 1.8;
      } else if (currentProgress < 50) {
        currentProgress += 1.2;
      } else if (currentProgress < 75) {
        currentProgress += 0.8;
      } else if (currentProgress < 85) {
        currentProgress += 0.3;
      } else if (currentProgress < 88) {
        currentProgress += 0.05;
      }
    } else {
      // API 返回响应后，极速冲顶到 100%
      if (currentProgress < 100) {
        currentProgress += 10.0;
        if (currentProgress >= 100) currentProgress = 100;
      }
    }

    // 映射到 UI 进度条与文字
    const displayVal = Math.floor(currentProgress);
    if (barEl) barEl.style.width = `${displayVal}%`;
    if (textEl) textEl.textContent = `${displayVal}%`;

    // 动态亮起/完成相应步骤
    if (currentProgress >= 3 && currentProgress < 25) {
      updateStepUI(1, "active");
    } else if (currentProgress >= 25) {
      updateStepUI(1, "success");
    }

    if (currentProgress >= 25 && currentProgress < 50) {
      updateStepUI(2, "active");
    } else if (currentProgress >= 50) {
      updateStepUI(2, "success");
    }

    if (currentProgress >= 50 && currentProgress < 75) {
      updateStepUI(3, "active");
    } else if (currentProgress >= 75) {
      updateStepUI(3, "success");
    }

    if (currentProgress >= 75 && currentProgress < 100) {
      updateStepUI(4, "active");
    } else if (currentProgress >= 100) {
      updateStepUI(4, "success");
      
      // 当冲顶 100% 后，安全关闭定时器
      clearInterval(progressInterval);
      
      // 给予 350ms 的“全打勾完美瞬间”定格展示，提升动效仪式感与满意度
      setTimeout(() => {
        if (loadingEl) loadingEl.classList.add("lp-hide");
        if (resultEl) resultEl.classList.remove("lp-hide");
      }, 350);
    }
  }, 40);

  try {
    const hasClient = typeof ModelConfigManager !== "undefined" && ModelConfigManager.hasValidKey();
    const clientCfg = typeof ModelConfigManager !== "undefined" ? ModelConfigManager.get() : {};
    const modelConfig = hasClient ? clientCfg : null;

    // 从全局或 learning-db.js 获取 userId 查询函数
    const userIdQueryFn = window.knowledgeUserIdQuery || (typeof knowledgeUserIdQuery === "function" ? knowledgeUserIdQuery : () => "");
    const res = await fetch(`/api/inspirations/dissect${userIdQueryFn()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, genre, modelConfig })
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || "AI 拆解失败，请检查模型配置。");
      throw new Error(data.message || "dissect failed");
    }

    // 智能题材自动归档：使用服务端推断的 detectedGenre
    const finalGenre = data.detectedGenre || (genre === "auto" ? "suspense" : genre);

    window.currentDissected = {
      genre: finalGenre,
      theme: data.theme,
      hook: data.hook,
      outline: data.outline,
      rawText,
      fingerprint: data.fingerprint
    };

    // 1. 基础三要素渲染
    document.querySelector("#learnResultTheme").textContent = data.theme;
    document.querySelector("#learnResultHook").textContent = data.hook;
    document.querySelector("#learnResultOutline").textContent = String(data.outline || "").split(";").join("\n");

    // 2. 智能分类归档标签渲染
    const badgeContainer = document.querySelector("#learnResultGenreBadgeContainer");
    const badgeEl = document.querySelector("#learnResultGenreBadge");
    const labels = window.genreLabels || (typeof genreLabels !== "undefined" ? genreLabels : {});
    if (data.detectedGenre && badgeContainer && badgeEl) {
      badgeEl.textContent = labels[data.detectedGenre] || data.detectedGenre;
      badgeEl.className = `lp-detected-badge lp-badge-${data.detectedGenre}`;
      badgeContainer.style.display = "flex";
    } else if (badgeContainer) {
      badgeContainer.style.display = "none";
    }

    // 3. Premium 基因与指纹图谱诊断渲染
    const fp = data.fingerprint;
    const fpCard = document.querySelector("#learnResultFpCard");
    const quotesCard = document.querySelector("#learnResultQuotesCard");

    if (fp && fpCard && quotesCard) {
      // 3.1 开篇切入节奏 (星级)
      const speed = Math.max(1, Math.min(5, parseInt(fp.openingSpeed || 3)));
      document.querySelector("#learnResultFpSpeed").innerHTML = "★".repeat(speed) + "☆".repeat(5 - speed);

      // 3.2 核心对话占比
      const ratio = Math.max(0, Math.min(100, parseInt(fp.dialogueRatio || 40)));
      document.querySelector("#learnResultFpDialogueBar").style.width = `${ratio}%`;
      document.querySelector("#learnResultFpDialogueVal").textContent = `${ratio}%`;

      // 3.3 核心句式风格
      document.querySelector("#learnResultFpSentence").textContent = fp.sentenceStyle || "短长混合";

      // 3.4 首个冲突发生位置
      document.querySelector("#learnResultFpConflict").textContent = fp.firstConflictAt ? `第 ${fp.firstConflictAt} 句` : "未知";

      // 3.5 叙事视角风格
      document.querySelector("#learnResultFpVoice").textContent = fp.voiceStyle || "第三人称近视角";

      // 3.6 情绪冲突基调
      document.querySelector("#learnResultFpTone").textContent = fp.emotionTone || "克制冷静";

      // 3.7 核心冲突压力
      document.querySelector("#learnResultFpPressure").textContent = fp.pressureType || "生命威胁";

      // 3.8 常见场景类型
      document.querySelector("#learnResultFpScene").textContent = fp.sceneType || "通用场景";

      // 3.9 常用断章技巧
      document.querySelector("#learnResultFpEnding").textContent = fp.endingHook || "悬念留白";

      // 4. 特征词汇胶囊 (uniqueVocab)
      const vocabEl = document.querySelector("#learnResultFpVocab");
      if (vocabEl && Array.isArray(fp.uniqueVocab)) {
        const esc = typeof escapeHtml === "function" ? escapeHtml : (str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        vocabEl.innerHTML = fp.uniqueVocab.map(word => `<span class="lp-vocab-badge">${esc(word)}</span>`).join("");
      }

      // 5. 冲击力金句卡片 (powerPhrases)
      const phrasesEl = document.querySelector("#learnResultFpPhrases");
      if (phrasesEl && Array.isArray(fp.powerPhrases)) {
        const esc = typeof escapeHtml === "function" ? escapeHtml : (str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        phrasesEl.innerHTML = fp.powerPhrases.map(phrase => `
          <div class="lp-phrase-card">
            <span class="lp-phrase-quote-mark">“</span>
            <p class="lp-phrase-text">${esc(phrase)}</p>
          </div>
        `).join("");
      }

      // 6. 原文精彩高光片段 (rawSample)
      const sampleEl = document.querySelector("#learnResultFpSample");
      if (sampleEl) {
        sampleEl.textContent = fp.rawSample || "暂无精彩高光片段。";
      }

      fpCard.style.display = "block";
      quotesCard.style.display = "block";
    } else {
      if (fpCard) fpCard.style.display = "none";
      if (quotesCard) quotesCard.style.display = "none";
    }

    // 设置 API 结束标志，让定时器以 100% 冲顶
    isApiFinished = true;

  } catch (error) {
    console.error(error);
    if (progressInterval) clearInterval(progressInterval);
    
    // 还原面板状态
    if (loadingEl) loadingEl.classList.add("lp-hide");
    if (emptyEl) {
      emptyEl.classList.remove("lp-hide");
      const iconEl = emptyEl.querySelector(".lp-empty-icon");
      const titleEl = emptyEl.querySelector(".lp-empty-title");
      const hintEl = emptyEl.querySelector(".lp-empty-hint");
      if (iconEl) {
        iconEl.textContent = "🧬";
        iconEl.classList.remove("lp-spin");
      }
      if (titleEl) titleEl.textContent = "等待拆解结果";
      if (hintEl) {
        hintEl.textContent = "粘贴爆款原文并点击「让 AI 开始拆解学习」";
      }
    }
    if (resultEl) resultEl.classList.add("lp-hide");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "让 AI 开始拆解学习";
    }
  }
}

// 自动加载灵感库列表
function triggerLoadKnowledgeList() {
  if (typeof window.loadKnowledgeList === "function") {
    window.loadKnowledgeList();
  } else if (typeof loadKnowledgeList === "function") {
    loadKnowledgeList();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initLearningEvents();
  triggerLoadKnowledgeList();
  if (typeof loadSubjectKnowledgeFullList === "function") loadSubjectKnowledgeFullList();
  if (typeof initSubjectKnowledgeExpandEvents === "function") initSubjectKnowledgeExpandEvents();

  // ── 字数统计联动 ──
  const rawEl = document.getElementById("learnRawText");
  const countEl = document.getElementById("learnCharCount");
  if (rawEl && countEl) {
    const syncCount = () => { countEl.textContent = rawEl.value.replace(/\s/g, "").length; };
    rawEl.addEventListener("input", syncCount);
    syncCount();
  }

  // ── 文件导入名称显示 ──
  const importEl2 = document.getElementById("learnImportTxt");
  const importLabel = document.getElementById("learnImportLabel");
  const fileZone = document.querySelector(".lp-file-zone");
  if (importEl2 && importLabel) {
    importEl2.addEventListener("change", () => {
      const file = importEl2.files[0];
      if (file) {
        importLabel.textContent = `✓ ${file.name}`;
        if (fileZone) fileZone.classList.add("has-file");
      } else {
        importLabel.textContent = "选择文件 / 拖放至此";
        if (fileZone) fileZone.classList.remove("has-file");
      }
    });
  }

  // ── 结果区：初始隐藏 ──
  const resultArea = document.getElementById("learnResultArea");
  if (resultArea) resultArea.classList.add("lp-hide");
});
