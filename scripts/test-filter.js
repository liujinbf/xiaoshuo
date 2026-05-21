import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'database.sqlite');

function normalizeKnowledgeText(value = "") {
  return String(value)
    .replace(/[|｜/\\.\[\]【】（）(){}<>《》「」『』·*＊_\-—=~～!！^]+/g, "")
    .replace(/\s+/g, "");
}

function isUsableKnowledgeItem(item) {
  const theme = String(item?.theme || "");
  const hook = String(item?.hook || "");
  const outline = String(item?.outline || "");
  if (!theme || !hook || !outline) return { ok: false, reason: "Missing fields" };
  const text = `${theme} ${hook} ${outline}`;
  const normalized = normalizeKnowledgeText(text);
  
  const regexText = /[━─=＿_—\-]{3,}|未知设定|精彩故事|公\s*[|/\\.\[\]（）()【】]*\s*(?:众|主)\s*[|/\\.\[\]（）()【】]*\s*号|闲\s*[|/\\.\[\]（）()【】*＊·\s-]*\s*书|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|来源来自网络/;
  if (regexText.test(text)) {
    const match = text.match(regexText);
    return { ok: false, reason: `Matches spam pattern in raw text: ${match[0]}` };
  }
  
  const regexNorm = /公众号|公主号|闲闲书|闲书|书坊|书荒|推文|后续|完整版|网盘|加群|关注|菜单栏|阅读全文|番外|西图澜娅|来源来自网络/;
  if (regexNorm.test(normalized)) {
    const match = normalized.match(regexNorm);
    return { ok: false, reason: `Matches spam pattern in normalized text: ${match[0]}` };
  }
  
  if (theme.length < 6 || hook.length < 10 || outline.length < 10) {
    return { ok: false, reason: `Length too short: theme=${theme.length}(>=6), hook=${hook.length}(>=10), outline=${outline.length}(>=10)` };
  }
  
  return { ok: true };
}

async function run() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  const inspirations = await db.all("SELECT * FROM inspirations");
  console.log(`Total database entries: ${inspirations.length}`);
  
  let passedCount = 0;
  let failedCount = 0;
  const failReasons = {};
  
  for (const item of inspirations) {
    const res = isUsableKnowledgeItem(item);
    if (res.ok) {
      passedCount++;
    } else {
      failedCount++;
      failReasons[res.reason] = (failReasons[res.reason] || 0) + 1;
      if (failedCount <= 10) {
        console.log(`Failed item [${item.id}] [${item.theme}]: ${res.reason}`);
      }
    }
  }
  
  console.log("\n--- Summary ---");
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log("Fail reasons distribution:", failReasons);
  
  await db.close();
}

run().catch(console.error);
