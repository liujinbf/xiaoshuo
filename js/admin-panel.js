// js/admin-panel.js — 系统管理员后台面板控制逻辑

(function() {
  // 绑定子Tab切换
  document.addEventListener("DOMContentLoaded", () => {
    // 处理 admin-tab 切换
    document.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".admin-tab-btn");
      if (!tabBtn) return;
      
      const tab = tabBtn.dataset.adminTab;
      document.querySelectorAll(".admin-tab-btn").forEach(b => {
        b.classList.toggle("active", b === tabBtn);
      });
      
      // 显示/隐藏子面板
      document.getElementById("adminTabSettings").hidden = tab !== "settings";
      document.getElementById("adminTabOrders").hidden = tab !== "orders";
      
      if (tab === "orders") {
        fetchAdminOrders();
      }
    });

    // 绑定保存按钮
    document.addEventListener("click", async (e) => {
      if (e.target && e.target.id === "admin_saveBtn") {
        await saveAdminSettings();
      }
    });

    // 绑定输入变动监听以更新状态徽章
    const fields = ["admin_epay_url", "admin_wechat_mchid", "admin_alipay_app_id"];
    fields.forEach(id => {
      document.addEventListener("input", (e) => {
        if (e.target && e.target.id === id) {
          updateAdminStatus();
        }
      });
    });

    // 检查是否显示管理员面板入口
    checkAdminAccess();
  });

  // 全局暴露初始化方法
  window.initAdminPanel = async function() {
    await loadAdminSettings();
  };

  function checkAdminAccess() {
    const token = localStorage.getItem("auth_token");
    const user = JSON.parse(localStorage.getItem("auth_user") || "null");
    const railAdminBtn = document.getElementById("railAdminBtn");
    const tabAdmin = document.getElementById("tabAdmin");

    const isAdmin = token && user && (user.role === "admin" || user.username === "admin");
    if (isAdmin) {
      if (railAdminBtn) railAdminBtn.style.display = "flex";
      if (tabAdmin) tabAdmin.style.display = "inline-block";
    } else {
      if (railAdminBtn) railAdminBtn.style.display = "none";
      if (tabAdmin) tabAdmin.style.display = "none";
    }
  }

  // 状态更新徽章
  function updateAdminStatus() {
    const badges = [
      { badge: 'admin_epayStatus', field: 'admin_epay_url' },
      { badge: 'admin_wechatStatus', field: 'admin_wechat_mchid' },
      { badge: 'admin_alipayStatus', field: 'admin_alipay_app_id' },
    ];
    badges.forEach(({ badge, field }) => {
      const el = document.getElementById(badge);
      const val = document.getElementById(field)?.value?.trim();
      if (el) {
        if (val) {
          el.className = 'admin-status-badge enabled';
          el.innerHTML = '<span class="admin-status-dot"></span>已启用';
        } else {
          el.className = 'admin-status-badge disabled';
          el.innerHTML = '<span class="admin-status-dot"></span>未启用';
        }
      }
    });
  }

  // 加载设置
  async function loadAdminSettings() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("加载管理员配置失败:", data.message);
        return;
      }

      const config = data.payConfig || {};
      
      const mAmount = document.getElementById("admin_monthly_amount");
      const yAmount = document.getElementById("admin_yearly_amount");
      const epayUrl = document.getElementById("admin_epay_url");
      const epayPid = document.getElementById("admin_epay_pid");
      const epayKey = document.getElementById("admin_epay_key");
      const epayAlipay = document.getElementById("admin_epay_enable_alipay");
      const epayWxpay = document.getElementById("admin_epay_enable_wxpay");
      const wechatMch = document.getElementById("admin_wechat_mchid");
      const wechatKey = document.getElementById("admin_wechat_key");
      const alipayApp = document.getElementById("admin_alipay_app_id");
      const alipayPriv = document.getElementById("admin_alipay_private_key");

      if (mAmount) mAmount.value = config.monthly_amount || "29";
      if (yAmount) yAmount.value = config.yearly_amount || "199";
      if (epayUrl) epayUrl.value = config.epay_url || "";
      if (epayPid) epayPid.value = config.epay_pid || "";
      if (epayKey) epayKey.value = config.epay_key || "";
      
      const channels = config.epay_channels || ["alipay"];
      if (epayAlipay) epayAlipay.checked = channels.includes("alipay");
      if (epayWxpay) epayWxpay.checked = channels.includes("wxpay");

      if (wechatMch) wechatMch.value = config.wechat_mchid || "";
      if (wechatKey) wechatKey.value = config.wechat_key || "";
      if (alipayApp) alipayApp.value = config.alipay_app_id || "";
      if (alipayPriv) alipayPriv.value = config.alipay_private_key || "";

      updateAdminStatus();
    } catch (e) {
      console.error("网络错误，读取配置失败:", e);
    }
  }

  // 保存设置
  async function saveAdminSettings() {
    const token = localStorage.getItem("auth_token");
    if (!token) return alert("请先登录管理员账号");

    const saveBtn = document.getElementById("admin_saveBtn");
    const statusMsg = document.getElementById("admin_statusMsg");

    if (saveBtn) saveBtn.disabled = true;
    if (statusMsg) {
      statusMsg.style.color = "var(--du-muted)";
      statusMsg.textContent = "正在保存...";
    }

    const epayChannels = [];
    const epayAlipay = document.getElementById("admin_epay_enable_alipay");
    const epayWxpay = document.getElementById("admin_epay_enable_wxpay");
    if (epayAlipay && epayAlipay.checked) epayChannels.push("alipay");
    if (epayWxpay && epayWxpay.checked) epayChannels.push("wxpay");

    const payConfig = {
      monthly_amount:    document.getElementById("admin_monthly_amount")?.value.trim() || "29",
      yearly_amount:     document.getElementById("admin_yearly_amount")?.value.trim() || "199",
      epay_url:           document.getElementById("admin_epay_url")?.value.trim() || "",
      epay_pid:           document.getElementById("admin_epay_pid")?.value.trim() || "",
      epay_key:           document.getElementById("admin_epay_key")?.value.trim() || "",
      epay_channels:      epayChannels,
      wechat_mchid:       document.getElementById("admin_wechat_mchid")?.value.trim() || "",
      wechat_key:         document.getElementById("admin_wechat_key")?.value.trim() || "",
      alipay_app_id:      document.getElementById("admin_alipay_app_id")?.value.trim() || "",
      alipay_private_key: document.getElementById("admin_alipay_private_key")?.value.trim() || ""
    };

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ payConfig })
      });
      const data = await res.json();
      if (data.ok) {
        if (statusMsg) {
          statusMsg.style.color = "var(--du-green)";
          statusMsg.textContent = "✅ 保存成功！客户端配置已同步。";
          setTimeout(() => statusMsg.textContent = "", 3000);
        }
      } else {
        if (statusMsg) {
          statusMsg.style.color = "#ef4444";
          statusMsg.textContent = "❌ 保存失败: " + data.message;
        }
      }
    } catch (e) {
      if (statusMsg) {
        statusMsg.style.color = "#ef4444";
        statusMsg.textContent = "❌ 网络错误，保存失败";
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // 获取订单记录
  async function fetchAdminOrders() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const tbody = document.getElementById("admin_orderTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--du-muted)">正在拉取订单...</td></tr>`;

    try {
      const res = await fetch("/api/admin/orders", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);

      if (data.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--du-muted)">暂无订单记录</td></tr>`;
        return;
      }

      tbody.innerHTML = data.orders.map(order => {
        const statusClass = order.status === "paid" ? "paid" : "pending";
        const statusText = order.status === "paid" ? "已支付" : "待支付";
        const planText = order.plan === "yearly" ? "年度 Pro" : "月度 Pro";
        const timeStr = new Date(order.createdAt).toLocaleString("zh-CN");
        
        return `
          <tr style="border-bottom: 1px solid var(--du-line);">
            <td style="padding:14px 16px; font-family:monospace; color:var(--du-ink);">${order.id}</td>
            <td style="padding:14px 16px;">
              <div style="font-weight:600; color:var(--du-ink);">${order.username}</div>
              <div style="font-size:10px; color:var(--du-muted)">ID: ${order.userId}</div>
            </td>
            <td style="padding:14px 16px; color:var(--du-ink);">${planText}</td>
            <td style="padding:14px 16px; color:#ef4444; font-weight:600">¥${order.amount}</td>
            <td style="padding:14px 16px;"><span class="admin-status-pill ${statusClass}">${statusText}</span></td>
            <td style="padding:14px 16px; color:var(--du-muted)">${timeStr}</td>
          </tr>
        `;
      }).join("");

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#ef4444">拉取失败: ${e.message}</td></tr>`;
    }
  }

})();
