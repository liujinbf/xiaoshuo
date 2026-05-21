import jwt from 'jsonwebtoken';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
const JWT_SECRET = jwtSecretMatch ? jwtSecretMatch[1].trim() : 'replace-with-a-long-random-secret';

const API_URL = 'http://127.0.0.1:4173/api/generate';

async function test() {
  try {
    const token = jwt.sign({ userId: 'testuser' }, JWT_SECRET);
    const authHeaders = { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };

    console.log('Sending POST /api/generate request...');
    const payload = {
      mode: 'plan',
      input: {
        title: '被隐瞒的三十万拆迁款',
        genre: 'family',
        theme: '家里人偏心妹妹，妹妹冒签领走了我三十万老房拆迁补偿款，家宴上我甩出铁证，将其送上公诉席',
        notes: '有一些关于银行笔迹签名的流水作为决定性法治反击道具。'
      }
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });
    console.log('Status:', res.status);
    const data = await res.json();
    fs.writeFileSync('scripts/test-response.json', JSON.stringify(data, null, 2), 'utf-8');
    console.log('Response saved to scripts/test-response.json');
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

test();
