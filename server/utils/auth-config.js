export const DEFAULT_JWT_SECRET = "yanxuan-secret-key-123";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  if (process.env.NODE_ENV === "production" && secret === DEFAULT_JWT_SECRET) {
    throw new Error("生产环境必须配置强随机 JWT_SECRET，禁止使用默认密钥。");
  }
  return secret;
}

export function warnIfDefaultJwtSecret() {
  if (!process.env.JWT_SECRET) {
    console.warn("警告：当前使用默认 JWT_SECRET，仅适合本地开发。公网部署前必须在 .env 中配置强随机密钥。");
  }
}
