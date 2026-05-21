import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'database.sqlite');

async function run() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  const inspirations = await db.all("SELECT * FROM inspirations");
  console.log(`Total entries: ${inspirations.length}`);
  
  let errorCount = 0;
  for (const item of inspirations) {
    try {
      // 模拟前端 toLocaleDateString 渲染逻辑
      const date = new Date(item.created_at);
      const str = date.toLocaleDateString();
      if (isNaN(date.getTime())) {
        console.log(`[WARN] Invalid date for item id=${item.id}, created_at=${item.created_at}, but toLocaleDateString() returned="${str}"`);
      }
    } catch (err) {
      errorCount++;
      console.error(`[ERROR] item id=${item.id}, created_at=${item.created_at} threw error:`, err.message);
    }
  }
  
  console.log(`Finished checking. Errors caught: ${errorCount}`);
  await db.close();
}

run().catch(console.error);
