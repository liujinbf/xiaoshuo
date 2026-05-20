import fs from 'node:fs';
import path from 'node:path';

const dir = 'D:\\下载\\小说【网盘直下】\\小说文包\\晋江前100';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));

// 找到那本武侠书
const target = files.find(f => f.includes('综武侠'));
if (!target) { console.log('未找到'); process.exit(0); }

const raw = fs.readFileSync(path.join(dir, target), 'utf-8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

// 找第一个可能的章节标题行
let found = 0;
for (let i = 0; i < lines.length && found < 5; i++) {
  const t = lines[i].trim();
  if (!t) continue;
  // 显示前40行
  if (i < 40) console.log(`L${i}: ${JSON.stringify(t.slice(0,60))}`);
  // 检测章节
  if (/第.+章|Chapter|\d+\./.test(t) && found < 5) {
    console.log(`  ↑ 可能的章节: L${i} "${t.slice(0,50)}"`);
    found++;
  }
}
