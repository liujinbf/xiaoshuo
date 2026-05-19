# 盐选短篇故事工作台

面向「知乎盐选 / 盐言故事」风格的 AI 创作工作台，支持短篇方案生成、正文辅助生成、连载章节铸造、账号登录、云端同步与会员/支付配置演示。

---

## 功能概览

### 短篇方案

| 功能 | 说明 |
|------|------|
| 故事类型 | 历史错位爽文 / 规则怪谈脑洞 / 悬疑反转 / 婚恋复仇 / 大女主爽文 / 世情家庭 / 中式志怪 / 职场内幕 |
| 一键生成 | 标题、开篇钩子、六幕大纲、人物动机、证据链、短剧节拍 |
| 正文编辑 | 字数统计、段落统计、进度条、一致性检查 |
| AI 辅助 | 生成正文、续写、润色；兼容 OpenAI Chat Completions 格式 |
| 草稿管理 | 本地保存、后端同步、账号级数据隔离 |

### 连载铸造

| 功能 | 说明 |
|------|------|
| 连载管理 | 创建、切换、删除连载项目 |
| 章节生成 | 单章生成与批量生成，自动衔接前情 |
| 记忆机制 | 章节摘要 + 未回收伏笔 + 新增事实 + 下一章钩子 + Embedding 相似召回 |
| 阅读导出 | 章节阅读器、含章节记忆的全文 TXT 导出、短剧脚本导出 |

### 账号与会员

| 功能 | 说明 |
|------|------|
| 登录注册 | JWT 鉴权，本地开发默认 7 天 Token |
| 管理后台 | 管理员可配置支付参数 |
| 会员逻辑 | Free / Trial / Pro 配额模型 |
| 支付接口 | 易支付可用作演示；官方微信/支付宝仍是骨架实现 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | HTML5 + Vanilla CSS + Vanilla JS |
| 后端 | Node.js 20+ 内置 `http` 模块，ESM |
| 数据库 | SQLite，默认文件 `data/database.sqlite` |
| 认证 | JWT + SQLite 用户表，密码使用带盐 `scrypt`；旧 SHA-256 账号会在登录成功后自动迁移 |
| AI 接口 | OpenAI Chat Completions 兼容格式 |
| 支付 | 易支付演示接口；支付宝/微信官方接口待接 SDK |

> 当前项目仍是本地优先的创作工具原型。如需公网部署，必须先强化密码哈希、JWT 密钥、HTTPS、限流、支付验签和日志审计。

当前安全基线：

- 静态服务只暴露 `index.html`、`admin.html`、`css/`、`js/`，不会直接暴露 `data/`、`server/`、`.env*`。
- 账号、草稿、连载、订单等云端接口必须携带 JWT；请求体里的旧版 `userId` 不再作为身份依据。
- 登录和注册接口带有轻量内存限流，适合本地/单机部署；多实例部署时应迁移到 Redis 或网关限流。
- 易支付只有在配置商户号和密钥后才会出现在客户端；官方微信/支付宝仍未接 SDK，不会作为可选方式暴露。

---

## 目录结构

```text
小说生成/
├── index.html                 # 主工作台页面
├── admin.html                 # 管理后台页面
├── app.js                     # 前端主入口：事件监听与初始化
├── server.js                  # 服务端入口：环境加载、静态文件、API 分发
├── css/
│   ├── design-system.css
│   ├── design-patch.css
│   └── billing-pro.css
├── js/
│   ├── auth.js                # 登录、JWT 注入、云端同步
│   ├── constants.js           # 存储键、配额、模型预设
│   ├── model-config.js        # 模型配置面板
│   ├── utils.js               # 前端通用工具
│   ├── planner-titles.js      # 盐言故事标题生成
│   ├── planner-format.js      # 提案包格式化
│   ├── planner.js             # 短篇方案生成与渲染
│   ├── planner-history-strategy.js # 历史错位赛道专属策略
│   ├── ai.js                  # AI 状态、生成请求、一致性检查
│   ├── billing.js             # 会员配额与支付入口
│   ├── projects.js            # 草稿历史与本地存储
│   └── serial.js              # 连载铸造
├── server/
│   ├── routes/
│   │   ├── account.js         # 账户、草稿、订单接口
│   │   ├── admin.js           # 管理后台接口
│   │   ├── auth.js            # 注册、登录、同步接口
│   │   ├── novels.js          # 连载接口
│   │   └── pay.js             # 支付接口
│   └── utils/
│       ├── db.js              # SQLite 初始化、账号、项目、同步快照等数据访问
│       ├── payment.js         # 支付网关封装
│       └── prompts.js         # Prompt 与 AI 调用封装
├── data/                      # 运行时数据目录，已在 .gitignore 中忽略
├── DEVELOPMENT_RULES.md       # 开发规则
├── .env.example               # 环境变量模板
└── package.json
```

---

## 快速开始

```powershell
# Windows 用户双击运行：
start.bat

# Windows 桌面窗口版：
start-desktop.bat

# macOS / Linux 用户运行：
bash start.sh

# macOS / Linux 桌面窗口版：
bash start-desktop.sh
```

脚本会自动：
1. 检查 Node.js 环境
2. 自动运行 `npm install`
3. 自动生成 `.env` 配置文件
4. 自动在浏览器中打开页面并启动服务

