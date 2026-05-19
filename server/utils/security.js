import crypto from "node:crypto";

export function clientIp(request) {
  return request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown";
}

const throttles = new Map();

/**
 * 极简内存限流器
 * @param {string} key 唯一标识（如 IP + 路由）
 * @param {object} options { limit, windowMs }
 * @returns {object} { blocked, retryAfter }
 */
export function throttle(key, { limit, windowMs }) {
  const now = Date.now();
  let bucket = throttles.get(key);
  
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + windowMs };
    throttles.set(key, bucket);
    return { blocked: false, retryAfter: 0 };
  }
  
  bucket.count += 1;
  if (bucket.count > limit) {
    return { blocked: true, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  
  return { blocked: false, retryAfter: 0 };
}

export function clearThrottle(key) {
  throttles.delete(key);
}
