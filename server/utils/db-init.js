import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { join } from "node:path";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { DEFAULT_INSPIRATIONS } from "./default-inspirations.js";
import { DEFAULT_KNOWLEDGE } from "./default-knowledge.js";

let dbPromise = null;

export async function initializeDatabase() {
  if (!dbPromise) {
    dbPromise = open({
      filename: join(process.cwd(), "data", "database.sqlite"),
      driver: sqlite3.Database
    }).then(async (db) => {
      // === 性能优化：WAL 模式 + 缓存配置 ===
      await db.run("PRAGMA journal_mode = WAL");
      await db.run("PRAGMA synchronous = NORMAL");
      await db.run("PRAGMA cache_size = -8000"); // 8MB 页缓存
      await db.run("PRAGMA temp_store = MEMORY");

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

        CREATE TABLE IF NOT EXISTS chapter_embeddings (
          novel_id TEXT NOT NULL,
          chapter_index INTEGER NOT NULL,
          embedding TEXT NOT NULL,
          created_at TEXT,
          PRIMARY KEY (novel_id, chapter_index)
        );

        CREATE TABLE IF NOT EXISTS knowledge_base (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          entity TEXT NOT NULL UNIQUE,
          content TEXT NOT NULL,
          alias TEXT DEFAULT '',
          embedding TEXT,
          created_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
        CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
        CREATE INDEX IF NOT EXISTS idx_novels_user_id ON novels(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_chapter_embeddings_novel ON chapter_embeddings(novel_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_base_entity ON knowledge_base(entity);
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

      // 迁移: 为旧版 knowledge_base 表补加 alias 与 embedding 字段
      const kbCols = await db.all("PRAGMA table_info(knowledge_base)");
      if (!kbCols.some(c => c.name === "alias")) {
        await db.run("ALTER TABLE knowledge_base ADD COLUMN alias TEXT DEFAULT ''");
        console.log("[DB Migration] Added 'alias' column to knowledge_base table");
      }
      if (!kbCols.some(c => c.name === "embedding")) {
        await db.run("ALTER TABLE knowledge_base ADD COLUMN embedding TEXT");
        console.log("[DB Migration] Added 'embedding' column to knowledge_base table");
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
                `INSERT OR IGNORE INTO accounts (user_id, tier, pro_ends_at, data, updated_at) VALUES (?, ?, ?, ?, ?)`,
                [
                  userId,
                  account.tier || 'free',
                  account.proEndsAt || null,
                  JSON.stringify(account),
                  account.updatedAt || new Date().toISOString()
                ]
              );
            }
          }

          if (store.projects) {
            for (const [userId, userProjects] of Object.entries(store.projects)) {
              for (const proj of userProjects) {
                await db.run(
                  `INSERT OR IGNORE INTO projects (id, user_id, title, data, updated_at) VALUES (?, ?, ?, ?, ?)`,
                  [
                    proj.id,
                    userId,
                    proj.input?.theme || proj.title || "未命名项目",
                    JSON.stringify(proj),
                    proj.updatedAt || new Date().toISOString()
                  ]
                );
              }
            }
          }

          if (store.novels) {
            for (const [userId, userNovels] of Object.entries(store.novels)) {
              for (const novel of userNovels) {
                await db.run(
                  `INSERT OR IGNORE INTO novels (id, user_id, title, data, updated_at) VALUES (?, ?, ?, ?, ?)`,
                  [
                    novel.id,
                    userId,
                    novel.title || "未命名连载",
                    JSON.stringify(novel),
                    novel.updatedAt || new Date().toISOString()
                  ]
                );
              }
            }
          }

          if (store.orders) {
            for (const order of store.orders) {
              await db.run(
                `INSERT OR IGNORE INTO orders (id, user_id, status, data, created_at) VALUES (?, ?, ?, ?, ?)`,
                [
                  order.id,
                  order.userId,
                  order.status || 'pending',
                  JSON.stringify(order),
                  order.createdAt || new Date().toISOString()
                ]
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

      // 显式安全地保证 chapter_embeddings 表一定存在
      try {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS chapter_embeddings (
            novel_id TEXT NOT NULL,
            chapter_index INTEGER NOT NULL,
            embedding TEXT NOT NULL,
            created_at TEXT,
            PRIMARY KEY (novel_id, chapter_index)
          );
          CREATE INDEX IF NOT EXISTS idx_chapter_embeddings_novel ON chapter_embeddings(novel_id);
        `);
        console.log("[DB] Ensured chapter_embeddings table exists.");
      } catch (e) {
        console.error("[DB] Ensuring chapter_embeddings table failed:", e);
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

      // 强制同步 DEFAULT_KNOWLEDGE 默认学科常识种子
      try {
        for (const item of DEFAULT_KNOWLEDGE) {
          await db.run(
            "INSERT OR IGNORE INTO knowledge_base (id, category, entity, content, created_at) VALUES (?, ?, ?, ?, ?)",
            [item.id, item.category, item.entity, item.content, new Date().toISOString()]
          );
        }
        console.log("[DB] Synchronized default knowledge base seeds.");
      } catch (e) {
        console.error("[DB] Seeding default knowledge failed:", e);
      }

      return db;
    });
  }
  return dbPromise;
}
