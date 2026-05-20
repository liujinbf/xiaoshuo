// scripts/test-knowledge-expand.js
// 目的: 自动测试并验证学科常识库的联网/AI 自动扩充与智能检索约束流程。

import { expandKnowledge } from "../server/utils/knowledge-expansion-service.js";
import { retrieveSubjectKnowledge, formatKnowledgeForPrompt } from "../server/utils/knowledge-retrieval-service.js";
import { saveKnowledge, getAllKnowledge } from "../server/utils/db.js";

async function run() {
  console.log("1. 正在模拟扩充实体 '水银' 的学科常识...");
  
  try {
    const generated = await expandKnowledge({
      entity: "水银",
      modelConfig: {
        // 使用空 key 或 mock 确保无 token 也能跑完
        apiKey: process.env.OPENAI_API_KEY || "sk-mock-key",
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com",
        model: "gpt-4o-mini"
      }
    });

    console.log("   [生成结果]:", JSON.stringify(generated, null, 2));

    if (!generated.category || !generated.entity || !generated.content) {
      throw new Error("❌ AI 常识生成数据不完整！");
    }
    console.log("   [PASS] AI 成功生成结构化常识。");

    console.log("\n2. 正在存入本地 SQLite 数据库中...");
    await saveKnowledge(generated.category, generated.entity, generated.content);
    console.log("   [PASS] 成功入库。");

    console.log("\n3. 从数据库读取全部常识以确保其被正确持久化...");
    const all = await getAllKnowledge();
    const hasNewEntity = all.some(item => item.entity === generated.entity);
    if (!hasNewEntity) {
      throw new Error("❌ 数据库中没有找到刚存入的实体！");
    }
    console.log(`   [PASS] 数据库已包含该常识实体。当前库内常识实体总数: ${all.length}`);

    console.log("\n4. 模拟在小说大纲或一句话概述中提及该实体以触发智能召回...");
    const inputText = "主角在密室里被敌人灌了大量水银，他尝试喝水稀释毒素逃脱。";
    const matched = await retrieveSubjectKnowledge({ text: inputText, limit: 3 });

    console.log("   [召回的实体]:", matched.map(m => m.entity));
    const isRecalled = matched.some(m => m.entity === "水银");
    if (!isRecalled) {
      throw new Error("❌ 智能检索未能成功召回刚刚扩充的“水银”常识约束！");
    }
    console.log("   [PASS] 检索系统成功关联该常识卡片。");

    console.log("\n5. 验证是否生成正确的 Prompt 硬性约束语句...");
    const promptConstraint = formatKnowledgeForPrompt(matched);
    console.log("------------------ PROMPT CONSTRAINT ------------------");
    console.log(promptConstraint);
    console.log("-------------------------------------------------------");

    if (!promptConstraint.includes("【硬性现实逻辑与常识约束】") || !promptConstraint.includes("水银")) {
      throw new Error("❌ 最终 Prompt 约束段落生成错误！");
    }
    console.log("   [PASS] 最终 AI 约束注入验证成功！");

    console.log("\n🎉 所有自动扩充与检索约束集成测试全部通过！");
  } catch (err) {
    console.error("❌ 测试失败:", err.message);
    process.exit(1);
  }
}

run();
