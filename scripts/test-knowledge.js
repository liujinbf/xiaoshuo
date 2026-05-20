import { retrieveSubjectKnowledge, formatKnowledgeForPrompt } from "../server/utils/knowledge-retrieval-service.js";
import { initializeDatabase } from "../server/utils/db-init.js";

async function run() {
  console.log("1. 初始化 SQLite 数据库以确保 schema 建立并包含种子...");
  await initializeDatabase();

  console.log("\n2. 测试常识实体精确与模糊匹配逻辑...");
  
  const testCases = [
    {
      input: "我穿越到了秦朝，遇到了赵高，决定用砒霜当毒药。",
      expectedEntities: ["秦朝", "砒霜"]
    },
    {
      input: "主角在太空中，周围是高度的太空真空，突然听到了爆炸声，这科学吗？",
      expectedEntities: ["太空真空"]
    },
    {
      input: "在荒凉的沙漠中，他极度口渴，切开仙人掌直接狂饮。",
      expectedEntities: ["沙漠"]
    }
  ];

  for (const tc of testCases) {
    console.log(`\n输入文本: "${tc.input}"`);
    const matched = await retrieveSubjectKnowledge({ text: tc.input, limit: 3 });
    const matchedEntities = matched.map(m => m.entity);
    console.log("召回的实体:", matchedEntities);
    
    // 验证是否包含所有期望匹配的实体
    for (const exp of tc.expectedEntities) {
      if (matchedEntities.includes(exp)) {
        console.log(`[PASS] 成功匹配实体: "${exp}"`);
      } else {
        console.error(`[FAIL] 未能匹配到实体: "${exp}"`);
      }
    }
    
    console.log("AI Prompt 格式化结果:");
    console.log(formatKnowledgeForPrompt(matched));
  }

  process.exit(0);
}

run().catch(console.error);
