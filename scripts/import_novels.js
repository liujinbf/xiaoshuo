import fs from 'fs/promises';
import path from 'path';
import '../server/utils/env.js';

const TARGET_DIR = 'C:\\Users\\Administrator\\Downloads\\小说';
const API_URL = 'http://127.0.0.1:4173/api/inspirations/dissect';
const SAVE_URL = 'http://127.0.0.1:4173/api/inspirations';

// 控制并发与延迟
const CONCURRENCY = 3; 
const DELAY_MS = 2000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllTxtFiles(dir) {
  let results = [];
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(await getAllTxtFiles(fullPath));
    } else if (file.name.endsWith('.txt')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 基于文件名猜测体裁
function guessGenre(filename) {
  if (filename.includes('反转') || filename.includes('悬疑')) return 'suspense';
  if (filename.includes('复仇') || filename.includes('渣男') || filename.includes('离婚')) return 'revenge';
  if (filename.includes('规则') || filename.includes('怪谈')) return 'rules';
  if (filename.includes('历史') || filename.includes('穿越')) return 'history';
  if (filename.includes('民俗') || filename.includes('志怪')) return 'folklore';
  if (filename.includes('大女主') || filename.includes('女强')) return 'heroine';
  return 'suspense'; // 默认
}

function decodeChineseText(buffer) {
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return utf8Decoder.decode(buffer);
  } catch (e) {
    // 遇到 UTF-8 校验失败，自动降级为 GBK 进行解码，彻底解决网文乱码问题
    const gbkDecoder = new TextDecoder('gbk');
    return gbkDecoder.decode(buffer);
  }
}

async function processFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const content = decodeChineseText(buffer);
    const filename = path.basename(filePath);
    
    // 只取前 2000 字进行拆解，以节省 Token 并加速处理
    const rawText = content.slice(0, 2000).trim();
    if (rawText.length < 100) {
      console.log(`[跳过] ${filename} - 内容太短`);
      return false;
    }

    const genre = guessGenre(filename);
    console.log(`[分析中] ${filename} (${genre}) ...`);

    // 1. 请求 AI 拆解
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign({ userId: 'admin' }, process.env.JWT_SECRET || 'yanxuan-secret-key-123');
    const authHeaders = { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };

    const dissectRes = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ rawText, genre })
    });
    const dissectData = await dissectRes.json();

    if (!dissectData.ok) {
      console.error(`[拆解失败] ${filename}: ${dissectData.message}`);
      return false;
    }

    // 2. 保存入库
    const saveRes = await fetch(SAVE_URL, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        genre,
        theme: dissectData.theme,
        hook: dissectData.hook,
        outline: dissectData.outline,
        rawText: rawText
      })
    });
    const saveData = await saveRes.json();

    if (saveData.ok) {
      console.log(`✅ [成功] ${filename} 已存入知识库！`);
      return true;
    } else {
      console.error(`❌ [保存失败] ${filename}: ${saveData.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [严重错误] ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log(`正在扫描目录: ${TARGET_DIR}`);
  const allFiles = await getAllTxtFiles(TARGET_DIR);
  console.log(`共找到 ${allFiles.length} 本 TXT 小说。`);
  
  let successCount = 0;
  let failCount = 0;

  // 使用有限并发队列
  for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
    const chunk = allFiles.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (file) => {
      const res = await processFile(file);
      if (res) successCount++;
      else failCount++;
      await sleep(DELAY_MS); // 避免触发 API 频率限制
    });
    
    await Promise.all(promises);
    console.log(`⏳ 进度: ${Math.min(i + CONCURRENCY, allFiles.length)} / ${allFiles.length}`);
  }

  console.log('=============================================');
  console.log(`🎉 批量导入完成！成功: ${successCount} 本，失败或跳过: ${failCount} 本`);
}

main();
