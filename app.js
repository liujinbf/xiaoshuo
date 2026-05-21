// ⚠️ 本文件已超过建议行数，请在下次功能迭代时拆分
// ============================================================
// 主入口: app.js — 事件监听与初始化 (健壮版 v3)
// 警告：禁止在此写业务逻辑，应抄取到对应模块
// ============================================================

// 辅助函数：安全地绑定事件
function safeListen(selector, event, handler) {
  const el = document.querySelector(selector);
  if (el) {
    el.addEventListener(event, handler);
    return el;
  }
  return null;
}

// 初始化所有事件
document.addEventListener("DOMContentLoaded", () => {
  console.log("SaaS Workspace Initializing...");

  // 1. 核心表单提交 (生成方案)
  safeListen("#storyForm", "submit", async (event) => {
    event.preventDefault();
    if (typeof consumeQuota === "function" && !consumeQuota("ideas")) return;
    if (typeof renderPlan === "function") {
      const input = collectInput();
      if (typeof window.matchKnowledgeForInput === "function") {
        input.matchedInspirations = await window.matchKnowledgeForInput(input);
      }
      renderPlan(input);
    }
  });

  // AI 深度故事方案生成
  safeListen("#aiPlanBtn", "click", async () => {
    if (typeof window.requestAiPlan === "function") {
      await window.requestAiPlan();
    }
  });

  // 2. 滑块联动
  const lIn = document.querySelector("#length");
  const lOut = document.querySelector("#lengthOutput");
  if (lIn && lOut) {
    lIn.addEventListener("input", () => { lOut.textContent = lIn.value + " 字"; });
  }

  const iIn = document.querySelector("#intensity");
  const iOut = document.querySelector("#intensityOutput");
  if (iIn && iOut) {
    iIn.addEventListener("input", () => { iOut.textContent = iIn.value + " / 10"; });
  }

  // 3. 标签云
  safeListen("#tagCloud", "click", (event) => {
    const button = event.target.closest(".tag");
    if (!button) return;
    button.classList.toggle("active");
  });

  // 4. 动态更新题材预设与标签云（业务逻辑在 planner.js 中）

  // 题材下拉切换监听
  const genreSelect = document.querySelector("#genre");
  if (genreSelect) {
    genreSelect.addEventListener("change", (e) => {
      updateGenrePresets(e.target.value, true);
    });
  }

  // 随机灵感
  safeListen("#randomBtn", "click", () => {
    if (typeof consumeQuota === "function" && !consumeQuota("ideas")) return;
    const genreSelect = document.querySelector("#genre");
    if (genreSelect) {
      // 随机选择一个题材
      const randIdx = Math.floor(Math.random() * genreSelect.options.length);
      genreSelect.selectedIndex = randIdx;
      // 触发更新
      updateGenrePresets(genreSelect.value, true);
    }
    if (typeof renderPlan === "function") renderPlan(collectInput());
  });

  // 5. 导出 TXT
  safeListen("#exportBtn", "click", () => {
    const plan = window.currentPlan; // 关键：用 window.currentPlan
    if (!plan) return;
    const content = typeof formatProposalPack === "function"
      ? [
          plan.titles.join("\n"), "",
          "【首段钩子】", plan.hook, "",
          "【故事大纲】", plan.outline.map((item, i) => `${i + 1}. ${item}`).join("\n"), "",
          "【人物与动机】", plan.characters.map(c => `${c.role}｜${c.name}\n${c.motive}`).join("\n\n"), "",
          "【正文试写】", plan.draft.join("\n\n"), "",
          "【AI 续写提示词】", plan.prompt
        ].join("\n")
      : JSON.stringify(plan, null, 2);
    if (typeof downloadText === "function") downloadText("故事方案.txt", content);
  });

  // 6. AI 生成正文
  safeListen("#aiDraftBtn", "click", async () => {
    if (!window.currentPlan) {
      return alert("请先生成故事方案");
    }
    try {
      if (typeof setAiLoading === "function") setAiLoading(true);
      const text = await requestAiGeneration("draft");
      const editor = document.querySelector("#draftEditor");
      if (editor && text) {
        editor.value = text;
        editor.dispatchEvent(new Event("input"));
        // 自动触发一致性检查
        setTimeout(() => {
          document.querySelector("#checkConsistencyBtn")?.click();
        }, 300);
      }
    } catch (e) {
      alert(e.message || "AI 生成失败，请检查模型配置");
    } finally {
      if (typeof setAiLoading === "function") setAiLoading(false);
    }
  });

  // 7. 编辑器实时字数统计
  const editor = document.querySelector("#draftEditor");
  if (editor) {
    editor.addEventListener("input", () => {
      if (typeof syncDraftFromEditor === "function") syncDraftFromEditor();
    });
  }

  // 7.5 主题与备注变动联动常识库检测
  const themeInput = document.querySelector("#theme");
  const notesInput = document.querySelector("#storyNotes");
  function triggerSubjectKnowledgeUpdate() {
    const combined = `${themeInput?.value || ""} ${notesInput?.value || ""}`;
    if (typeof window.refreshSubjectKnowledgeDebounced === "function") {
      window.refreshSubjectKnowledgeDebounced(combined);
    }
  }
  if (themeInput) themeInput.addEventListener("input", triggerSubjectKnowledgeUpdate);
  if (notesInput) notesInput.addEventListener("input", triggerSubjectKnowledgeUpdate);
  window.triggerSubjectKnowledgeUpdate = triggerSubjectKnowledgeUpdate;

  // 8. 检查一致性
  safeListen("#checkConsistencyBtn", "click", () => {
    if (!window.currentPlan) {
      alert("请先生成故事方案，再进行一致性检查");
      return;
    }
    const draftEl = document.querySelector("#draftEditor");
    if (!draftEl || !draftEl.value.trim()) {
      alert("正文为空，请先生成或输入正文");
      return;
    }
    if (typeof checkDraftConsistency === "function" && typeof renderConsistency === "function") {
      const items = checkDraftConsistency(window.currentPlan);
      renderConsistency(items);
      document.querySelector("#consistencyList")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  // 8.5 AI 深度审计
  safeListen("#aiAuditConsistencyBtn", "click", async () => {
    if (!window.currentPlan) {
      alert("请先生成故事方案，再运行 AI 深度审计");
      return;
    }
    const draftEl = document.querySelector("#draftEditor");
    if (!draftEl || !draftEl.value.trim()) {
      alert("正文为空，请先输入或生成正文再进行语义审计");
      return;
    }

    const btn = document.querySelector("#aiAuditConsistencyBtn");
    const container = document.querySelector("#aiAuditReportContainer");
    if (!btn || btn.classList.contains("loading")) return;

    // 校验并消耗配额
    if (typeof consumeQuota === "function" && !consumeQuota("generations")) return;

    const originalText = btn.innerHTML;
    btn.classList.add("loading");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="display:inline-block;width:10px;height:10px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:4px;"></span> 审计中...`;
    
    if (container) {
      container.innerHTML = `
        <div class="ai-audit-report-card" style="opacity: 0.8;">
          <h4 style="color:var(--text-muted);">✨ 智能语义审计中...</h4>
          <div class="ai-audit-report-content" style="color:var(--text-muted);font-style:italic;padding:8px 0;display:flex;align-items:center;gap:6px;">
            <span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid var(--text-muted);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span>
            正在深度审计故事的伏笔、开篇与动机合理性，请稍候...
          </div>
        </div>
      `;
      container.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    try {
      const report = await requestAiGeneration("audit");
      if (container && report) {
        // 过滤转义并高亮加粗样式
        let formattedReport = report
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        container.innerHTML = `
          <div class="ai-audit-report-card">
            <h4>✨ AI 智能深度审计意见</h4>
            <div class="ai-audit-report-content">${formattedReport}</div>
          </div>
        `;
        container.scrollIntoView({ behavior: "smooth", block: "nearest" });

        // 审计成功后，将一键应用按钮显示出来
        const applyBtn = document.querySelector("#applyAiAuditBtn");
        if (applyBtn) {
          applyBtn.style.display = "block";
        }
      }
    } catch (e) {
      alert(e.message || "AI 深度审计失败，请检查模型配置");
      if (container) container.innerHTML = "";
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  // 8.6 一键应用 AI 审计优化 (诊断-自愈闭环)
  safeListen("#applyAiAuditBtn", "click", async () => {
    if (!window.currentPlan) {
      alert("请先生成故事方案");
      return;
    }
    const draftEl = document.querySelector("#draftEditor");
    if (!draftEl || !draftEl.value.trim()) {
      alert("正文为空，无法进行审计优化");
      return;
    }
    const container = document.querySelector("#aiAuditReportContainer");
    const auditText = container ? container.textContent : "";

    const btn = document.querySelector("#applyAiAuditBtn");
    if (!btn || btn.classList.contains("loading")) return;

    // 校验并消耗配额
    if (typeof consumeQuota === "function" && !consumeQuota("generations")) return;

    const originalText = btn.innerHTML;
    btn.classList.add("loading");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="display:inline-block;width:10px;height:10px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:4px;"></span> 深度重构优化中...`;

    try {
      const text = await requestAiGeneration("apply_audit", auditText);
      if (text && draftEl) {
        draftEl.value = text;
        draftEl.dispatchEvent(new Event("input"));
        btn.style.display = "none"; // 成功后隐藏自身

        // 自动触发一致性检查
        setTimeout(() => {
          document.querySelector("#checkConsistencyBtn")?.click();
        }, 300);
      }
    } catch (e) {
      alert(e.message || "AI 审计优化应用失败，请检查模型配置");
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  // 9. 版本对比
  safeListen("#diffVersionBtn", "click", () => {
    const viewer = document.querySelector("#diffViewer");
    const editorEl = document.querySelector("#draftEditor");
    const plan = window.currentPlan;
    if (!viewer || !editorEl || !plan) return;

    if (viewer.hidden) {
      const currentText = editorEl.value;
      const originalText = Array.isArray(plan.draft) ? plan.draft.join("\n\n") : (plan.draft || "");
      
      viewer.innerHTML = `
        <div class="diff-header" style="padding: 8px; background: var(--bg-app); border-bottom: 1px solid var(--border); font-size: 12px; margin-bottom: 12px; display: flex; justify-content: space-between;">
          <span>对比基准：上次保存/生成的版本</span>
          <span style="color: var(--text-muted);">红色删除，绿色新增</span>
        </div>
        ${generateDiffHtml(originalText, currentText)}
      `;
      viewer.hidden = false;
      editorEl.hidden = true;
      document.querySelector("#diffVersionBtn").textContent = "退出对比";
    } else {
      viewer.hidden = true;
      editorEl.hidden = false;
      document.querySelector("#diffVersionBtn").textContent = "版本对比";
    }
  });

  // 10. 保存项目
  safeListen("#saveProjectBtn", "click", () => {
    if (typeof consumeQuota === "function" && !consumeQuota("saves")) return;
    if (typeof saveCurrentProject === "function") saveCurrentProject();
  });

  // 转入连载铸造
  safeListen("#importToSerialBtn", "click", () => {
    const plan = window.currentPlan;
    if (!plan) return;
    
    // 切换到连载铸造 tab
    const tabSerial = document.querySelector("#tabSerial");
    if (tabSerial) tabSerial.click();
    
    // 填充表单
    const titleEl = document.querySelector("#serialTitle");
    const genreEl = document.querySelector("#serialGenre");
    const outlineEl = document.querySelector("#serialOutline");
    const charactersEl = document.querySelector("#serialCharacters");
    
    if (titleEl && plan.titles && plan.titles.length > 0) {
      titleEl.value = plan.titles[0];
    }
    
    // 尽量匹配原表单的类型，如果不匹配保留原值
    const shortGenre = document.querySelector("#genre")?.value;
    if (genreEl && shortGenre) {
      const options = Array.from(genreEl.options).map(o => o.value);
      if (options.includes(shortGenre)) {
        genreEl.value = shortGenre;
      }
    }
    
    if (outlineEl && plan.outline) {
      outlineEl.value = plan.outline.join("\n");
    }
    
    if (charactersEl && plan.characters) {
      charactersEl.value = plan.characters.map(c => `【${c.role}】${c.name}\n动机：${c.motive}`).join("\n\n");
    }
    
    // 滚动到创建表单
    setTimeout(() => {
      document.querySelector(".serial-creator")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  });


  // 10.5 真实的设置按钮：平滑直达模型配置与展开
  safeListen("#settingsBtn", "click", () => {
    const details = document.querySelector(".model-advanced");
    if (details) {
      details.open = true;
    }
    const modelPanel = document.querySelector(".desktop-model-enhanced");
    if (modelPanel) {
      modelPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      modelPanel.style.transition = "box-shadow 0.4s ease, border-color 0.4s ease, transform 0.4s ease";
      modelPanel.style.boxShadow = "0 0 20px rgba(23, 107, 84, 0.45)";
      modelPanel.style.borderColor = "var(--du-green)";
      modelPanel.style.transform = "scale(1.015)";
      setTimeout(() => {
        modelPanel.style.boxShadow = "";
        modelPanel.style.borderColor = "";
        modelPanel.style.transform = "";
      }, 1200);
    }
  });

  // 11. 支付相关
  safeListen("#quotaUpgradeBtn", "click", () => {
    if (typeof openBillingModal === "function") openBillingModal();
  });
  safeListen("#closeBillingBtn", "click", () => {
    if (typeof closeBillingModal === "function") closeBillingModal();
  });
  safeListen("#billingModal", "click", (event) => {
    if (event.target.id === "billingModal" && typeof closeBillingModal === "function") {
      closeBillingModal();
    }
  });
  safeListen("#trialBtn", "click", () => {
    if (typeof startTrial === "function") startTrial();
  });
  safeListen("#trialModalBtn", "click", () => {
    if (typeof startTrial === "function") startTrial();
  });
  document.querySelectorAll("[data-plan-order]").forEach((button) => {
    button.addEventListener("click", () => {
      if (typeof createOrder !== "function") return;
      createOrder(button.dataset.planOrder);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && typeof closeBillingModal === "function") {
      closeBillingModal();
    }
  });

  // 12. 初始渲染
  const initialGenre = document.querySelector("#genre")?.value || "history";
  updateGenrePresets(initialGenre, false); // 仅加载标签，不覆盖初始输入框文字
  if (typeof renderBilling === "function") renderBilling();
  if (typeof renderHistory === "function") renderHistory();
  if (typeof window.syncProjectChrome === "function") window.syncProjectChrome(window.currentPlan);
  if (typeof window.triggerSubjectKnowledgeUpdate === "function") {
    window.triggerSubjectKnowledgeUpdate();
  }

  safeListen("#historyList", "click", (event) => {
    const item = event.target.closest("[data-project-id]");
    if (!item || typeof loadProject !== "function") return;
    loadProject(item.dataset.projectId);
  });

  // 13. 清空生成状态
  safeListen("#clearGenStatusBtn", "click", () => {
    const ids = ["genStatusVal", "genStartTime", "genWordCount", "genKnowledgeUsed", "genElapsed"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = id === "genStatusVal" ? "空闲" : "--";
    });
  });

  // 14. 复制提案包
  safeListen("#copyProposalBtn", "click", function () {
    if (typeof window.copyCurrentProposal === "function") {
      window.copyCurrentProposal();
    }
    this.textContent = "已复制";
    setTimeout(() => { this.textContent = "复制提案包"; }, 2000);
  });

  // 15. 登录弹窗按鈕绑定
  safeListen("#authLoginBtn", "click", () => {
    const u = document.getElementById("authUsername")?.value;
    const p = document.getElementById("authPassword")?.value;
    if (typeof handleLogin === "function") handleLogin(u, p);
  });
  safeListen("#authRegisterBtn", "click", () => {
    const u = document.getElementById("authUsername")?.value;
    const p = document.getElementById("authPassword")?.value;
    if (typeof handleRegister === "function") handleRegister(u, p);
  });
  safeListen("#authLocalModeBtn", "click", () => {
    if (typeof hideLoginModal === "function") hideLoginModal();
  });

  console.log("SaaS Workspace Ready ✓");
});
