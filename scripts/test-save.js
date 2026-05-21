import jwt from 'jsonwebtoken';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
const JWT_SECRET = jwtSecretMatch ? jwtSecretMatch[1].trim() : 'replace-with-a-long-random-secret';

const API_URL = 'http://127.0.0.1:4173/api/inspirations?userId=testuser';

async function testSave() {
  try {
    const token = jwt.sign({ userId: 'testuser' }, JWT_SECRET);
    const authHeaders = { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };

    console.log('Sending POST inspirations save request...');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        genre: 'suspense',
        theme: '一个非常精彩悬疑故事核心主题',
        hook: '当【主角】第一次发现【异常线索】时，所有人都以为那只是意外。',
        outline: '起：主角在日常场景中撞见异常线索；承：主角调查谎言；转：冲突升级；合：抓住证据设局。',
        rawText: '这是测试的爆款原文内容，至少需要二十个字以上。',
        fingerprint: {
          openingSpeed: 5,
          voiceStyle: "第三人称近视角",
          dialogueRatio: 30,
          sentenceStyle: "短长混合"
        }
      })
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response data:', data);
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testSave();
