# 盐选故事工作台 — 开发规则

> **版本**: 1.1.0 | **生效日期**: 2026-05-19  
> 所有新功能开发、bug 修复、AI 辅助开发，均须遵守本文档。

---

## 一、文件行数红线

| 文件类型 | 警告阈值 | 强制拆分阈值 |
|---------|---------|------------|
| `js/*.js` (前端模块) | 300 行 | **500 行** |
| `app.js` (主入口) | 200 行 | **300 行** |
| `server.js` (服务端主文件) | 350 行 | **500 行** |
| `server/**/*.js` | 200 行 | **300 行** |
| `styles.css` / `css/*.css` | 400 行 | **600 行** |
| `index.html` | 350 行 | **500 行** |

**达到警告阈值时**：在文件顶部加 `// ⚠️ 本文件已超过建议行数，请在下次功能迭代时拆分` 注释。  
**达到强制拆分阈值时**：拒绝向该文件继续添加代码，必须先拆分。

---

## 二、前端模块结构

```
js/
├── auth.js          ← 登录、JWT 注入、云端同步
├── data.js          ← 故事档案数据（storyProfiles / inspirationPool / endingMap）
│                      ⚠️ 只存 JSON-like 数据，禁止任何业务逻辑
├── constants.js     ← 存储键、配额限制、模型预设
│                      ⚠️ 禁止写函数；常量必须以 UPPER_SNAKE_CASE 命名
├── model-config.js  ← AI 模型配置 UI（读写 localStorage + 渲染面板）
├── utils.js         ← 纯工具函数（pick / escapeHtml / collectInput）
│                      ⚠️ 函数不得依赖任何 DOM 元素
├── planner-titles.js ← 盐言故事标题生成，负责题材化标题模板
├── planner-format.js ← 提案包格式化
├── planner.js       ← 故事方案生成逻辑（buildXxx / scoreXxx）、题材预设联动
│                      ⚠️ 超过 500 行时拆分为 planner-build.js + planner-render.js
├── planner-render.js ← [已拆分] 故事方案 UI 渲染函数
├── planner-history-strategy.js ← 历史错位赛道专属商业策略覆盖层
├── ai.js            ← AI 接口调用、状态、一致性检查
├── billing.js       ← 会员配额、订单、试用
├── projects.js      ← 项目存储 / 历史 / 同步 / 文件 IO
├── serial-render.js  ← [已拆分] 连载模块 UI 渲染
├── serial.js        ← 连载铸造模块（章节生成 / 记忆机制 / 阅读器）
├── learning.js      ← 爆款拆解学习器（RAG 知识库管理）
├── desktop-ui.js    ← 桌面版 UI 交互（导航、状态条、配额圆弧）——必须在 app.js 前加载
├── admin.js         ← 管理后台页面逻辑
└── [future].js      ← 新功能模块，遵循命名规范
```

```
app.js              ← 主入口（DOM 引用 + 事件监听 + 初始化）
                       ⚠️ 禁止在此写业务逻辑
```

### 前端加载顺序（index.html）
必须严格按以下顺序在 `<body>` 末尾加载：
```html
<script src="./js/auth.js"></script>
<script src="./js/data.js"></script>
<script src="./js/constants.js"></script>
<script src="./js/model-config.js"></script>
<script src="./js/utils.js"></script>
<script src="./js/planner-titles.js"></script>
<script src="./js/planner-format.js"></script>
<script src="./js/planner.js"></script>
<script src="./js/planner-render.js"></script>
<script src="./js/planner-history-strategy.js"></script>
<script src="./js/ai.js"></script>
<script src="./js/billing.js"></script>
<script src="./js/projects.js"></script>
<script src="./js/serial-render.js"></script>
<script src="./js/serial.js"></script>
<script src="./js/learning.js"></script>
<script src="./js/desktop-ui.js"></script>   <!-- 必须在 app.js 前加载 -->
<script src="./app.js?v=YYYYMMDD-feature-name"></script>
```

**新增模块时**：在 `desktop-ui.js` 之后、`app.js` 之前插入。`auth.js` 必须先于其他会调用 `/api/` 的模块加载。  
**版本参数规则**：每次发版更新 `app.js?v=` 后的版本号，格式 `YYYYMMDD-功能简称`。

