import jwt from 'jsonwebtoken';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
const JWT_SECRET = jwtSecretMatch ? jwtSecretMatch[1].trim() : 'replace-with-a-long-random-secret';

const API_URL = 'http://127.0.0.1:4173/api/inspirations';

async function test() {
  try {
    const token = jwt.sign({ userId: 'testuser' }, JWT_SECRET);
    const authHeaders = { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };

    console.log('Sending GET inspirations request...');
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: authHeaders
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Inspirations Count:', data.inspirations?.length);
    console.log('Sample data (first 2):', data.inspirations?.slice(0, 2));
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

test();
