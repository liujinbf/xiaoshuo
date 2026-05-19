// 模块: constants.js — 存储键、配额限制、运行状态
const STORAGE_KEY = "yanxuan-story-projects";
const USER_KEY = "yanxuan-story-user-id";
const BILLING_KEY = "yanxuan-story-billing";
const MODEL_CONFIG_KEY = "yanxuan-story-model-config";

const QUOTA_LIMITS = {
  free: { ideas: 20, saves: 8, ai: 3 },
  pro: { ideas: 50000, saves: 50000, ai: 50000 }
};

const QUOTA_LABELS = {
  ideas: "方案生成",
  saves: "项目保存",
  ai: "AI 正文"
};