纯本地模板模式也可以直接打开 `index.html`，但登录、同步、AI、连载和支付接口需要启动服务端。

### 桌面版说明

桌面版基于 Electron 封装现有本地服务，不重写业务逻辑：

- `npm run desktop` 会打开独立桌面窗口，并自动加载 `http://127.0.0.1:4173`。
- 桌面窗口默认关闭 Node 集成、开启上下文隔离，前端仍通过现有 HTTP API 调用后端。
- 当前阶段是“开发态桌面版”，适合本机使用和体验验证；正式分发安装包前，还需要补充应用图标、安装器、自动更新、数据目录迁移和代码签名。
- 如果浏览器版服务已经启动，桌面版会直接复用当前本地服务；否则会在 Electron 主进程内启动现有 `server.js`。

---

## 环境变量

```env
PORT=4173

# 生产或多人环境必须显式配置，不能使用代码默认值
JWT_SECRET=replace-with-a-long-random-secret

# 服务端默认 AI 配置，可被前端模型配置临时覆盖
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=deepseek-v4-flash
AI_BASE_URL=https://api.deepseek.com

# 可选：支付回调公网地址
APP_URL=http://127.0.0.1:4173
```

### API Key 说明

- 前端模型配置默认保存在浏览器 `localStorage`。
- 发起 AI 生成时，API Key 会随请求临时发送给当前 Node 服务端，由服务端转发到模型供应商。
- 云端同步写入独立的 `sync_snapshots` 表，只保存模型预设、Base URL 和模型名，不持久化 `apiKey`。
- 多人或公网部署时，推荐只使用服务端 `.env` 配置，不让用户在前端保存供应商密钥。

---

## 前端脚本加载顺序

`index.html` 末尾脚本顺序必须按依赖链维护：

```html
<script src="./js/auth.js"></script>
<script src="./js/data.js"></script>
<script src="./js/constants.js"></script>
<script src="./js/model-config.js"></script>
<script src="./js/utils.js"></script>
<script src="./js/planner-titles.js"></script>
<script src="./js/planner-format.js"></script>
<script src="./js/planner.js"></script>
<script src="./js/planner-history-strategy.js"></script>
<script src="./js/ai.js"></script>
<script src="./js/billing.js"></script>
<script src="./js/projects.js"></script>
<script src="./js/serial.js"></script>
<script src="./app.js?v=YYYYMMDD-feature-name"></script>
```

---

## 开发规则要点

详见 `DEVELOPMENT_RULES.md`。当前优化遵循这些原则：

- `app.js` 只做初始化和事件绑定，业务逻辑放入对应模块。
- 后端路由保持在 `server/routes/*`，通用能力放入 `server/utils/*`。
- 不继续向超过强制拆分线的文件追加业务逻辑；`js/planner.js` 已超过 500 行，后续功能应先拆分。
- 修改后至少执行 `node --check server.js` 和全部项目 JS 语法检查。

---

## 连载生成链路

连载铸造吸收了“配置驱动、批量出章、摘要压缩、下一章续写”的自动化思路，但不使用独立 Python 脚本，而是由现有 Node 服务端和 SQLite 项目数据统一管理。

当前流程：

1. 读取连载项目配置：标题、类型、大纲、人物志、目标章节数、章节字数。
2. 生成下一章正文：Prompt 会注入上一章结构化记忆和向量召回的历史记忆。
3. 二次编辑润色：生成正文后再走一层编辑 Prompt，去掉总结腔、解释腔和模板化表达。
4. 提取章节记忆：生成 `summary / openThreads / newFacts / characterUpdates / continuityChecks / nextHook`。
5. 存入 SQLite：章节正文、摘要、结构化记忆和 Embedding 一起保存。
6. 下一章继续：优先承接上一章 `nextHook`，并回收未完成伏笔。
7. 导出全文：TXT 会带上章节正文和章节记忆，便于复盘、投稿或二次编辑。

内容质量链路：

- `Context Management`：以 SQLite 中的小说项目、章节、人物志和结构化记忆作为上下文来源，避免长篇生成到后段逻辑漂移。
- `Editorial Polish`：章节初稿生成后自动进行二次编辑润色，目标是减少 AI 模板腔、增强移动端段落节奏，而不是随机堆砌口癖。
- `History Track Rules`：历史错位题材禁止模板开头和标题复述，要求先给天幕、亡国年份、关键历史人物追问等具体场面；弹幕必须克制并服务剧情。
- `Draft Polish`：短篇正文生成后会再走一层编辑 Prompt，用于修正百科式资料罗列、场景混乱、弹幕过量和总结性结尾。

---

## 已知限制与下一步

1. `js/planner.js` 已完成标题生成拆分，后续建议继续拆出渲染和一致性检查模块。
2. 支付宝/微信官方支付仍是骨架实现，上线前必须完成 SDK 接入、验签和金额校验。
3. SQLite 当前大量使用 JSON 文本字段，后续如需统计、审计和后台运营，应逐步结构化核心字段。
4. 旧版 `store.json` 迁移逻辑保留在 `server/utils/db.js`，独立 `store.js` 残留已移除。
5. 默认 `JWT_SECRET` 仅适合本地开发，部署前必须改为强随机密钥。
