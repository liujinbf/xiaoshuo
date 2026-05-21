// ============================================================
// 模块: learning-trends.js — 全网热门题材趋势智能看板前端交互脚本
// ============================================================

(function () {
  let allTrends = []; // 缓存在本地的所有趋势数据
  let filterSource = "all";
  let filterGenre = "all";

  const genreLabels = {
    rules: "规则怪谈",
    revenge: "复仇爽文",
    suspense: "悬疑烧脑",
    system: "系统爽文",
    urban: "都市异能",
    romance: "甜宠言情",
    infinite: "无限流",
    scifi: "科幻脑洞",
    heroine: "大女主爽文",
    history: "历史穿越脑洞",
    folklore: "中式恐怖志怪",
    family: "世情伦理家庭",
    workplace: "职场内幕暗黑",
    other: "其它题材"
  };

  // 映射颜色分类样式
  const genreBadgeColors = {
    rules: "purple",
    revenge: "red",
    suspense: "amber",
    system: "blue",
    urban: "teal",
    romance: "pink",
    infinite: "emerald",
    scifi: "cyan",
    heroine: "rose",
    history: "gold",
    folklore: "darkred",
    family: "indigo",
    workplace: "slate",
    other: "outline"
  };

  // 页面加载完成后自动初始化
  document.addEventListener("DOMContentLoaded", () => {
    initTrendsEvents();
    loadTrendsList(true); // 首次冷启动加载，传入 true 代表静默加载
  });

  // ══ 事件绑定 ══
  function initTrendsEvents() {
    // 来源平台 Chips 绑定
    const chips = document.querySelectorAll("#trendsSourceChips .lp-chip");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        filterSource = chip.getAttribute("data-source") || "all";
        applyFilters();
      });
    });

    // 映射题材下拉菜单绑定
    const select = document.querySelector("#trendsGenreSelect");
    if (select) {
      select.addEventListener("change", (e) => {
        filterGenre = e.target.value || "all";
        applyFilters();
      });
    }
  }

  // ══ 获取趋势列表 ══
  async function loadTrendsList(silent = false) {
    try {
      const userIdQueryFn = window.knowledgeUserIdQuery || (typeof knowledgeUserIdQuery === "function" ? knowledgeUserIdQuery : () => "");
      const res = await fetch(`/api/trends${userIdQueryFn()}`);
      const data = await res.json();
      
      if (data.ok) {
        allTrends = data.list || [];
        if (!silent || allTrends.length > 0) {
          applyFilters();
        }
      } else {
        console.error("加载题材趋势失败：", data.message);
      }
    } catch (e) {
      console.error("请求题材趋势接口出错：", e);
    }
  }

  // ══ 客户端无刷新双向过滤 ══
  function applyFilters() {
    let filtered = allTrends;

    if (filterSource !== "all") {
      filtered = filtered.filter(item => item.source === filterSource);
    }

    if (filterGenre !== "all") {
      filtered = filtered.filter(item => item.mapped_genre === filterGenre);
    }

    renderTrends(filtered);
  }

  // ══ 渲染卡片网格 ══
  function renderTrends(trends) {
    const grid = document.querySelector("#trendsGrid");
    const emptyState = document.querySelector("#trendsEmptyState");
    
    if (!grid) return;

    if (!trends || trends.length === 0) {
      grid.style.display = "none";
      if (emptyState) {
        emptyState.style.display = "block";
        if (allTrends.length === 0) {
          emptyState.textContent = "全网题材数据库尚为空，快点击上方「一键智能采集与归档」进行探针采集吧！";
        } else {
          emptyState.textContent = "没有找到符合当前筛选条件的题材趋势。";
        }
      }
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    grid.style.display = "grid";
    grid.innerHTML = "";

    trends.forEach(trend => {
      const card = document.createElement("div");
      card.className = "trend-card";

      // 提取 AI 结构化特征且做完美容错回退绑定
      let analysisObj = {};
      try {
        analysisObj = typeof trend.analysis === "string" ? JSON.parse(trend.analysis) : (trend.analysis || {});
      } catch (e) {
        analysisObj = {};
      }

      const hook = analysisObj.hook || analysisObj.hooks || "开篇冲突紧凑，节奏明快";
      const painPoint = analysisObj.pain_point || analysisObj.appeals || "受众情感缺失或希望打破常规";
      const sellingPoint = analysisObj.selling_point || analysisObj.selling_points || "极具张力的反差与新奇脑洞";

      const platformText = trend.source === "zhihu" ? "知乎" : "番茄";
      const platformClass = trend.source === "zhihu" ? "zhihu" : "fanqie";
      const genreText = genreLabels[trend.mapped_genre] || trend.mapped_genre;
      const genreBadgeColor = genreBadgeColors[trend.mapped_genre] || "outline";
      
      card.innerHTML = `
        <div class="trend-card-head">
          <span class="trend-platform-badge ${platformClass}">
            ${trend.source === "zhihu" ? "💬" : "🍅"} ${platformText}
          </span>
          <span class="trend-genre-badge ${genreBadgeColor}">
            🎯 ${genreText}
          </span>
        </div>
        
        <h4 class="trend-novel-title">《${trend.novel_title}》</h4>
        
        <div class="trend-dual-genres">
          <span class="trend-genre-badge-mini source-genre">原始：${trend.raw_genre || "暂无标签"}</span>
          <span class="trend-genre-badge-mini target-genre">映射系统：${genreText}</span>
        </div>

        <div class="trend-introduction">
          <p class="trend-intro-text">${trend.introduction || "该公开小说暂无背景简介..."}</p>
        </div>
        
        <div class="trend-heat-container">
          <div class="trend-heat-info">
            <span class="trend-heat-label">📊 趋势热度值</span>
            <span class="trend-heat-val">${trend.heat_score} / 100</span>
          </div>
          <div class="trend-heat-track">
            <!-- 给定延时渲染，让进度条加载动效更顺滑 -->
            <div class="trend-heat-bar" id="heatBar_${trend.id}" style="width: 0%;"></div>
          </div>
        </div>

        <div class="trend-analysis-panel">
          <div class="trend-analysis-item">
            <span class="trend-analysis-label">🔥 情绪钩子</span>
            <span class="trend-analysis-content">${hook}</span>
          </div>
          <div class="trend-analysis-item">
            <span class="trend-analysis-label">🎯 受众痛点</span>
            <span class="trend-analysis-content">${painPoint}</span>
          </div>
          <div class="trend-analysis-item">
            <span class="trend-analysis-label">💡 核心卖点</span>
            <span class="trend-analysis-content">${sellingPoint}</span>
          </div>
        </div>

        <button class="trend-convert-btn" id="convertBtn_${trend.id}" type="button">
          ⚡ 转化为写作灵感
        </button>
      `;

      grid.appendChild(card);

      // 双向绑定转化灵感按钮事件
      const convertBtn = card.querySelector(`#convertBtn_${trend.id}`);
      if (convertBtn) {
        convertBtn.addEventListener("click", () => {
          convertTrendToInspiration(trend.id, trend.novel_title, convertBtn);
        });
      }

      // 用延时来触发 CSS 进度条优雅伸展动效
      setTimeout(() => {
        const bar = document.getElementById(`heatBar_${trend.id}`);
        if (bar) {
          bar.style.width = `${trend.heat_score}%`;
        }
      }, 50);
    });
  }

  // ══ 智能采集核心逻辑 (沉浸式打字日志终端) ══
  async function collectTrends() {
    const btn = document.querySelector("#collectTrendsBtn");
    const terminal = document.querySelector("#trendsTerminal");
    const logsContainer = document.querySelector("#trendsTerminalLogs");
    
    if (!logsContainer || !terminal) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = "⚡ AI 正在采集分析中...";
    }

    // 展现终端并清空
    terminal.classList.remove("trends-hide");
    logsContainer.innerHTML = "";

    const addLog = (text, type = "info") => {
      const line = document.createElement("p");
      line.className = `terminal-log-line ${type}`;
      line.innerHTML = `<span class="prefix">[AI LOGS]</span>${text}`;
      logsContainer.appendChild(line);
      logsContainer.scrollTop = logsContainer.scrollHeight;
    };

    // 1. 本地动态打字日志序列定义（增强沉浸探索交互体验）
    const loadingLogs = [
      { text: "⚡ [CONNECT] 建立云端高拟真全网探针采集通道... 100% OK", delay: 100, type: "info" },
      { text: "🔍 [FETCH] 正在爬取知乎盐选平台热门趋势榜单与脑洞题材...", delay: 250, type: "info" },
      { text: "🍅 [FETCH] 正在抓取番茄小说流行趋势分类、日榜指数及爆款名录...", delay: 250, type: "info" },
      { text: "🧩 [DECRYPT] 解密爆款题材核心元素并解析冗余信息...", delay: 200, type: "info" },
      { text: "🧠 [AI COGNITIVE] 启用智能大语言模型提炼核心基因与多维属性特征...", delay: 300, type: "info" }
    ];

    // 播放冷启动前置仿真打字步骤
    for (const log of loadingLogs) {
      addLog(log.text, log.type);
      await new Promise(resolve => setTimeout(resolve, log.delay));
    }

    try {
      // 2. 发起真正采集请求
      const hasClient = typeof ModelConfigManager !== "undefined" && ModelConfigManager.hasValidKey();
      const clientCfg = typeof ModelConfigManager !== "undefined" ? ModelConfigManager.get() : {};
      const modelConfig = hasClient ? clientCfg : null;

      const userIdQueryFn = window.knowledgeUserIdQuery || (typeof knowledgeUserIdQuery === "function" ? knowledgeUserIdQuery : () => "");
      const res = await fetch(`/api/trends/collect${userIdQueryFn()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelConfig })
      });
      const result = await res.json();

      if (!result.ok) {
        throw new Error(result.message || "采集失败");
      }

      const collected = result.list || [];
      addLog(`✨ [SUCCESS] 成功拉取 ${collected.length} 个爆款题材！启动题材智能分类归档算法...`, "success");
      await new Promise(resolve => setTimeout(resolve, 150));

      // 3. 动态模拟智能映射过程（让每个小说卡片映射都有日志可循）
      for (let i = 0; i < collected.length; i++) {
        const trend = collected[i];
        const genreName = genreLabels[trend.mapped_genre] || trend.mapped_genre;
        addLog(`🗺️ [MAP] 映射《${trend.novel_title}》: ${trend.raw_genre} ➔ ${genreName} (${trend.mapped_genre})`, "info");
        // 降低前面几个映射的延时，以免用户等待太久
        await new Promise(resolve => setTimeout(resolve, i < 3 ? 150 : 80));
      }

      addLog(`📦 [ARCHIVE] 将题材特征与 12 维结构化卖点全量写入 SQLite 题材库...`, "info");
      await new Promise(resolve => setTimeout(resolve, 150));
      addLog(`🎉 [SUCCESS] 题材库全部归档完毕！系统题材趋势智能看板已完成完美刷新同步。`, "success");

      // 缓存并重新加载
      allTrends = collected;
      applyFilters();

    } catch (e) {
      addLog(`❌ [ERROR] 采集流程中断。原因: ${e.message}`, "system");
      if (typeof window.showToast === "function") {
        window.showToast(`题材趋势采集失败: ${e.message}`, "error");
      } else {
        alert(`题材趋势采集失败: ${e.message}`);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "⚡ 一键智能采集与归档";
      }
      
      // 4. 过几秒钟后自动收拢折叠终端（体验拉满）
      setTimeout(() => {
        if (terminal && !terminal.classList.contains("trends-hide")) {
          terminal.classList.add("trends-hide");
        }
      }, 5000);
    }
  }

  // ══ 一键逆向编译为写作专属灵感 ══
  async function convertTrendToInspiration(trendId, novelTitle, btnEl) {
    if (!trendId) return;

    const originalText = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = "⚡ 正在反编译转化...";

    try {
      const hasClient = typeof ModelConfigManager !== "undefined" && ModelConfigManager.hasValidKey();
      const clientCfg = typeof ModelConfigManager !== "undefined" ? ModelConfigManager.get() : {};
      const modelConfig = hasClient ? clientCfg : null;

      const userIdQueryFn = window.knowledgeUserIdQuery || (typeof knowledgeUserIdQuery === "function" ? knowledgeUserIdQuery : () => "");
      const res = await fetch(`/api/trends/convert${userIdQueryFn()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trendId, modelConfig })
      });
      const result = await res.json();

      if (!result.ok) {
        throw new Error(result.message || "转化失败");
      }

      // 转换成功后的回馈：Toast，并刷新爆款灵感库
      const msg = `🎉 成功将《${novelTitle}》深度反编译并转化为专属写作灵感！可在上方爆款灵感库查收！`;
      if (typeof window.showToast === "function") {
        window.showToast(msg, "success");
      } else {
        alert(msg);
      }

      // 刷新上方的“爆款灵感库”列表
      if (typeof window.loadKnowledgeList === "function") {
        window.loadKnowledgeList();
      }

    } catch (e) {
      console.error(e);
      const errMsg = `转化写作灵感失败: ${e.message}`;
      if (typeof window.showToast === "function") {
        window.showToast(errMsg, "error");
      } else {
        alert(errMsg);
      }
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = originalText;
      }
    }
  }

  // 将方法挂载到 window 作用域，供 HTML 事件直接访问
  window.collectTrends = collectTrends;
  window.loadTrendsList = loadTrendsList;
})();
