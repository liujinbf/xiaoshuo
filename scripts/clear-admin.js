import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { join } from "path";

async function clear() {
  try {
    const dbPath = join(process.cwd(), "data", "database.sqlite");
    console.log("Opening database at:", dbPath);
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    console.log("Deleting admin inspirations...");
    const res = await db.run("DELETE FROM inspirations WHERE user_id = 'admin'");
    console.log("Deleted rows:", res.changes);
    console.log("Done!");
  } catch (err) {
    console.error("Error clearing database:", err);
  }
}

clear();
