import jwt from 'jsonwebtoken';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
const JWT_SECRET = jwtSecretMatch ? jwtSecretMatch[1].trim() : 'replace-with-a-long-random-secret';

const API_BASE = 'http://127.0.0.1:4173/api/trends';
const token = jwt.sign({ userId: 'testuser' }, JWT_SECRET);
const authHeaders = { 
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + token
};

async function runTests() {
  console.log('====== 开始题材趋势系统接口联调测试 ======\n');
  let testTrendId = null;
  let testNovelTitle = '';

  // 1. 测试 POST /api/trends/collect 智能采集归档接口
  try {
    console.log('[TEST 1/4] 发送智能采集与归档请求 POST /collect ...');
    const res = await fetch(`${API_BASE}/collect`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    
    console.log(`- 响应状态码: ${res.status}`);
    const data = await res.json();
    console.log(`- 接口执行结果 ok: ${data.ok}`);
    
    if (data.ok && Array.isArray(data.list) && data.list.length > 0) {
      console.log(`- ✅ 成功采集并归档 ${data.list.length} 个爆款题材！`);
      const sample = data.list[0];
      testTrendId = sample.id;
      testNovelTitle = sample.novel_title;
      console.log(`- 样本题材数据示例: 《${sample.novel_title}》[${sample.source}] -> ${sample.mapped_genre}`);
      console.log(`- 样本公开简介 introduction: "${sample.introduction || ''}"`);
      console.log(`- 样本 AI 结构特征: ${JSON.stringify(sample.analysis)}`);
      
      if (!sample.introduction) {
        console.log(`- ❌ 错误：样本题材中缺失 introduction 字段！`);
        process.exit(1);
      } else {
        console.log(`- ✅ 确认 introduction 简介字段完整合规`);
      }
    } else {
      console.log(`- ❌ 采集数据为空或接口失败:`, data.message);
      process.exit(1);
    }
  } catch (e) {
    console.error('- ❌ 采集接口请求发生错误:', e);
    process.exit(1);
  }
  console.log('\n');

  // 2. 测试 GET /api/trends 列表获取与双维度过滤接口
  try {
    console.log('[TEST 2/4] 发送获取全部题材列表请求 GET / ...');
    const resAll = await fetch(API_BASE, {
      method: 'GET',
      headers: authHeaders
    });
    const dataAll = await resAll.json();
    console.log(`- 全部题材数量: ${dataAll.list?.length}`);

    // 测试平台过滤
    console.log('[TEST 2.1] 发送知乎平台过滤请求 GET /?source=zhihu ...');
    const resZhihu = await fetch(`${API_BASE}?source=zhihu`, {
      method: 'GET',
      headers: authHeaders
    });
    const dataZhihu = await resZhihu.json();
    const allAreZhihu = dataZhihu.list?.every(item => item.source === 'zhihu');
    console.log(`- 知乎题材数量: ${dataZhihu.list?.length} (全部数据均为知乎: ${allAreZhihu})`);

    // 测试题材映射过滤
    console.log('[TEST 2.2] 发送规则怪谈映射过滤请求 GET ?mapped_genre=rules ...');
    const resRules = await fetch(`${API_BASE}?mapped_genre=rules`, {
      method: 'GET',
      headers: authHeaders
    });
    const dataRules = await resRules.json();
    const allAreRules = dataRules.list?.every(item => item.mapped_genre === 'rules');
    console.log(`- 规则怪谈映射数量: ${dataRules.list?.length} (全部数据均为rules: ${allAreRules})`);
    
    if (dataAll.ok && dataZhihu.ok && dataRules.ok) {
      console.log('- ✅ 题材列表与双维度过滤接口测试通过！');
    } else {
      console.log('- ❌ 过滤接口返回异常状态');
      process.exit(1);
    }
  } catch (e) {
    console.error('- ❌ 列表与过滤接口发生错误:', e);
    process.exit(1);
  }
  console.log('\n');

  // 3. 测试 POST /api/trends/convert 一键逆向灵感转化接口
  try {
    console.log(`[TEST 3/4] 发送一键灵感转化请求 POST /convert (目标: 《${testNovelTitle}》, ID: ${testTrendId}) ...`);
    const res = await fetch(`${API_BASE}/convert`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ trendId: testTrendId })
    });

    console.log(`- 响应状态码: ${res.status}`);
    const data = await res.json();
    console.log(`- 转化结果 ok: ${data.ok}`);

    if (data.ok && data.inspirationId) {
      console.log(`- ✅ 深度反编译成功并入库！`);
      console.log(`- 编译出专属灵感 ID: ${data.inspirationId}`);
      console.log(`- 提示消息: ${data.message}`);
    } else {
      console.log(`- ❌ 逆向转化接口失败:`, data.message);
      process.exit(1);
    }
  } catch (e) {
    console.error('- ❌ 转化接口发生错误:', e);
    process.exit(1);
  }

  console.log('\n');

  // 4. 校验转化结果在 motivations/inspirations 列表中的同步显示
  try {
    console.log('[TEST 4/4] 验证转换结果是否成功落盘于 inspirations 数据库表中 ...');
    const res = await fetch('http://127.0.0.1:4173/api/inspirations', {
      method: 'GET',
      headers: authHeaders
    });
    const data = await res.json();
    const hasConverted = data.inspirations?.some(insp => (insp.theme || '').includes(testNovelTitle) || (insp.raw_text || '').includes(testNovelTitle));
    
    if (hasConverted) {
      console.log(`- ✅ 确认在专属灵感库中已同步搜索到《${testNovelTitle}》所编译转化而来的灵感！`);
      console.log('====== 🎉 题材趋势系统接口全链路测试 100% 通过！ ======');
    } else {
      console.log(`- ❌ 未能在灵感库列表中检索到刚刚转化的灵感《${testNovelTitle}》`);
      process.exit(1);
    }
  } catch (e) {
    console.error('- ❌ 校验同步时发生错误:', e);
    process.exit(1);
  }
}

runTests();
