// ============================================================
// 模块: server/utils/payment.js — 支付网关统一接口
// 支持: 微信支付官方、支付宝官方、易支付 (Epay)
// ============================================================
import crypto from "node:crypto";

// === 1. 易支付 (Epay) 逻辑 ===
function createEpay(orderId, amount, title, returnUrl, config) {
  let epayUrl = config.epay_url || process.env.EPAY_API_URL || "https://api.epay.com/submit.php";
  const pid = config.epay_pid || process.env.EPAY_PID || "";
  const key = config.epay_key || process.env.EPAY_KEY || "";
  if (!pid || !key) throw new Error("后台未配置易支付商户号或密钥");
  
  // 自动修正：如果管理员只填了域名（没有路径），自动补全 /submit.php
  if (epayUrl && !epayUrl.includes("/submit") && !epayUrl.includes("?")) {
    epayUrl = epayUrl.replace(/\/$/, "") + "/submit.php";
  }

  // epay 内的支付类型：alipay=支付宝  wxpay=微信
  const epayType = config.epay_type || "alipay";

  const params = {
    pid: pid,
    type: epayType,
    out_trade_no: orderId,
    notify_url: `${process.env.APP_URL || "http://127.0.0.1:4173"}/api/pay/notify/epay`,
    return_url: returnUrl,
    name: title,
    money: String(amount)
  };

  // 生成签名
  const keys = Object.keys(params).sort();
  let signStr = "";
  for (const k of keys) {
    if (params[k]) signStr += `${k}=${params[k]}&`;
  }
  signStr = signStr.slice(0, -1) + key;
  const sign = crypto.createHash("md5").update(signStr, "utf8").digest("hex");
  
  params.sign = sign;
  params.sign_type = "MD5";

  // 构建跳转链接
  const query = new URLSearchParams(params).toString();
  return `${epayUrl}?${query}`;
}

// === 2. 支付宝官方逻辑 (Scaffolding) ===
function createAlipay(orderId, amount, title, returnUrl, config) {
  throw new Error("官方支付宝支付尚未完成 SDK 接入和签名，请先使用易支付渠道");
}

// === 3. 微信支付官方逻辑 (Scaffolding) ===
function createWechatPay(orderId, amount, title, config) {
  throw new Error("官方微信支付尚未完成 SDK 接入和验签，请先使用易支付渠道");
}

// 统一下单接口
export async function createPayment(orderId, amount, method, title, returnUrl, config = {}) {
  switch (method) {
    // 易支付 — 支付宝渠道
    case "epay_alipay":
      return { type: "url", url: createEpay(orderId, amount, title, returnUrl, { ...config, epay_type: "alipay" }) };
    // 易支付 — 微信渠道
    case "epay_wxpay":
      return { type: "url", url: createEpay(orderId, amount, title, returnUrl, { ...config, epay_type: "wxpay" }) };
    // 易支付 — 兼容旧 id
    case "epay":
      return { type: "url", url: createEpay(orderId, amount, title, returnUrl, config) };
    // 官方支付宝
    case "alipay":
      return { type: "url", url: createAlipay(orderId, amount, title, returnUrl, config) };
    // 官方微信 Native
    case "wechat":
      return { type: "qrcode", url: createWechatPay(orderId, amount, title, config) };
    default:
      throw new Error("不支持的支付方式: " + method);
  }
}

// 签名验证工具等
export function verifyEpaySign(data, config = {}) {
  const key = config.epay_key || process.env.EPAY_KEY || "";
  if (!key) return false;
  const sign = data.sign;
  const params = { ...data };
  delete params.sign;
  delete params.sign_type;

  const keys = Object.keys(params).sort();
  let signStr = "";
  for (const k of keys) {
    if (params[k] !== "" && params[k] !== undefined) {
      signStr += `${k}=${params[k]}&`;
    }
  }
  signStr = signStr.slice(0, -1) + key;
  const mySign = crypto.createHash("md5").update(signStr, "utf8").digest("hex");
  
  return mySign === sign;
}
