#!/usr/bin/env node
/**
 * ============================================================
 * 批量小说导入 + 深层指纹提取器 v2.1
 * 运行: node scripts/batch-import-novels.mjs [目录] [--dry-run] [--skip-ai] [--resume] [--limit N]
 * ============================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'database.sqlite');

// ─── 命令行参数 ──────────────────────────────────────────────
const args      = process.argv.slice(2);
const novelDir  = args[0] || 'D:\\下载\\小说【网盘直下】\\小说文包\\晋江前100';
const DRY_RUN   = args.includes('--dry-run');
const SKIP_AI   = args.includes('--skip-ai');
const RESUME    = args.includes('--resume');
const LIMIT     = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1]) || 0 : 0; })();

// ─── AI 配置（命令行 > 数据库 > .env）──────────────────────
async function loadAIConfig() {
  // 1. 命令行直接传入（最优先）
  const argKey  = (() => { const i = args.indexOf('--api-key');  return i >= 0 ? args[i + 1] : ''; })();
  const argBase = (() => { const i = args.indexOf('--base-url'); return i >= 0 ? args[i + 1] : ''; })();
  const argModel= (() => { const i = args.indexOf('--model');    return i >= 0 ? args[i + 1] : ''; })();
  if (argKey && argKey.length > 10) {
    return {
      apiKey:  argKey,
      baseUrl: (argBase || 'https://api.openai.com').replace(/\/+$/, ''),
      model:   argModel || 'gpt-4o-mini',
    };
  }

  // 2. 从 .env 读取
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const env = {};
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"#\n]*)"?/);
      if (m) env[m[1]] = m[2].trim();
    }
    const key = env.AI_API_KEY || env.OPENAI_API_KEY || '';
    if (key && key.length > 10 && !key.includes('your-api') && !key.includes('sk-your')) {
      return {
        apiKey:  key,
        baseUrl: (env.AI_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, ''),
        model:   env.AI_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini',
      };
    }
  }

  return { apiKey: '', baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' };
}


// ─── 题材检测 ────────────────────────────────────────────────
const GENRE_KEYWORDS = {
  suspense:  ['悬疑','推理','侦探','案件','死亡','谋杀','失踪','证据'],
  revenge:   ['复仇','出轨','离婚','婚恋','前夫','渣男','婆婆','背叛'],
  heroine:   ['大女主','女帝','女强','商战','总裁','集团','CEO','爽文'],
  family:    ['家庭','年代','七十年代','六十年代','五十年代','世情','家族','原生'],
  folklore:  ['志怪','民俗','鬼怪','神话','古代','封建','祠堂','仙侠'],
  history:   ['历史','穿越','架空','宫廷','皇帝','朝代','汉武','秦始'],
  rules:     ['规则','怪谈','无限','游戏','副本','任务','系统','末世'],
  workplace: ['职场','公司','职业','审计','HR','商界'],
  romance:   ['爱情','甜宠','言情','青梅','竹马','校园','初恋'],
};

function detectGenre(title, rawText) {
  const sample = (title + rawText.slice(0, 500)).toLowerCase();
  let best = 'romance', bestScore = 0;
  for (const [genre, kws] of Object.entries(GENRE_KEYWORDS)) {
    const score = kws.filter(k => sample.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = genre; }
  }
  return best;
}

// ─── 广告行检测 ──────────────────────────────────────────────
const AD_PATTERNS = [
  /={3,}/,
  /[-─━]{3,}/,
  /更多.*?(小说|网盘|资源).*?(http|www|\.com|\.cn)/i,
  /关注|公众号|公主号|微信|闲闲书|书坊|推文|后续|完整版|网盘|加群|阅读全文/,
  /感谢.*?(投出|灌溉|小天使)/,
  /感谢在.*?期间.*?投出/,
  /作者有话要说/,
  /营养液|霸王票|地雷|手榴弹/,
  /^(http|www)[^\n]{3,}/im,
  /非常感谢大家对我的支持/,
  /搜索关键字|内容标签|一句话简介|立意：/,
];

function isAdLine(line) {
  const t = line.trim();
  if (!t) return false;
  return AD_PATTERNS.some(p => p.test(t));
}

// ─── 文本清洗（保留正文，过滤广告/注记）────────────────────
function cleanNovelText(raw) {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cleaned = [];
  let inAuthorNote = false;
  let headerDone   = false;

  for (const line of lines) {
    const t = line.trim();

    // 章节标题识别（支持多种格式）
    const isChapter =
      /^第[零一二三四五六七八九十百千\d]+章/.test(t) ||
      /^【第[零一二三四五六七八九十百千\d]+章/.test(t) ||
      /^Chapter\s*\d+/i.test(t) ||
      /^序章$|^楔子$|^尾声$|^后记$/.test(t);

    if (isChapter) {
      headerDone   = true;
      inAuthorNote = false;
      cleaned.push(t);
      continue;
    }

    if (!headerDone) continue;

    if (t.includes('作者有话要说')) { inAuthorNote = true; continue; }
    if (inAuthorNote) continue;
    if (isAdLine(line)) continue;
    if (t) cleaned.push(t.replace(/^[　\s]+/, ''));
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// 提取前 N 章用于 AI 分析
function extractFirstChapters(text, n = 3) {
  const re = /(?=第[零一二三四五六七八九十百千\d]+章|Chapter\s*\d+|序章|楔子)/i;
  const parts = text.split(re);
  return parts.slice(0, n + 1).join('\n\n').slice(0, 4000);
}

// ─── AI 指纹提取 Prompt ──────────────────────────────────────
const SYSTEM_FINGERPRINT = `你是专业网文结构分析师。对下列小说开篇做量化分析，只输出 JSON，不加任何解释或 markdown。

{
  "genre": "题材英文标签：suspense/revenge/heroine/family/folklore/history/rules/workplace/romance",
  "openingSpeed": "1-5整数（1=极慢铺垫，5=第一句就切入冲突）",
  "voiceStyle": "第一人称沉浸/第三人称近视角/第三人称全知",
  "dialogueRatio": "0-100整数（对话占正文百分比估计）",
  "sentenceStyle": "极短句主导/短长混合/长句为主",
  "firstConflictAt": "整数（第几句出现第一个冲突或悬念）",
  "pressureType": "金钱/名声/情感/职权/规则代价/生命威胁（多选用+连接）",
  "emotionTone": "克制冷静/张扬浓烈/幽默讽刺/悲凉沉郁/轻松甜蜜",
  "sceneType": "最常见场景类型（如：家庭餐桌/职场会议室/古代宫廷）",
  "endingHook": "动作断章/台词断章/发现断章/悬念留白/情感余韵",
  "powerPhrases": ["原文中最有冲击力的3句话，必须是原文真实摘抄"],
  "uniqueVocab": ["这本书特有的高频核心词，最多5个"],
  "theme": "一句话概括核心矛盾（30字内）",
  "hook": "提炼开篇钩子公式（60字内，含【主角】【秘密】等占位符）",
  "outline": "起承转合骨架，分号分隔，每步10字内",
  "rawSample": "原文最精彩一段（200字内，必须原文）"
}`;

const getChatUrl = (baseUrl) => {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
};

async function extractFingerprint(sample, title, aiCfg) {
  if (!aiCfg.apiKey || SKIP_AI) return null;

  const userMsg = `书名：${title}\n\n【开篇节选】\n${sample}`;

  try {
    const res = await fetch(getChatUrl(aiCfg.baseUrl), {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${aiCfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    aiCfg.model,
        messages: [
          { role: 'system', content: SYSTEM_FINGERPRINT },
          { role: 'user',   content: userMsg },
        ],
        max_tokens: 1200,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw  = data?.choices?.[0]?.message?.content || '';
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(jsonStr);

  } catch (err) {
    console.warn(`  [AI] ${title}: ${err.message}`);
    return null;
  }
}

// ─── 数据库 ──────────────────────────────────────────────────
async function getDb() {
  return open({ filename: DB_PATH, driver: sqlite3.Database });
}

async function ensureSchema(db) {
  const cols = (await db.all('PRAGMA table_info(inspirations)')).map(c => c.name);
  if (!cols.includes('fingerprint'))  await db.run('ALTER TABLE inspirations ADD COLUMN fingerprint TEXT');
  if (!cols.includes('source_file'))  await db.run('ALTER TABLE inspirations ADD COLUMN source_file TEXT');
  if (!cols.includes('word_count'))   await db.run('ALTER TABLE inspirations ADD COLUMN word_count INTEGER DEFAULT 0');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS genre_statistics (
      genre TEXT PRIMARY KEY, stats TEXT NOT NULL, sample_count INTEGER DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS import_log (
      source_file TEXT PRIMARY KEY, status TEXT, error TEXT, processed_at TEXT
    );
  `);
}

async function isImported(db, file) {
  if (!RESUME) return false;
  const row = await db.get('SELECT status FROM import_log WHERE source_file = ?', [file]);
  return row?.status === 'success';
}

async function logImport(db, file, status, error = null) {
  await db.run(
    `INSERT INTO import_log (source_file, status, error, processed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(source_file) DO UPDATE SET status=excluded.status, error=excluded.error, processed_at=excluded.processed_at`,
    [file, status, error, new Date().toISOString()]
  );
}

async function saveInspiration(db, rec) {
  await db.run(
    `INSERT INTO inspirations (id, user_id, genre, theme, hook, outline, raw_text, fingerprint, source_file, word_count, created_at)
     VALUES (?, 'admin', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [rec.id, rec.genre, rec.theme, rec.hook, rec.outline, rec.rawText,
     rec.fingerprint ? JSON.stringify(rec.fingerprint) : null,
     rec.sourceFile, rec.wordCount, new Date().toISOString()]
  );
}

async function updateStats(db, genre, fp) {
  const row = await db.get('SELECT stats, sample_count FROM genre_statistics WHERE genre = ?', [genre]);
  const cnt = (row?.sample_count || 0) + 1;
  const s   = row ? JSON.parse(row.stats) : {
    openingSpeedSum: 0, dialogueRatioSum: 0, firstConflictAtSum: 0,
    voiceStyles: {}, sentenceStyles: {}, emotionTones: {}, pressureTypes: {},
    endingHooks: {}, sceneTypes: {}, powerPhrases: [], uniqueVocabs: [],
  };

  s.openingSpeedSum    += Number(fp.openingSpeed)    || 0;
  s.dialogueRatioSum   += Number(fp.dialogueRatio)   || 0;
  s.firstConflictAtSum += Number(fp.firstConflictAt) || 0;

  const incr = (obj, key) => { if (key) obj[key] = (obj[key] || 0) + 1; };
  incr(s.voiceStyles, fp.voiceStyle); incr(s.sentenceStyles, fp.sentenceStyle);
  incr(s.emotionTones, fp.emotionTone); incr(s.endingHooks, fp.endingHook);
  incr(s.sceneTypes, fp.sceneType);
  (fp.pressureType || '').split(/[+|，,]/).forEach(pt => incr(s.pressureTypes, pt.trim()));

  if (Array.isArray(fp.powerPhrases))
    s.powerPhrases = [...new Set([...s.powerPhrases, ...fp.powerPhrases])].slice(0, 60);
  if (Array.isArray(fp.uniqueVocab))
    s.uniqueVocabs = [...new Set([...s.uniqueVocabs, ...fp.uniqueVocab])].slice(0, 100);

  await db.run(
    `INSERT INTO genre_statistics (genre, stats, sample_count, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(genre) DO UPDATE SET stats=excluded.stats, sample_count=excluded.sample_count, updated_at=excluded.updated_at`,
    [genre, JSON.stringify(s), cnt, new Date().toISOString()]
  );
}

// ─── 主流程 ──────────────────────────────────────────────────
async function main() {
  const aiCfg = await loadAIConfig();

  console.log('═══════════════════════════════════════════════════');
  console.log(' 批量小说指纹提取器 v2.1');
  console.log(` 目录 : ${novelDir}`);
  console.log(` 模型 : ${aiCfg.model}  (${aiCfg.baseUrl})`);
  console.log(` Key  : ${aiCfg.apiKey ? '✅ 已加载' : '❌ 未找到 → 只做基础清洗'}`);
  console.log(` 参数 : DryRun=${DRY_RUN}  SkipAI=${SKIP_AI}  Resume=${RESUME}  Limit=${LIMIT || '全部'}`);
  console.log('═══════════════════════════════════════════════════\n');

  if (!fs.existsSync(novelDir)) { console.error(`❌ 目录不存在: ${novelDir}`); process.exit(1); }

  const files = fs.readdirSync(novelDir).filter(f => f.endsWith('.txt')).map(f => path.join(novelDir, f));
  const total = LIMIT > 0 ? Math.min(LIMIT, files.length) : files.length;
  console.log(`📚 发现 ${files.length} 个文件，本次处理 ${total} 个\n`);

  if (DRY_RUN) {
    files.slice(0, 5).forEach(f => console.log('  -', path.basename(f)));
    return;
  }

  const db = await getDb();
  await ensureSchema(db);

  let ok = 0, skip = 0, fail = 0, noAI = 0;
  const t0 = Date.now();

  for (let i = 0; i < total; i++) {
    const filePath = files[i];
    const fileName = path.basename(filePath);
    const tag      = `[${i + 1}/${total}]`;

    if (await isImported(db, fileName)) {
      console.log(`${tag} ⏭️  已导入 → ${fileName.slice(0, 40)}`); skip++; continue;
    }

    console.log(`\n${tag} 📖 ${fileName.slice(0, 52)}`);

    try {
      // 读取（自动检测 UTF-8 / GBK 编码）
      const rawBuf = fs.readFileSync(filePath);
      // 检测是否有 UTF-8 BOM 或内容是否为有效 UTF-8
      let raw;
      const hasBOM = rawBuf[0] === 0xEF && rawBuf[1] === 0xBB && rawBuf[2] === 0xBF;
      if (hasBOM) {
        raw = rawBuf.slice(3).toString('utf-8');
      } else {
        const utf8Attempt = rawBuf.toString('utf-8');
        // 如果 UTF-8 解码后出现大量替换字符（乱码），则改用 GBK
        const invalidRatio = (utf8Attempt.match(/\uFFFD/g) || []).length / Math.max(utf8Attempt.length, 1);
        if (invalidRatio > 0.001) {
          raw = iconv.decode(rawBuf, 'gbk');
          console.log('   编码: GBK → 已转换');
        } else {
          raw = utf8Attempt;
        }
      }


      const rawLen = raw.replace(/\s/g, '').length;
      process.stdout.write(`   原始 ${rawLen.toLocaleString()} → `);

      // 清洗
      const cleaned  = cleanNovelText(raw);
      const cleanLen = cleaned.replace(/\s/g, '').length;
      console.log(`清洗后 ${cleanLen.toLocaleString()} 字  (过滤 ${((rawLen - cleanLen) / rawLen * 100).toFixed(1)}% 广告)`);

      if (cleanLen < 3000) {
        console.log('   ⚠️  正文不足，跳过（章节格式可能未被识别）');
        await logImport(db, fileName, 'skipped', `正文 ${cleanLen} 字`); skip++; continue;
      }

      // 标题
      const title = fileName.replace(/\.txt$/, '').replace(/（精校版.*?）/g, '')
        .replace(/作者[：:].+$/, '').replace(/^[《\[【〈]|[》\]】〉]$/g, '').replace(/^\[.+?\]/, '').trim();

      // 题材
      const baseGenre = detectGenre(fileName, cleaned);
      process.stdout.write(`   题材 ${baseGenre}`);

      // AI 指纹
      const sample = extractFirstChapters(cleaned, 3);
      let fp = null;
      if (!SKIP_AI && aiCfg.apiKey) {
        process.stdout.write(' → AI...');
        fp = await extractFingerprint(sample, title, aiCfg);
        if (fp) console.log(` ✅ 速度:${fp.openingSpeed} 对话:${fp.dialogueRatio}% ${fp.emotionTone}`);
        else    { console.log(' ⚠️  AI失败'); noAI++; }
      } else { console.log(' (跳AI)'); noAI++; }

      const genre     = (fp?.genre && fp.genre !== 'undefined') ? fp.genre : baseGenre;
      const theme     = fp?.theme     || `${title}的核心矛盾`;
      const hook      = fp?.hook      || `【主角】在关键时刻发现了改变局面的【秘密】`;
      const outline   = fp?.outline   || `起：主角遭遇异常；承：深入调查；转：真相颠覆；合：主角反击`;
      const rawSample = fp?.rawSample || sample.slice(0, 600);

      await saveInspiration(db, {
        id: `import_${randomUUID().slice(0, 8)}`,
        genre, theme, hook, outline, rawText: rawSample,
        fingerprint: fp, sourceFile: fileName, wordCount: cleanLen,
      });

      if (fp) await updateStats(db, genre, fp);
      await logImport(db, fileName, 'success');
      ok++;

      if (!SKIP_AI && aiCfg.apiKey && fp && i < total - 1)
        await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.error(`\n   ❌ ${err.message}`);
      await logImport(db, fileName, 'failed', err.message).catch(() => {});
      fail++;
    }
  }

  // 报告
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════');
  console.log(` 完成  耗时 ${elapsed}s`);
  console.log(`✅ ${ok}  ⏭️ ${skip}  ❌ ${fail}  ⚠️无AI ${noAI}`);

  const gs = await db.all('SELECT genre, sample_count FROM genre_statistics ORDER BY sample_count DESC');
  if (gs.length) { console.log('\n📊 指纹库规模：'); gs.forEach(g => console.log(`   ${g.genre.padEnd(12)} ${g.sample_count} 本`)); }

  const sr = await db.get("SELECT stats FROM genre_statistics WHERE sample_count > 0 ORDER BY sample_count DESC LIMIT 1");
  if (sr) {
    const st = JSON.parse(sr.stats);
    if (st.powerPhrases?.length) {
      console.log('\n💬 金句样本：');
      st.powerPhrases.slice(0, 3).forEach((p, i) => console.log(`   ${i + 1}. ${p.slice(0, 70)}`));
    }
  }

  await db.close();
  console.log('\n🎉 完成！生成内容将自动使用指纹库，不再依赖固定模板。\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
