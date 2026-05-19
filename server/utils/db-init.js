import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { join } from "node:path";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { DEFAULT_INSPIRATIONS } from "./default-inspirations.js";

let dbPromise = null;

export async function initializeDatabase() {
  if (!dbPromise) {
    dbPromise = open({
      filename: join(process.cwd(), "data", "database.sqlite"),
      driver: sqlite3.Database
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          user_id TEXT PRIMARY KEY,
          tier TEXT DEFAULT 'free',
          pro_ends_at TEXT,
          data TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          title TEXT,
          data TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS novels (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          title TEXT,
          data TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          status TEXT,
          data TEXT,
          created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_snapshots (
          user_id TEXT PRIMARY KEY,
          data TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          password TEXT,
          created_at TEXT,
          role TEXT DEFAULT 'user'
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
        CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
        CREATE INDEX IF NOT EXISTS idx_novels_user_id ON novels(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      `);

      // === 数据库结构迁移 ===
      
      // 迁移: accounts 补充结构化字段
      const accountCols = await db.all("PRAGMA table_info(accounts)");
      if (!accountCols.some(c => c.name === "tier")) {
        await db.run("ALTER TABLE accounts ADD COLUMN tier TEXT DEFAULT 'free'");
        await db.run("ALTER TABLE accounts ADD COLUMN pro_ends_at TEXT");
        console.log("[DB Migration] Added 'tier' and 'pro_ends_at' to accounts");
      }
      await db.exec("CREATE INDEX IF NOT EXISTS idx_accounts_tier ON accounts(tier);");

      // 迁移: projects 补充 title 字段
      const projectCols = await db.all("PRAGMA table_info(projects)");
      if (!projectCols.some(c => c.name === "title")) {
        await db.run("ALTER TABLE projects ADD COLUMN title TEXT");
        console.log("[DB Migration] Added 'title' to projects");
      }

      // 迁移: novels 补充 title 字段
      const novelCols = await db.all("PRAGMA table_info(novels)");
      if (!novelCols.some(c => c.name === "title")) {
        await db.run("ALTER TABLE novels ADD COLUMN title TEXT");
        console.log("[DB Migration] Added 'title' to novels");
      }

      // 迁移: orders 补充 status 字段
      const orderCols = await db.all("PRAGMA table_info(orders)");
      if (!orderCols.some(c => c.name === "status")) {
        await db.run("ALTER TABLE orders ADD COLUMN status TEXT");
        console.log("[DB Migration] Added 'status' to orders");
      }
      await db.exec("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);");

      // 迁移: 为旧版 users 表补加 role 列
      const userCols = await db.all("PRAGMA table_info(users)");
      const hasRole = userCols.some(c => c.name === "role");
      if (!hasRole) {
        await db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
        console.log("[DB Migration] Added 'role' column to users table");
        // 将用户名为 admin 的账号赋予 admin 角色
        await db.run("UPDATE users SET role = 'admin' WHERE username = 'admin'");
        console.log("[DB Migration] Granted admin role to 'admin' user");
      }

      // 迁移: 爆款拆解学习库
      const inspirationCols = await db.all("PRAGMA table_info(inspirations)");
      if (inspirationCols.length === 0) {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS inspirations (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            genre TEXT,
            theme TEXT,
            hook TEXT,
            outline TEXT,
            raw_text TEXT,
            created_at TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_inspirations_user_id ON inspirations(user_id);
        `);
        console.log("[DB Migration] Created 'inspirations' table");

        // 默认灌入爆款小说知识库数据 (以 admin 身份)
        for (const seed of DEFAULT_INSPIRATIONS) {
          await db.run(
            "INSERT OR IGNORE INTO inspirations (id, user_id, genre, theme, hook, outline, raw_text, created_at) VALUES (?, 'admin', ?, ?, ?, ?, ?, ?)",
            [seed.id, seed.genre, seed.theme, seed.hook, seed.outline, seed.raw_text, new Date().toISOString()]
          );
        }
        console.log("[DB Migration] Seeded default hit stories into inspirations table");
      }

      // Migration from store.json
      const storePath = join(process.cwd(), "data", "store.json");
      if (existsSync(storePath)) {
        console.log("[DB] Found legacy store.json, migrating data to SQLite...");
        try {
          const storeStr = readFileSync(storePath, "utf-8");
          const store = JSON.parse(storeStr);

          await db.run("BEGIN TRANSACTION");

          if (store.accounts) {
            for (const [userId, account] of Object.entries(store.accounts)) {
              await db.run(
                `INSERT OR IGNORE INTO accounts (user_id, data, updated_at) VALUES (?, ?, ?)`,
                [userId, JSON.stringify(account), account.updatedAt || new Date().toISOString()]
              );
            }
          }

          if (store.projects) {
            for (const [userId, userProjects] of Object.entries(store.projects)) {
              for (const proj of userProjects) {
                await db.run(
                  `INSERT OR IGNORE INTO projects (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)`,
                  [proj.id, userId, JSON.stringify(proj), proj.updatedAt || new Date().toISOString()]
                );
              }
            }
          }

          if (store.novels) {
            for (const [userId, userNovels] of Object.entries(store.novels)) {
              for (const novel of userNovels) {
                await db.run(
                  `INSERT OR IGNORE INTO novels (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)`,
                  [novel.id, userId, JSON.stringify(novel), novel.updatedAt || new Date().toISOString()]
                );
              }
            }
          }

          if (store.orders) {
            for (const order of store.orders) {
              await db.run(
                `INSERT OR IGNORE INTO orders (id, user_id, data, created_at) VALUES (?, ?, ?, ?)`,
                [order.id, order.userId, JSON.stringify(order), order.createdAt || new Date().toISOString()]
              );
            }
          }

          await db.run("COMMIT");

          const backupPath = join(process.cwd(), "data", `store.backup.${Date.now()}.json`);
          renameSync(storePath, backupPath);
          console.log(`[DB] Migration complete. Legacy store backed up to ${backupPath}`);
        } catch (err) {
          console.error("[DB] Migration failed:", err);
          await db.run("ROLLBACK").catch(() => {});
        }
      }

      // 强制为任何未初始化的实例灌入种子默认灵感库（以 admin 身份）
      try {
        // 增量同步：将 DEFAULT_INSPIRATIONS 数组中的每个默认写作模型以 INSERT OR IGNORE 存入，
        // 确保新加入的题材（如大女主爽文、中式志异等）能在启动时自动完成冷启动同步，且不破坏已有数据。
        for (const seed of DEFAULT_INSPIRATIONS) {
          await db.run(
            "INSERT OR IGNORE INTO inspirations (id, user_id, genre, theme, hook, outline, raw_text, created_at) VALUES (?, 'admin', ?, ?, ?, ?, ?, ?)",
            [seed.id, seed.genre, seed.theme, seed.hook, seed.outline, seed.raw_text, new Date().toISOString()]
          );
        }
        console.log("[DB] Synchronized default admin hit story inspirations.");
      } catch (e) {
        console.error("[DB] Seeding default templates failed:", e);
      }

            return db;
      return db;
    });
  }
  return dbPromise;
}
