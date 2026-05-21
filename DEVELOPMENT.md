# 📖 小说智能化协同生成工作台 — 前端开发与系统联动规范

本规范旨在确保系统各个核心业务模块（正文连载、大纲中心、世界推演、短篇方案、题材基因拆解等）实现**零割裂、强一致、无刷联动**的开发协同，避免由于功能分散与状态各自为政导致体验退化。

---

## 🧬 规范一：大模型配置统合调用规范 (ModelConfigManager)

### 1. 核心设计原则
全系统任何涉及 AI 调用、API 测试、基因反编译或大纲推演的逻辑，**严禁**直接访问 `localStorage.getItem("modelConfig")`，亦**严禁**自行编写 `apiKey` 校验或特定的 `providers` 提取。
必须且仅能通过挂载于全局的 `window.ModelConfigManager` 门面进行获取和有效性校验。

### 2. 门面方法与使用示例
`ModelConfigManager` 提供了以下四个标准 API：
- `ModelConfigManager.get()`：获取扁平化的当前激活子供应商配置，返回格式为：
  ```javascript
  {
    provider: "deepseek", // 当前激活提供商，如 deepseek, ollama, custom...
    apiKey: "...",        // 自动适配已激活供应商的真实 API Key
    baseUrl: "...",       // 自动适配已激活供应商的自定义端点
    model: "..."          // 当前激活的模型标识
  }
  ```
- `ModelConfigManager.hasValidKey()`：判断当前 API Key 是否有效。**（非常关键：当供应商为 `ollama` 时，会自动判为 `true` 兼容本地免 Key，严禁手写 key.length > 0 判断，防止阻断本地模型用户！）**
- `ModelConfigManager.read()`：读取包含各子供应商的原始嵌套 JSON 配置。
- `ModelConfigManager.write(cfg)`：覆写保存最新配置并自动穿透至全站。

### 3. 正确的业务场景重构示例
> [!TIP]
> 以后如果在新增面板（如“智能插画/旁白生成”）中需要调用 AI API，应该这样写：

```javascript
// ⚡ 推荐：使用统一门面校验与读取配置
if (!ModelConfigManager.hasValidKey()) {
  alert("请先在设置中填写有效的 API Key（本地 Ollama 免填）");
  return;
}

const modelConfig = ModelConfigManager.get(); // 自动匹配激活提供商的扁平配置
const res = await fetch("/api/your-feature", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: "...",
    modelConfig // 统一将获取到的配置送入 payload
  })
});
```

---

## 🎯 规范二：全局小说选中状态单真相源 (currentNovel)

为了保证左侧“故事切换”时，右侧“大纲中心”、“世界推演”、“正文生成”能够完美联动刷新，系统采用了**唯一真相源（Single Source of Truth）**与**解耦广播**架构。

### 1. 全局单真相源
- 全系统只允许且唯一存在：`window.currentNovel` 变量。
- **严禁**声明并依赖 `window.currentSerialNovel` 或其他子组件内独立的 `selectedNovelId` 作为持久状态，防止因数据源不合流导致切换失效。

### 2. 解耦联动广播事件
- **广播源（分发端）**：左侧切换/加载小说时，必须向全局 `window` 派发标准的 `currentNovelChanged` 自定义事件。
  ```javascript
  // ⚡ 标准的派发写法 (参考 serial-render.js -> selectNovel)
  window.currentNovel = novel;
  window.dispatchEvent(new CustomEvent("currentNovelChanged", { detail: novel }));
  ```
- **监听源（消费端）**：右侧的大纲面板、世界设定面板等，必须统一监听 `currentNovelChanged` 自定义事件。
  ```javascript
  // ⚡ 标准的监听与无刷刷新写法 (参考 task-world.js -> initTaskPanel)
  window.addEventListener("currentNovelChanged", (e) => {
    const novel = e.detail;
    refreshYourPanel(novel); // 触发面板内部的 UI 数据重新装填与无缝渲染
  });
  ```

---

## 🔄 规范三：小说协同创作双轨流规范 (使用先后流程说明)

为了防止世界设定（人物卡池、世界观基调、逻辑铁律、脉络时间轴）与大纲及正文生成各自为政、互不联动的现象，系统采用了**双向赋能（Bidirectional Flow）**的生命周期架构。开发新功能时，必须严格遵守以下双轨流转逻辑：

### 1. 模式一：大纲先行（推演快速流）
- **核心数据流**：用户输入创意脑洞 ➡️ 生成大纲框架（`novel.outline`） ➡️ 点击“从大纲推演世界设定” ➡️ AI 推演出登场角色、世界规则并**回填灌入**世界设定（`novel.characters`） ➡️ 微调后进行分章正文生成。
- **开发要求**：推演世界设定接口（如 `world_infer`）必须提供针对已有大纲的高精度特征提取，解析出潜在人物关系与规则链，自动生成 Markdown 格式的设定富文本。

### 2. 模式二：设定先行（架构精品流）
- **核心数据流**：用户首先在世界设定中手动录入或让 AI 生成精美人物卡与核心怪谈/灵异/科技规则并保存（`novel.characters`） ➡️ 前往大纲中心生成大纲 ➡️ AI **强力读取**并缝合设定，生成剧情框架（`novel.outline`） ➡️ 分章正文生成，AI 严格遵守外貌特征与逻辑铁律。
- **开发要求**：
  - **大纲推演器（Step 1 & Step 2）**：在调用 AI 生成核心设定和大纲章节时，必须无缝读取并注入当前选中的世界设定（`novel.characters`），并写死强制指令，命令 AI 依照设定角色的核心矛盾驱动三幕结构。
  - **正文生成器**：在 `server/utils/prompts.js` 中强令 AI 提取 `novel.characters`，在正文中进行外貌细节白描（如琥珀色眼眸、老式机械表等物证交互）、触发专属口头禅、且绝对不可逾越设定的逻辑红线。

---

## 🚀 防割裂接入自检 Checklist

任何新功能（如新增加的 Tab 面板或智能写作卡片）在合并发布前，**必须**照此清单进行自检，确保系统流畅性体验：

- [ ] **自检项 1：API 门面引用**
  新功能的 AI 生成逻辑是否已彻底使用 `ModelConfigManager.get()` 与 `ModelConfigManager.hasValidKey()`？是否仍残存对 `localStorage` 的直接操作或手动 `sk-` 判断？
- [ ] **自检项 2：本地 Ollama 兼容性**
  当“大模型配置”切换为 `ollama` 且清空 Key 时，新功能是否仍会弹窗提示“请填写 API Key”？（若使用了 `ModelConfigManager.hasValidKey()`，会自动规避该问题）。
- [ ] **自检项 3：切换小说状态实时刷**
  在左侧切换不同的小说连载，新面板上的关联数据（如章节数、大纲摘要、特定约束）是否会**立刻无刷更新**？
- [ ] **自检项 4：清空删除联动自愈**
  当左侧小说被全部删除时，新面板是否会优雅退回到“暂无选中”的 Empty State 状态，且不抛出未捕获的全局 JS 异常？
- [ ] **自检项 5：世界设定与大纲/正文强联动**
  任何涉及章节生成、大纲大改或大纲生成的逻辑，是否已经彻底对齐 `novel.characters` 里的最新人设和世界规则？大纲/正文是否能百分之百呼应世界设定里的核心词汇（外貌、口头禅、逻辑红线）？

