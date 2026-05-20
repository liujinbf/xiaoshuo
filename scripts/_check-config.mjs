import { getDb } from '../server/utils/db.js';
const db = await getDb();
const rows = await db.all("SELECT user_id, data FROM accounts");
for (const row of rows) {
  const d = JSON.parse(row.data);
  if (d.modelConfig?.apiKey && d.modelConfig.apiKey.length > 10 && !d.modelConfig.apiKey.includes('your')) {
    console.log('userId:', row.user_id);
    console.log('apiKey前12:', d.modelConfig.apiKey.slice(0,12) + '***');
    console.log('baseUrl:', d.modelConfig.baseUrl);
    console.log('model:', d.modelConfig.model);
    break;
  }
}
process.exit(0);
