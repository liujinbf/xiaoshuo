import { initializeDatabase } from "./db-init.js";

export async function getDb() {
  return initializeDatabase();
}

export async function getUserAccount(userId) {
  const db = await getDb();
  const row = await db.get("SELECT data FROM accounts WHERE user_id = ?", [userId]);
  return row ? JSON.parse(row.data) : null;
}

export async function saveUserAccount(userId, account) {
  const db = await getDb();
  await db.run(
    `INSERT INTO accounts (user_id, tier, pro_ends_at, data, updated_at) VALUES (?, ?, ?, ?, ?) 
     ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier, pro_ends_at=excluded.pro_ends_at, data=excluded.data, updated_at=excluded.updated_at`,
    [
      userId,
      account.tier || 'free',
      account.proEndsAt || null,
      JSON.stringify(account),
      account.updatedAt || new Date().toISOString()
    ]
  );
}

export async function getUserProjects(userId) {
  const db = await getDb();
  const rows = await db.all("SELECT data FROM projects WHERE user_id = ? ORDER BY updated_at DESC", [userId]);
  return rows.map(r => JSON.parse(r.data));
}

export async function saveUserProjects(userId, projects) {
  const db = await getDb();
  try {
    await db.run("BEGIN TRANSACTION");
    await db.run("DELETE FROM projects WHERE user_id = ?", [userId]);
    for (const proj of projects) {
      await db.run(
        "INSERT INTO projects (id, user_id, title, data, updated_at) VALUES (?, ?, ?, ?, ?)",
        [
          proj.id,
          userId,
          proj.input?.theme || proj.title || "未命名项目",
          JSON.stringify(proj),
          proj.updatedAt || new Date().toISOString()
        ]
      );
    }
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
}

export async function getUserNovels(userId) {
  const db = await getDb();
  const rows = await db.all("SELECT data FROM novels WHERE user_id = ? ORDER BY updated_at DESC", [userId]);
  return rows.map(r => JSON.parse(r.data));
}

export async function saveNovel(userId, novel) {
  const db = await getDb();
  await db.run(
    `INSERT INTO novels (id, user_id, title, data, updated_at) VALUES (?, ?, ?, ?, ?) 
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, data=excluded.data, updated_at=excluded.updated_at`,
    [
      novel.id,
      userId,
      novel.title || "未命名连载",
      JSON.stringify(novel),
      novel.updatedAt || new Date().toISOString()
    ]
  );
}

export async function deleteNovel(userId, novelId) {
  const db = await getDb();
  await db.run("DELETE FROM novels WHERE id = ? AND user_id = ?", [novelId, userId]);
}

export async function getOrders(userId) {
  const db = await getDb();
  const rows = await db.all("SELECT data FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [userId]);
  return rows.map(r => JSON.parse(r.data));
}

export async function saveOrder(order) {
  const db = await getDb();
  await db.run(
    `INSERT INTO orders (id, user_id, status, data, created_at) VALUES (?, ?, ?, ?, ?)`,
    [
      order.id,
      order.userId,
      order.status || 'pending',
      JSON.stringify(order),
      order.createdAt || new Date().toISOString()
    ]
  );
}

export async function getUserByUsername(username) {
  const db = await getDb();
  return await db.get("SELECT * FROM users WHERE username = ?", [username]);
}

export async function createUser(id, username, password) {
  const db = await getDb();
  await db.run(
    "INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)",
    [id, username, password, new Date().toISOString()]
  );
}

export async function updateUserPassword(userId, password) {
  const db = await getDb();
  await db.run("UPDATE users SET password = ? WHERE id = ?", [password, userId]);
}

export async function getUserSyncData(userId) {
  const db = await getDb();
  const row = await db.get("SELECT data FROM sync_snapshots WHERE user_id = ?", [userId]);
  return row ? JSON.parse(row.data) : null;
}

export async function saveUserSyncData(userId, syncData) {
  const db = await getDb();
  await db.run(
    `INSERT INTO sync_snapshots (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
    [userId, JSON.stringify(syncData), new Date().toISOString()]
  );
}

export async function getSetting(key) {
  const db = await getDb();
  const row = await db.get("SELECT value FROM settings WHERE key = ?", [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return row.value;
  }
}

export async function saveSetting(key, value) {
  const db = await getDb();
  const valStr = typeof value === "object" ? JSON.stringify(value) : value;
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
    [key, valStr, valStr]
  );
}

export async function saveInspiration(id, userId, genre, theme, hook, outline, rawText, fingerprint = null) {
  const db = await getDb();
  await db.run(
    `INSERT INTO inspirations (id, user_id, genre, theme, hook, outline, raw_text, fingerprint, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET fingerprint=excluded.fingerprint`,
    [id, userId, genre, theme, hook, outline, rawText, fingerprint, new Date().toISOString()]
  );
}


export async function getInspirations(userId) {
  const db = await getDb();
  if (!userId || userId === 'admin') {
    return await db.all("SELECT * FROM inspirations WHERE user_id = 'admin' ORDER BY created_at DESC");
  }
  // 智能合并：返回用户专属拆解 + admin 批量吸收库，并按创建时间倒序
  return await db.all(
    "SELECT * FROM inspirations WHERE user_id = ? OR user_id = 'admin' ORDER BY created_at DESC",
    [userId]
  );
}

export async function deleteInspiration(userId, inspirationId) {
  const db = await getDb();
  await db.run("DELETE FROM inspirations WHERE id = ? AND user_id = ?", [inspirationId, userId]);
}

/**
 * 清空用户的所有素材（不含 admin 系统素材）
 * @param {string} userId
 * @param {boolean} includeAdmin - 是否同时清空 admin 批量素材（仅管理员可用）
 * @returns {Promise<number>} 实际删除的条数
 */
export async function clearInspirations(userId, includeAdmin = false) {
  const db = await getDb();
  if (includeAdmin && userId === "admin") {
    const result = await db.run("DELETE FROM inspirations");
    return result.changes ?? 0;
  }
  const result = await db.run(
    "DELETE FROM inspirations WHERE user_id = ?",
    [userId]
  );
  return result.changes ?? 0;
}

// ===== chapter_embeddings — 向量嵌入独立存储 =====

/**
 * 保存或更新章节嵌入向量
 * @param {string} novelId
 * @param {number} chapterIndex
 * @param {number[]} embedding - 浮点数组
 */
export async function saveChapterEmbedding(novelId, chapterIndex, embedding) {
  const db = await getDb();
  await db.run(
    `INSERT INTO chapter_embeddings (novel_id, chapter_index, embedding, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(novel_id, chapter_index) DO UPDATE SET embedding = excluded.embedding`,
    [novelId, chapterIndex, JSON.stringify(embedding), new Date().toISOString()]
  );
}

/**
 * 获取指定小说所有章节的嵌入向量
 * @param {string} novelId
 * @returns {Promise<Array<{chapterIndex: number, embedding: number[]}>>}
 */
export async function getChapterEmbeddings(novelId) {
  const db = await getDb();
  const rows = await db.all(
    "SELECT chapter_index, embedding FROM chapter_embeddings WHERE novel_id = ? ORDER BY chapter_index ASC",
    [novelId]
  );
  return rows.map(r => ({
    chapterIndex: r.chapter_index,
    embedding: JSON.parse(r.embedding)
  }));
}

/**
 * 删除小说的全部章节嵌入向量（删除小说时调用）
 * @param {string} novelId
 */
export async function deleteChapterEmbeddings(novelId) {
  const db = await getDb();
  await db.run("DELETE FROM chapter_embeddings WHERE novel_id = ?", [novelId]);
}

// ===== 自动关联学科知识库相关查询 =====

/**
 * 获取所有的知识库列表
 * @returns {Promise<Array<{id: string, category: string, entity: string, content: string}>>}
 */
export async function getAllKnowledge() {
  const db = await getDb();
  return await db.all("SELECT * FROM knowledge_base ORDER BY created_at DESC");
}

/**
 * 根据实体列表获取知识库内容
 * @param {string[]} entities
 * @returns {Promise<Array<{id: string, category: string, entity: string, content: string}>>}
 */
export async function getKnowledgeByEntities(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return [];
  const db = await getDb();
  const placeholders = entities.map(() => "?").join(",");
  return await db.all(
    `SELECT * FROM knowledge_base WHERE entity IN (${placeholders})`,
    entities
  );
}

/**
 * 保存或更新知识库实体常识
 */
export async function saveKnowledge(category, entity, content, alias = "", embedding = null) {
  const db = await getDb();
  const id = `kb_${category}_${Date.now()}`;
  const embVal = embedding ? (typeof embedding === "string" ? embedding : JSON.stringify(embedding)) : null;
  await db.run(
    `INSERT INTO knowledge_base (id, category, entity, content, alias, embedding, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity) DO UPDATE SET category=excluded.category, content=excluded.content, alias=excluded.alias, embedding=excluded.embedding`,
    [id, category, entity, content, alias || "", embVal, new Date().toISOString()]
  );
}

// ===== genre_trends — 小说题材趋势库独占接口 =====

/**
 * 保存或更新热门题材趋势
 */
export async function saveGenreTrend({ id, source, novel_title, raw_genre, mapped_genre, heat_score, analysis, introduction }) {
  const db = await getDb();
  await db.run(
    `INSERT INTO genre_trends (id, source, novel_title, raw_genre, mapped_genre, heat_score, analysis, introduction, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET source=excluded.source, novel_title=excluded.novel_title, raw_genre=excluded.raw_genre, mapped_genre=excluded.mapped_genre, heat_score=excluded.heat_score, analysis=excluded.analysis, introduction=excluded.introduction`,
    [
      id,
      source,
      novel_title,
      raw_genre || "",
      mapped_genre || "",
      heat_score || 0,
      typeof analysis === "object" ? JSON.stringify(analysis) : (analysis || ""),
      introduction || "",
      new Date().toISOString()
    ]
  );
}

/**
 * 获取题材趋势列表，支持按 source 与 mapped_genre 双维度过滤
 */
export async function getGenreTrends(source, mappedGenre) {
  const db = await getDb();
  let query = "SELECT * FROM genre_trends WHERE 1=1";
  const params = [];

  if (source && source !== "all") {
    query += " AND source = ?";
    params.push(source);
  }
  if (mappedGenre && mappedGenre !== "all") {
    query += " AND mapped_genre = ?";
    params.push(mappedGenre);
  }

  query += " ORDER BY heat_score DESC, created_at DESC";
  return await db.all(query, params);
}

/**
 * 获取单条题材趋势记录
 */
export async function getGenreTrendById(id) {
  const db = await getDb();
  return await db.get("SELECT * FROM genre_trends WHERE id = ?", [id]);
}

/**
 * 清空题材趋势库中的所有数据
 */
export async function clearGenreTrends() {
  const db = await getDb();
  await db.run("DELETE FROM genre_trends");
}

