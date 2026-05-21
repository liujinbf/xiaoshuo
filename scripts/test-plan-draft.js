import { callOpenAI } from "../server/utils/draft-prompts.js";

async function runTest() {
  console.log("开始验证【短篇大纲与正文生成解耦】功能...");
  
  const mockPayload = {
    mode: "plan",
    input: {
      theme: "林姨逼我拿回三十万拆迁款",
      genre: "family",
      viewpoint: "first",
      length: 8000,
      intensity: 9,
      tags: ["反转", "爽文"]
    },
    modelConfig: {
      apiKey: "sk-your-api-key" // 故意传入 placeholder，触发本地高仿真 Mock 模式
    }
  };

  try {
    const rawResultText = await callOpenAI(mockPayload);
    const result = JSON.parse(rawResultText);
    
    console.log("-----------------------------------------");
    console.log("✅ 离线 Mock 生成测试成功！");
    console.log("标题候选列表：", result.titles);
    console.log("首段开篇钩子：", result.hook);
    console.log("正文段落列表 (draft 字段)：", result.draft);
    console.log("-----------------------------------------");
    
    if (Array.isArray(result.draft) && result.draft.length === 0) {
      console.log("🎉 验证成功！正文 draft 数组确为【空数组】[]，符合只生成大纲不生成正文的需求。");
    } else {
      console.error("❌ 验证失败！draft 数组不为空：", result.draft);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 运行测试时遇到异常：", error);
    process.exit(1);
  }
}

runTest();
