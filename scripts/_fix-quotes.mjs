// 修复 prompts.js 中所有 JS 字符串内嵌的中文弯引号
import fs from 'node:fs';
const file = './server/utils/prompts.js';
let src = fs.readFileSync(file, 'utf-8');

// 把 JS 字符串中 "xxx" 形式的中文弯引号替换为 'xxx'
// 策略：在 "..." 双引号字符串内部，遇到 "文字" 就改为 '文字'
// 用正则：找到 "..." 内的 \u201c...\u201d 并替换
src = src.replace(/\u201c([^""\n]{0,80})\u201d/g, "'$1'");

fs.writeFileSync(file, src, 'utf-8');
console.log('✅ 弯引号修复完成');
