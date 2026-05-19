import { createPayment, verifyEpaySign } from "../utils/payment.js";
import { getOrders, saveOrder, getUserAccount, saveUserAccount, getSetting } from "../utils/db.js";
import crypto from "node:crypto";

function safeReturnUrl(value) {
  const appUrl = process.env.APP_URL || "http://127.0.0.1:4173";
  const fallback = new URL("/", appUrl);
  try {
    const target = new URL(value || "/", appUrl);
    return target.origin === fallback.origin ? target.toString() : fallback.toString();
  } catch {
    return fallback.toString();
  }
}

function enabledPaymentMethods(config = {}) {
  const methods = [];
  const hasEpay = Boolean((config.epay_key || process.env.EPAY_KEY) && (config.epay_pid || process.env.EPAY_PID));
  if (!hasEpay) return methods;

  const channels = config.epay_channels
    || (config.epay_type ? [config.epay_type] : ["alipay"]);
  if (channels.includes("alipay")) {
    methods.push({ id: "epay_alipay", name: "支付宝", icon: "🔵" });
  }
  if (channels.includes("wxpay")) {
    methods.push({ id: "epay_wxpay", name: "微信支付", icon: "🟢" });
  }
  return methods;
}

function normalizeAmount(value, fallback) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999) return fallback;
  return Math.round(amount * 100) / 100;
}

function planCatalog(config = {}) {
  return {
    monthly: {
      id: "monthly",
      title: "盐选工作台-月度Pro会员",
      label: "月度 Pro 会员",
      amount: normalizeAmount(config.monthly_amount ?? process.env.PRO_MONTHLY_AMOUNT, 29),
      days: 31
    },
    yearly: {
      id: "yearly",
      title: "盐选工作台-年度Pro会员",
      label: "年度 Pro 会员",
      amount: normalizeAmount(config.yearly_amount ?? process.env.PRO_YEARLY_AMOUNT, 199),
      days: 365
    }
  };
}

