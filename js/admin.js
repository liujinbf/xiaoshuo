// js/admin.js — 管理员后台控制逻辑

const authToken = localStorage.getItem("auth_token");
const authUser = JSON.parse(localStorage.getItem("auth_user") || "null");

window.addEventListener("DOMContentLoaded", async () => {
  if (!authToken) {
    alert("请先在主页登录管理员账号");
    window.location.href = "/";
    return;
  }

  // 填充侧边栏用户信息
  if (authUser) {
    const usernameEl = document.getElementById("sidebarUsername");
    const avatarEl = document.getElementById("userAvatar");
    if (usernameEl) usernameEl.textContent = authUser.username;
    if (avatarEl) avatarEl.textContent = (authUser.username || "A")[0].toUpperCase();
  }

  // 初始化设置
  await initSettings();

  // Tab 切换逻辑
  document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      btn.classList.add("active");

      document.getElementById("panel-settings").style.display = tab === "settings" ? "block" : "none";
      document.getElementById("panel-orders").style.display = tab === "orders" ? "block" : "none";

      if (tab === "orders") fetchOrders();
    });
  });

  // 保存按钮
  document.getElementById("saveBtn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("saveBtn");
    const statusMsg = document.getElementById("statusMsg");
    saveBtn.disabled = true;
    statusMsg.textContent = "保存中...";

    const epayChannels = [];
    if (document.getElementById("epay_enable_alipay")?.checked) epayChannels.push("alipay");
    if (document.getElementById("epay_enable_wxpay")?.checked) epayChannels.push("wxpay");

    const payConfig = {
      monthly_amount:    document.getElementById("monthly_amount").value.trim() || "29",
      yearly_amount:     document.getElementById("yearly_amount").value.trim() || "199",
      epay_url:           document.getElementById("epay_url").value.trim(),
      epay_pid:           document.getElementById("epay_pid").value.trim(),
      epay_key:           document.getElementById("epay_key").value.trim(),
      epay_channels:      epayChannels,
      wechat_mchid:       document.getElementById("wechat_mchid").value.trim(),
      wechat_key:         document.getElementById("wechat_key").value.trim(),
      alipay_app_id:      document.getElementById("alipay_app_id").value.trim(),
      alipay_private_key: document.getElementById("alipay_private_key").value.trim()
    };

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ payConfig })
      });
      const data = await res.json();
      if (data.ok) {
        statusMsg.style.color = "var(--green)";
        statusMsg.textContent = "✅ 保存成功！客户端配置已同步。";
        setTimeout(() => statusMsg.textContent = "", 3000);
      } else {
        statusMsg.style.color = "#e74c3c";
        statusMsg.textContent = "❌ 保存失败: " + data.message;
      }
    } catch (e) {
      statusMsg.textContent = "❌ 网络错误";
    }
    saveBtn.disabled = false;
  });

  // 退出登录
  document.getElementById("logoutAdminBtn").addEventListener("click", () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/";
  });
});

async function initSettings() {
  try {
    const res = await fetch("/api/admin/settings", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || "无权限访问");
      window.location.href = "/";
      return;
    }

    document.getElementById("adminApp").style.display = "flex";
    const loadingEl = document.getElementById("loadingState");
    if (loadingEl) loadingEl.style.display = "none";
    
    const config = data.payConfig || {};
    document.getElementById("monthly_amount").value = config.monthly_amount || "29";
    document.getElementById("yearly_amount").value = config.yearly_amount || "199";
    document.getElementById("epay_url").value = config.epay_url || "";
    document.getElementById("epay_pid").value = config.epay_pid || "";
    document.getElementById("epay_key").value = config.epay_key || "";
    document.getElementById("wechat_mchid").value = config.wechat_mchid || "";
    document.getElementById("wechat_key").value = config.wechat_key || "";
    document.getElementById("alipay_app_id").value = config.alipay_app_id || "";
    document.getElementById("alipay_private_key").value = config.alipay_private_key || "";
    
    const channels = config.epay_channels || ["alipay"];
    document.getElementById("epay_enable_alipay").checked = channels.includes("alipay");
    document.getElementById("epay_enable_wxpay").checked = channels.includes("wxpay");
    
    if (typeof updateStatus === "function") updateStatus();
  } catch (e) {
    console.error(e);
    window.location.href = "/";
  }
}

async function fetchOrders() {
  const tbody = document.getElementById("orderTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted)">正在拉取订单...</td></tr>`;

  try {
    const res = await fetch("/api/admin/orders", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message);

    if (data.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted)">暂无订单记录</td></tr>`;
      return;
    }

    tbody.innerHTML = data.orders.map(order => {
      const statusClass = order.status === "paid" ? "paid" : "pending";
      const statusText = order.status === "paid" ? "已支付" : "待支付";
      const planText = order.plan === "yearly" ? "年度 Pro" : "月度 Pro";
      const timeStr = new Date(order.createdAt).toLocaleString("zh-CN");
      
      return `
        <tr>
          <td style="font-family:monospace">${order.id}</td>
          <td>
            <div style="font-weight:600">${order.username}</div>
            <div style="font-size:10px; color:var(--text-muted)">ID: ${order.userId}</div>
          </td>
          <td>${planText}</td>
          <td style="color:#f87171; font-weight:600">¥${order.amount}</td>
          <td><span class="status-pill ${statusClass}">${statusText}</span></td>
          <td style="color:var(--text-muted)">${timeStr}</td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#ef4444">拉取失败: ${e.message}</td></tr>`;
  }
}
