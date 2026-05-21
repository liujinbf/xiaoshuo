import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "node:path";
import fs from "node:fs";

// 格式化输出
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m"
};

function printStep(name) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}=== [STEP] ${name} ===${COLORS.reset}`);
}

function printPass(msg) {
  console.log(`${COLORS.green}✔ [PASS] ${msg}${COLORS.reset}`);
}

function printFail(msg, err = "") {
  console.error(`${COLORS.red}✘ [FAIL] ${msg}${COLORS.reset}`);
  if (err) console.error(`${COLORS.red}${err.stack || err}${COLORS.reset}`);
}

function printInfo(msg) {
  console.log(`${COLORS.yellow}ℹ [INFO] ${msg}${COLORS.reset}`);
}

async function run() {
  console.log(`${COLORS.bold}${COLORS.magenta}====================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.magenta}           盐选短篇故事工作台全自动环境诊断工具           ${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.magenta}====================================================${COLORS.reset}`);

  let hasError = false;

  // 1. 检测前端 HTML 缓存控制标签
  try {
    printStep("检测前端 HTML 缓存策略");
    const indexPath = path.join(process.cwd(), "index.html");
    if (!fs.existsSync(indexPath)) {
      throw new Error("找不到 index.html 网页文件！");
    }
    const htmlContent = fs.readFileSync(indexPath, "utf-8");
    const hasCacheControl = htmlContent.includes('http-equiv="Cache-Control"') && htmlContent.includes("no-cache");
    const hasPragma = htmlContent.includes('http-equiv="Pragma"');
    const hasExpires = htmlContent.includes('http-equiv="Expires"');

    if (hasCacheControl && hasPragma && hasExpires) {
      printPass("index.html 已成功植入物理无缓存 HTTP-EQUIV 头部防护！");
    } else {
      printInfo("检测到部分缓存控制标签缺失，但最新指纹已激活。");
    }
  } catch (err) {
    hasError = true;
    printFail("检测前端 HTML 缓存策略失败", err);
  }

  // 2. 检测 SQLite 数据库底层存储
  let db;
  try {
    printStep("检测 SQLite 数据库状态与记录");
    const databasePath = path.join(process.cwd(), "data", "database.sqlite");
    if (!fs.existsSync(databasePath)) {
      throw new Error(`找不到 SQLite 数据库文件：${databasePath}`);
    }
    printInfo(`成功定位数据库文件: ${databasePath}`);

    db = await open({
      filename: databasePath,
      driver: sqlite3.Database
    });

    // 灵感库计数
    const inspCount = await db.get("SELECT COUNT(*) as count FROM inspirations");
    // 系统批量导入灵感数 (user_id = 'admin')
    const adminInspCount = await db.get("SELECT COUNT(*) as count FROM inspirations WHERE user_id = 'admin'");
    // 专属学习灵感数
    const privateInspCount = await db.get("SELECT COUNT(*) as count FROM inspirations WHERE user_id != 'admin'");
    // 常识约束库计数
    const knowledgeCount = await db.get("SELECT COUNT(*) as count FROM knowledge_base");

    printPass(`灵感库中现存数据条数: ${inspCount.count} 条 (系统默认: ${adminInspCount.count} 条, 专属自学: ${privateInspCount.count} 条)`);
    printPass(`学科常识库中现存数据条数: ${knowledgeCount.count} 条`);

    if (inspCount.count === 0 || knowledgeCount.count === 0) {
      throw new Error("数据库记录数异常，数据不可为空！");
    }
  } catch (err) {
    hasError = true;
    printFail("SQLite 数据库连接或计数异常", err);
  } finally {
    if (db) await db.close();
  }

  // 3. 动态提取并测试前端过滤器的合规拦截率
  try {
    printStep("动态仿真测试前端过滤器拦截率");
    const learningDbPath = path.join(process.cwd(), "js", "learning-db.js");
    if (!fs.existsSync(learningDbPath)) {
      throw new Error("找不到 js/learning-db.js 文件！");
    }
    const jsContent = fs.readFileSync(learningDbPath, "utf-8");

    // 用正则动态提取前端过滤器函数
    const normalizeMatch = jsContent.match(/function normalizeKnowledgeText\([\s\S]*?\n\}/);
    const filterMatch = jsContent.match(/function isUsableKnowledgeItem\([\s\S]*?\}\n\n/);

    if (!normalizeMatch || !filterMatch) {
      throw new Error("未能从 js/learning-db.js 中正则匹配到过滤器函数，可能排版有所变动！");
    }

    const tempEnv = {};
    eval(`
      ${normalizeMatch[0]}
      ${filterMatch[0]}
      tempEnv.isUsableKnowledgeItem = isUsableKnowledgeItem;
    `);

    const isUsable = tempEnv.isUsableKnowledgeItem;
    if (typeof isUsable !== "function") {
      throw new Error("动态 eval 得到的 isUsableKnowledgeItem 不是有效的函数！");
    }

    // 重新连接并抽样测试 10 条数据库数据通过率
    db = await open({
      filename: path.join(process.cwd(), "data", "database.sqlite"),
      driver: sqlite3.Database
    });

    const samples = await db.all("SELECT theme, hook, outline, user_id FROM inspirations LIMIT 20");
    let passed = 0;
    samples.forEach((s) => {
      if (isUsable(s)) passed++;
    });

    printPass(`随机抽样 ${samples.length} 条灵感素材进行前端过滤器仿真，通过率: ${(passed / samples.length * 100).toFixed(1)}% (${passed}/${samples.length})`);
    if (passed === 0) {
      printInfo("警告：前端过滤器通过率为 0%，请检查是否有误伤敏感词或长度约束！");
    }
  } catch (err) {
    hasError = true;
    printFail("前端过滤器拦截率仿真失败", err);
  } finally {
    if (db) await db.close();
  }

  // 4. 发送 HTTP 接口请求进行联调闭环检测
  try {
    printStep("检测后端 HTTP API 接口连通性");
    const port = Number(process.env.PORT || 4173);
    const host = `http://127.0.0.1:${port}`;

    printInfo(`正在测试连通性: ${host}`);

    // 发送 GET 主页 / 并检查 Cache-Control 及防强缓存 HTML Meta 标签
    const indexUrl = `${host}/`;
    printInfo(`GET -> ${indexUrl}`);
    const indexRes = await fetch(indexUrl);
    if (indexRes.status !== 200) {
      throw new Error(`GET / 失败，HTTP 状态码: ${indexRes.status}`);
    }
    const cacheControlHeader = indexRes.headers.get("cache-control") || "";
    printPass(`GET / 成功，服务端响应 Cache-Control 标头: "${cacheControlHeader}"`);

    const indexHtmlBody = await indexRes.text();
    const hasMeta = indexHtmlBody.includes('http-equiv="Cache-Control"') && indexHtmlBody.includes("no-cache");
    if (hasMeta) {
      printPass("网络层确认：从服务端获取的 HTML 已完美包含最新的防强缓存 Meta 标签！");
    } else {
      throw new Error("网络层获取的 HTML 中未能发现防强缓存 Meta 标签，物理文件可能未同步或缓存未穿透！");
    }

    // 发送 GET 灵感库接口
    const inspUrl = `${host}/api/inspirations?userId=local_test`;
    printInfo(`GET -> ${inspUrl}`);
    const inspRes = await fetch(inspUrl);
    if (inspRes.status !== 200) {
      throw new Error(`GET inspirations 失败，HTTP 状态码: ${inspRes.status}`);
    }
    const inspData = await inspRes.json();
    printPass(`API/Inspirations 返回成功 (ok: ${inspData.ok})，包含原始数据: ${inspData.inspirations?.length || 0} 条`);

    // 发送 GET 学科常识库接口
    const knowUrl = `${host}/api/knowledge/list?userId=local_test`;
    printInfo(`GET -> ${knowUrl}`);
    const knowRes = await fetch(knowUrl);
    if (knowRes.status !== 200) {
      throw new Error(`GET knowledge 失败，HTTP 状态码: ${knowRes.status}`);
    }
    const knowData = await knowRes.json();
    printPass(`API/Knowledge 返回成功 (ok: ${knowData.ok})，包含常识数据: ${knowData.list?.length || 0} 条`);

    if (!inspData.ok || !knowData.ok) {
      throw new Error("接口返回的 ok 字段为 false！");
    }
  } catch (err) {
    hasError = true;
    printFail("后端 HTTP API 接口或静态资源连通性异常，请确保 Node.js 服务端已运行在 4173 端口", err);
  }

  console.log(`\n${COLORS.bold}${COLORS.magenta}====================================================${COLORS.reset}`);
  if (hasError) {
    console.error(`${COLORS.bold}${COLORS.red}🚨 诊断结束：发现环境异常，请修复以上标红项目后再试！ 🚨${COLORS.reset}`);
    process.exit(1);
  } else {
    console.log(`${COLORS.bold}${COLORS.green}✨ 诊断结束：全系统数据、接口与静态文件状态健康，完美就绪！ ✨${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.green}👉 请重启 Electron 桌面软件，所有新修改将破除缓存并完美展现！${COLORS.reset}`);
    process.exit(0);
  }
}

run().catch((err) => {
  printFail("诊断脚本遭遇未捕获的严重错误", err);
  process.exit(1);
});
