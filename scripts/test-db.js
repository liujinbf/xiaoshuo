import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { join } from "path";

async function test() {
  const db = await open({
    filename: join(process.cwd(), "data", "database.sqlite"),
    driver: sqlite3.Database
  });
  
  const rows = await db.all("SELECT id, theme, hook, raw_text FROM inspirations WHERE user_id = 'admin' AND id NOT LIKE 'seed%' LIMIT 3");
  console.log(JSON.stringify(rows, null, 2));
}

test();