---

## 三、后端模块结构

```
server.js              ← 主服务器（路由分发 + 静态文件）
server/
├── utils/
│   ├── db.js          ← SQLite 初始化与数据访问
│   ├── prompts.js     ← AI Prompt 构建器与 AI 调用
│   └── payment.js     ← 支付网关封装
└── routes/
    ├── auth.js        ← 登录注册与云端同步
    ├── account.js     ← 账户、草稿、订单路由
    ├── novels.js      ← 连载路由
    ├── pay.js         ← 支付路由
    └── admin.js       ← 管理后台路由
```

---

## 四、新功能开发流程

### 4.1 新增前端功能
1. 判断功能属于哪个现有模块（参考第二节）
2. 如目标模块 < 400 行：直接在模块末尾追加
3. 如目标模块 ≥ 400 行：先拆分，再追加
4. 事件监听注册在 `app.js`，业务逻辑写在对应模块

### 4.2 新增后端路由
1. 判断功能属于哪个路由分组（novels / account / projects / orders）
2. 创建或复用 `server/routes/xxx.js`，不要继续把业务路由追加到 `server.js`
3. 在 `server.js` 中使用 ESM `import` 注册路由，禁止使用 CommonJS `require`

### 4.3 新增故事类型
1. 在 `js/data.js` 的 `storyProfiles` 对象中追加
2. 必须包含：`label / roles(≥10) / secrets(≥6) / titleWords(≥10) / outline(6条) / tone`
3. 在 `index.html` 的 `<select name="genre">` 中追加 `<option>`
4. 在 `js/planner-titles.js` 中追加对应标题模板
5. 在 `server/utils/prompts.js` 中按需更新相关 Prompt 约束

### 4.4 新增模型预设
1. 在 `js/constants.js` 的 `MODEL_PRESETS` 数组中追加
2. 必须填写 `id / label / baseUrl / model / hint` 五个字段
3. 在 `index.html` 的 `#modelPreset` select 中追加 `<option>`

---

## 五、命名规范

| 对象 | 规范 | 示例 |
|------|------|------|
| 常量 | `UPPER_SNAKE_CASE` | `STORAGE_KEY` |
| 函数 | `camelCase` + 动词开头 | `buildOutline()` / `renderHistory()` |
| DOM 引用变量 | `camelCase` + 元素功能 | `aiDraftBtn` / `draftEditor` |
| 模块文件 | `kebab-case.js` | `model-config.js` |
| CSS 类名 | `kebab-case` | `.serial-gen-btn` |
| API 路由 | `/api/名词/动词` (RESTful) | `/api/novels/:id/chapters/generate` |

---

## 六、禁止项

- ❌ 在 `js/data.js` 或 `js/constants.js` 中写任何函数或 DOM 操作
- ❌ 在 `app.js` 主入口中写超过 10 行的业务逻辑（应抽取到对应模块）
- ❌ 在任何模块中使用 `document.querySelector` 查询**其他模块负责的** DOM 元素
- ❌ 用 `var` 声明变量（统一用 `const` / `let`）
- ❌ 在字符串字面量里直接嵌入中文引号（如 `"模型配置"`），必须转义或改用模板字符串
- ❌ 直接操作 `data/database.sqlite` 或旧版 `store.json`（只通过 `server/utils/db.js` 访问）
- ❌ 硬编码 API Key（应通过 `.env` 或 `localStorage` 传入）

---

## 七、代码审查清单

提交 PR 前必须确认：
- [ ] 无任何单文件超过强制拆分阈值
- [ ] 新函数有注释说明入参/返回值
- [ ] `node --check server.js` 通过语法检查
- [ ] `js/` 下所有 `*.js` 文件通过 `node --check` 检查（由于浏览器 API 会报错，改用 `node --input-type=module` 检查 ES 语法）
- [ ] `app.js?v=` 的版本号已更新
- [ ] 新增 `<script>` 标签的加载顺序符合依赖链

---

*本文档由 AI 助手自动生成，需要团队 review 后执行。*