export async function handlePayRoutes(request, response, url, helpers) {
  const { sendJson, readJson, getUserId } = helpers;

  // GET /api/pay/config - 获取支持的支付方式
  if (url.pathname === "/api/pay/config" && request.method === "GET") {
    const dbConfig = await getSetting("pay_config") || {};
    const methods = enabledPaymentMethods(dbConfig);
    const plans = planCatalog(dbConfig);
    sendJson(response, 200, { ok: true, configured: methods.length > 0, methods, plans });
    return true;
  }

  // POST /api/pay/checkout - 发起支付
  if (url.pathname === "/api/pay/checkout" && request.method === "POST") {
    try {
      const payload = await readJson(request);
      const userId = getUserId(request, payload, url);
      if (!userId) { sendJson(response, 401, { ok: false, message: "未登录" }); return true; }

      const { plan, method, returnUrl } = payload;
      if (!plan || !method) { sendJson(response, 400, { ok: false, message: "参数不完整" }); return true; }
      if (!["monthly", "yearly"].includes(plan)) {
        sendJson(response, 400, { ok: false, message: "不支持的套餐" });
        return true;
      }

      // 1. 获取数据库支付配置并校验支付方式
      const dbConfig = await getSetting("pay_config") || {};
      const catalog = planCatalog(dbConfig);
      const selectedPlan = catalog[plan];
      const amount = selectedPlan.amount;
      const title = selectedPlan.title;
      const orderId = `YX${crypto.randomUUID()}`;
      const methods = enabledPaymentMethods(dbConfig);
      if (!methods.some((item) => item.id === method)) {
        sendJson(response, 400, { ok: false, message: "支付方式未配置或不可用" });
        return true;
      }

      // 2. 创建订单
      const order = {
        id: orderId,
        userId,
        plan,
        amount,
        title: selectedPlan.label,
        method,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      await saveOrder(order);

      // 3. 调用底层接口获取支付链接或二维码
      const payData = await createPayment(orderId, amount, method, title, safeReturnUrl(returnUrl), dbConfig);

      sendJson(response, 200, { ok: true, order, payData });
    } catch (e) {
      sendJson(response, 500, { ok: false, message: "发起支付失败: " + e.message });
    }
    return true;
  }

  // GET /api/pay/notify/epay - 易支付异步回调
  if (url.pathname.startsWith("/api/pay/notify/epay") && request.method === "GET") {
    const query = Object.fromEntries(url.searchParams.entries());
    const dbConfig = await getSetting("pay_config") || {};
    
    if (!verifyEpaySign(query, dbConfig)) {
      response.writeHead(400);
      response.end("sign error");
      return true;
    }

    if (query.trade_status === "TRADE_SUCCESS") {
      const orderId = query.out_trade_no;
      const completed = await completeOrder(orderId, query.money);
      if (!completed) {
        response.writeHead(400);
        response.end("order error");
        return true;
      }
      response.writeHead(200);
      response.end("success");
    } else {
      response.writeHead(200);
      response.end("fail");
    }
    return true;
  }

  // POST /api/pay/verify-return - 前端支付返回校验
  if (url.pathname === "/api/pay/verify-return" && request.method === "POST") {
    try {
      const payload = await readJson(request);
      const dbConfig = await getSetting("pay_config") || {};
      if (!verifyEpaySign(payload, dbConfig)) {
        sendJson(response, 400, { ok: false, message: "签名验证失败" });
        return true;
      }
      if (payload.trade_status === "TRADE_SUCCESS") {
        const orderId = payload.out_trade_no;
        await completeOrder(orderId, payload.money);
        sendJson(response, 200, { ok: true, message: "支付已核实" });
      } else {
        sendJson(response, 400, { ok: false, message: "交易未完成" });
      }
    } catch (e) {
      sendJson(response, 500, { ok: false, message: "核对失败" });
    }
    return true;
  }

  // POST /api/pay/notify/alipay - 支付宝异步回调
  if (url.pathname === "/api/pay/notify/alipay" && request.method === "POST") {
    // 实际应引入 SDK 验证签名
    // 此处简化处理
    const payload = await readJson(request); // 这里可能需要改成 formData 解析
    // verify ...
    // await completeOrder(payload.out_trade_no);
    response.writeHead(200);
    response.end("success");
    return true;
  }

  // POST /api/pay/notify/wechat - 微信异步回调
  if (url.pathname === "/api/pay/notify/wechat" && request.method === "POST") {
    // 实际应引入 SDK 解析密文
    response.writeHead(200);
    response.end(JSON.stringify({ code: "SUCCESS", message: "成功" }));
    return true;
  }

  return false;
}

// 通用订单完成逻辑：更新订单状态 + 下发会员权益
async function completeOrder(orderId, paidAmount) {
  const { getDb } = await import("../utils/db.js");
  const db = await getDb();
  
  const row = await db.get("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!row) return false;
  const order = JSON.parse(row.data);
  if (order.status === "paid") return true; // 幂等
  if (paidAmount !== undefined && Number(paidAmount) !== Number(order.amount)) {
    return false;
  }

  order.status = "paid";
  order.paidAt = new Date().toISOString();
  await db.run("UPDATE orders SET status = ?, data = ? WHERE id = ?", ["paid", JSON.stringify(order), orderId]);

  // 更新用户账户
  const { getUserAccount, saveUserAccount } = await import("../utils/db.js");
  let account = await getUserAccount(order.userId);
  if (account) {
    account.tier = "pro";
    const addDays = order.plan === "yearly" ? 365 : 31;
    const currentEnd = (account.proEndsAt && new Date(account.proEndsAt) > new Date()) 
      ? new Date(account.proEndsAt) 
      : new Date();
    currentEnd.setDate(currentEnd.getDate() + addDays);
    account.proEndsAt = currentEnd.toISOString();
    
    await saveUserAccount(order.userId, account);
  }
  return true;
}
