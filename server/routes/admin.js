import { getSetting, saveSetting, getDb } from "../utils/db.js";

const PAY_CONFIG_KEYS = [
  "epay_url",
  "epay_pid",
  "epay_key",
  "epay_type",
  "epay_channels",
  "monthly_amount",
  "yearly_amount",
  "alipay_app_id",
  "alipay_private_key",
  "wechat_key",
  "wechat_mchid"
];

function normalizePayConfig(input = {}) {
  const output = {};
  for (const key of PAY_CONFIG_KEYS) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (key === "epay_channels") {
      const channels = Array.isArray(value) ? value : [value];
      output[key] = channels.filter((item) => ["alipay", "wxpay"].includes(item));
      continue;
    }
    if (key === "monthly_amount" || key === "yearly_amount") {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 99999) {
        const error = new Error(`${key === "monthly_amount" ? "月度价格" : "年度价格"}必须是 0-99999 之间的数字`);
        error.statusCode = 400;
        throw error;
      }
      output[key] = String(Math.round(amount * 100) / 100);
      continue;
    }
    const normalized = String(value).trim();
    if (normalized.length > 4096) {
      const error = new Error(`${key} 配置过长`);
      error.statusCode = 400;
      throw error;
    }
    if (key === "epay_url" && normalized) {
      try {
        const parsed = new URL(normalized);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        const error = new Error("易支付网关地址必须是有效的 http/https URL");
        error.statusCode = 400;
        throw error;
      }
    }
    output[key] = normalized;
  }
  return output;
}

export async function handleAdminRoutes(request, response, url, helpers) {
  const { sendJson, readJson, getUserAuth } = helpers;

  if (url.pathname.startsWith("/api/admin")) {
    const auth = getUserAuth(request);
    if (!auth || !auth.userId) {
      sendJson(response, 403, { ok: false, message: "禁止访问，需要管理员权限" });
      return true;
    }

    // 优先信任 Token 中的 role；如果没有（旧 Token），回退到数据库查询
    let role = auth.role;
    if (!role) {
      const db = await getDb();
      const user = await db.get("SELECT role FROM users WHERE id = ?", [auth.userId]);
      role = user?.role || "user";
    }

    if (role !== "admin") {
      sendJson(response, 403, { ok: false, message: "禁止访问，需要管理员权限" });
      return true;
    }

    if (url.pathname === "/api/admin/settings" && request.method === "GET") {
      const payConfig = await getSetting("pay_config") || {};
      sendJson(response, 200, { ok: true, payConfig });
      return true;
    }

    if (url.pathname === "/api/admin/settings" && request.method === "POST") {
      try {
        const payload = await readJson(request);
        const newPayConfig = normalizePayConfig(payload.payConfig);
        await saveSetting("pay_config", newPayConfig);
        sendJson(response, 200, { ok: true, message: "保存成功", payConfig: newPayConfig });
      } catch (error) {
        sendJson(response, error.statusCode || 500, { ok: false, message: error.message || "保存失败" });
      }
      return true;
    }

    if (url.pathname === "/api/admin/orders" && request.method === "GET") {
      const db = await getDb();
      // 获取所有订单，并关联用户名（可选，如果有的话）
      const rows = await db.all(`
        SELECT o.*, u.username 
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.id 
        ORDER BY o.created_at DESC 
        LIMIT 100
      `);
      const orders = rows.map(r => ({
        ...JSON.parse(r.data),
        username: r.username || "匿名用户",
        status: r.status // 确保使用数据库里的结构化状态
      }));
      sendJson(response, 200, { ok: true, orders });
      return true;
    }
  }

  return false;
}
