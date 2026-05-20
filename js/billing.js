// ============================================================
// 模块: billing.js — 会员配额、订单、试用逻辑
// 依赖: constants.js (BILLING_KEY, QUOTA_LIMITS)
// ============================================================

function todayKey() {
  return new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function defaultBillingState() {
  return {
    tier: "free",
    day: todayKey(),
    usage: { ideas: 0, saves: 0, ai: 0 },
    trialEndsAt: "",
    orders: []
  };
}

function readBilling() {
  let state;
  try {
    state = JSON.parse(localStorage.getItem(BILLING_KEY) || "null") || defaultBillingState();
  } catch {
    state = defaultBillingState();
  }

  state.usage = { ideas: 0, saves: 0, ai: 0, ...(state.usage || {}) };
  state.orders = Array.isArray(state.orders) ? state.orders : [];
  if (state.day !== todayKey()) {
    state.day = todayKey();
    state.usage = { ideas: 0, saves: 0, ai: 0 };
  }
  if (state.tier === "trial" && state.trialEndsAt && new Date(state.trialEndsAt) < new Date()) {
    state.tier = "free";
    state.trialEndsAt = "";
  }
  // 增加 Pro 过期检查
  if (state.tier === "pro" && state.proEndsAt && new Date(state.proEndsAt) < new Date()) {
    state.tier = "free";
  }

  localStorage.setItem(BILLING_KEY, JSON.stringify(state));
  return state;
}

function writeBilling(state) {
  localStorage.setItem(BILLING_KEY, JSON.stringify(state));
}

function effectiveTier(state = readBilling()) {
  return state.tier === "pro" || state.tier === "trial" ? "pro" : "free";
}

function planName(state = readBilling()) {
  if (state.tier === "trial") return "Pro 试用";
  if (state.tier === "pro") return "Creator Pro";
  return "Free";
}

function quotaRemaining(kind, state = readBilling()) {
  const tier = effectiveTier(state);
  const limit = QUOTA_LIMITS[tier][kind];
  return Math.max(0, limit - (state.usage[kind] || 0));
}

function hasQuota(kind, state = readBilling()) {
  return quotaRemaining(kind, state) > 0;
}

function showBillingNotice(message) {
  const noticeEl = document.getElementById("billingNotice");
  if (!noticeEl) return;
  noticeEl.textContent = message;
  if (!message) return;
  setTimeout(() => {
    if (noticeEl.textContent === message) noticeEl.textContent = "";
  }, 2200);
}

function updateAiButtonState() {
  const button = document.getElementById("aiDraftBtn");
  if (!button) return;
  if (!apiState.checked) {
    button.disabled = true;
    return;
  }
  const canGenerate = apiState.ready || hasClientModelConfig();
  button.disabled = !canGenerate || !hasQuota("ai");
}

function renderBilling() {
  const state = readBilling();
  const tier = effectiveTier(state);
  const limits = QUOTA_LIMITS[tier];
  const badgeEl = document.getElementById("planBadge");
  const quotaEl = document.getElementById("quotaList");
  if (!badgeEl || !quotaEl) return;
  badgeEl.textContent = planName(state);
  badgeEl.classList.toggle("pro", tier === "pro");
  quotaEl.innerHTML = Object.keys(QUOTA_LABELS)
    .map((kind) => {
      const used = state.usage[kind] || 0;
      const limit = limits[kind];
      const remaining = Math.max(0, limit - used);
      const percent = limit <= 0 ? 0 : Math.min(100, (used / limit) * 100);
      return `
        <div class="quota-row">
          <div class="quota-meta"><span>${QUOTA_LABELS[kind]}</span><span>${remaining}/${limit}</span></div>
          <div class="quota-bar"><span style="width:${percent}%"></span></div>
        </div>
      `;
    })
    .join("");

  // 根据当前会员状态，智能自适应试用和升级按钮
  const trialBtn = document.getElementById("trialBtn");
  const quotaUpgradeBtn = document.getElementById("quotaUpgradeBtn");
  if (trialBtn) {
    if (tier === "pro" || tier === "trial") {
      trialBtn.style.display = "none";
    } else {
      trialBtn.style.display = "inline-flex";
    }
  }
  if (quotaUpgradeBtn) {
    const spanText = quotaUpgradeBtn.querySelector("span");
    if (spanText) {
      spanText.textContent = tier === "pro" ? "续费 Pro 会员" : "升级 Pro 会员";
    }
  }

  updateAiButtonState();
}

function consumeQuota(kind) {
  const state = readBilling();
  if (!hasQuota(kind, state)) {
    showBillingNotice(`${QUOTA_LABELS[kind]}额度已用完`);
    openBillingModal();
    return false;
  }
  state.usage[kind] = (state.usage[kind] || 0) + 1;
  writeBilling(state);
  renderBilling();
  return true;
}

async function openBillingModal() {
  const modal = document.getElementById("billingModal");
  if (modal) modal.hidden = false;
  
  // 动态拉取支付配置
  try {
    const res = await fetch("/api/pay/config");
    const data = await res.json();
    if (data.ok && data.plans) {
      renderPlanPrices(data.plans);
    }
    const container = document.getElementById("paymentMethodsRadios");
    if (!container) return;
    if (data.ok && data.methods.length > 0) {
      container.innerHTML = data.methods.map((m, idx) => `
        <label class="pay-method-chip ${idx === 0 ? 'selected' : ''}" onclick="selectPayChip(this)">
          <input type="radio" name="paymentMethod" value="${m.id}" ${idx === 0 ? "checked" : ""}>
          <span>${m.icon}</span>
          <span>${m.name}</span>
        </label>
      `).join("");
    } else {
      container.innerHTML = `<div class="order-error">后台尚未配置可用支付方式。</div>`;
    }
  } catch (e) {
    console.error("无法加载支付配置", e);
  }
}

function selectPayChip(el) {
  document.querySelectorAll(".pay-method-chip").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  const radio = el.querySelector("input[type=radio]");
  if (radio) radio.checked = true;
}

function closeBillingModal() {
  const modal = document.getElementById("billingModal");
  if (modal) modal.hidden = true;
  if (typeof orderPoller !== "undefined") orderPoller.stop();
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function renderPlanPrices(plans = {}) {
  const monthly = plans.monthly || { amount: 29 };
  const yearly = plans.yearly || { amount: 199 };
  const monthlyAmount = Number(monthly.amount) || 29;
  const yearlyAmount = Number(yearly.amount) || 199;
  const monthlyNum = document.querySelector('[data-plan="monthly"] .price-num');
  const yearlyNum = document.querySelector('[data-plan="yearly"] .price-num');
  const saveEl = document.querySelector('[data-plan="yearly"] .price-save');
  if (monthlyNum) monthlyNum.textContent = formatMoney(monthlyAmount);
  if (yearlyNum) yearlyNum.textContent = formatMoney(yearlyAmount);
  if (saveEl) {
    const equivalent = yearlyAmount / 12;
    const saved = Math.max(0, monthlyAmount * 12 - yearlyAmount);
    saveEl.textContent = `相当于 ¥${formatMoney(equivalent)}/月，省 ¥${formatMoney(saved)}`;
  }
}

window.openBillingModal = openBillingModal;
window.closeBillingModal = closeBillingModal;
window.startTrial = startTrial;
window.createOrder = createOrder;
window.selectPayChip = selectPayChip;

function startTrial() {
  const state = readBilling();
  state.tier = "trial";
  state.trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  writeBilling(state);
  renderBilling();
  closeBillingModal();
  showBillingNotice("7 天试用已开启！");
}

async function createOrder(plan, method = "") {
  const orderDraftEl = document.getElementById("orderDraft");
  if (!orderDraftEl) return;
  const selectedMethod = method || document.querySelector('input[name="paymentMethod"]:checked')?.value || "";
  if (!selectedMethod) {
    orderDraftEl.innerHTML = `<div class="order-error">暂无可用支付方式。</div>`;
    return;
  }

  orderDraftEl.innerHTML = `<div class="order-loading">正在生成支付链接...</div>`;
  
  try {
    const res = await fetch("/api/pay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, method: selectedMethod })
    });
    const data = await res.json();
    
    if (data.ok) {
      const order = data.order;
      const payData = data.payData;
      
      if (payData.type === "url") {
        orderDraftEl.innerHTML = `
          <div class="order-result-inner">
            <div class="order-result-row"><span>订单编号</span><span class="order-id">${order.id}</span></div>
            <div class="order-result-row"><span>实付金额</span><strong style="color:#f87171;">¥${order.amount}</strong></div>
          </div>
          <a href="${payData.url}" target="_blank" class="order-pay-btn">立即前往支付 →</a>
        `;
      } else if (payData.type === "qrcode") {
        orderDraftEl.innerHTML = `
          <div class="order-result-inner">
            <div class="order-result-row"><span>订单编号</span><span class="order-id">${order.id}</span></div>
            <div class="order-result-row"><span>实付金额</span><strong style="color:#f87171;">¥${order.amount}</strong></div>
          </div>
          <div class="order-qr-wrap">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payData.url)}" />
            <div class="order-qr-tip">使用微信扫码支付</div>
          </div>
        `;
      }
      startOrderPolling(order.id);
    } else {
      orderDraftEl.innerHTML = `<div class="order-error">❌ 失败：${data.message}</div>`;
    }
  } catch (e) {
    orderDraftEl.innerHTML = `<div class="order-error">❌ 网络错误。</div>`;
  }
}

const orderPoller = (() => {
  let pollingInterval = null;

  return {
    start: (orderId) => {
      if (pollingInterval) clearInterval(pollingInterval);
      let attempts = 0;
      pollingInterval = setInterval(async () => {
        attempts++;
        if (attempts > 60) { clearInterval(pollingInterval); return; }
        try {
          if (typeof pullFromBackend === "function") {
            await pullFromBackend();
            if (readBilling().tier === "pro") {
              clearInterval(pollingInterval);
              closeBillingModal();
              showBillingNotice("✅ 支付成功！已升级为 Pro。");
            }
          }
        } catch (e) {}
      }, 5000);
    },
    stop: () => {
      if (pollingInterval) clearInterval(pollingInterval);
    }
  };
})();

function startOrderPolling(orderId) {
  orderPoller.start(orderId);
}

// ── 初始化：处理支付返回与状态自检 ──
async function initBilling() {
  renderBilling();
  
  // 检测 URL 参数是否包含支付成功信号 (针对易支付 return_url)
  const url = new URL(window.location.href);
  const status = url.searchParams.get("trade_status");
  
  if (status === "TRADE_SUCCESS") {
    showBillingNotice("正在核对订单状态，请稍候...");
    try {
      // 先主动请求后端校验（兜底本地环境无法接收 Notify 的情况）
      const params = Object.fromEntries(url.searchParams.entries());
      await fetch("/api/pay/verify-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });

      if (typeof pullFromBackend === "function") {
        await pullFromBackend();
        const state = readBilling();
        if (state.tier === "pro") {
          showBillingNotice("✅ 支付成功！已升级为 Pro。");
        } else {
          showBillingNotice("订单确认中，请刷新页面或稍后再试。");
        }
      }
    } catch (e) {}
    
    // 清理 URL 参数
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

// 自动初始化
document.addEventListener("DOMContentLoaded", initBilling);
