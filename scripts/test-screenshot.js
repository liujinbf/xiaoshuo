import { chromium } from "playwright";
import path from "node:path";

async function run() {
  console.log("正在启动无头浏览器进行页面渲染端到端自动检验...");
  // 通过 channel: "chrome" 避开浏览器二进制缺失报错
  const browser = await chromium.launch({ 
    headless: true,
    channel: "chrome"
  });
  const page = await browser.newPage();
  
  // 设置精美的大视口尺寸
  await page.setViewportSize({ width: 1440, height: 900 });
  
  console.log("正在导航至 http://127.0.0.1:4173 ...");
  await page.goto("http://127.0.0.1:4173");
  
  console.log("模拟用户点击侧边栏「本地数据库」按钮以切换到数据库面板...");
  await page.click('button[data-view-mode="db"]');
  
  console.log("正在等待 SQLite 双数据库渲染装载就绪 (等待 .knowledge-card DOM 元素)...");
  
  // 等待至少一个灵感卡片渲染完成
  await page.waitForSelector("#knowledgeList .knowledge-card", { timeout: 15000 });
  console.log("✔ 检测成功：灵感库卡片已渲染完成！");

  // 等待常识库徽标和实体加载完成
  await page.waitForSelector("#subjectKnowledgeFullList .knowledge-card", { timeout: 15000 });
  console.log("✔ 检测成功：常识库实体卡片已渲染完成！");
  
  // 截屏存放路径为 Artifacts 目录
  const screenshotPath = "C:\\Users\\Administrator\\.gemini\\antigravity-ide\\brain\\768f0ee4-737e-408e-b568-61aee7e40908\\diagnose_screenshot.png";
  console.log("正在捕获当前界面的精细截图...");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log("✔ 截图已成功保存到: " + screenshotPath);
  
  await browser.close();
  console.log("诊断性浏览器交互测试圆满结束！");
}

run().catch((err) => {
  console.error("❌ 自动化渲染截图检测发生错误:", err.message);
  process.exit(1);
});
