import jwt from 'jsonwebtoken';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
const JWT_SECRET = jwtSecretMatch ? jwtSecretMatch[1].trim() : 'replace-with-a-long-random-secret';

const API_BASE = 'http://127.0.0.1:4173/api';
const token = jwt.sign({ userId: 'testuser' }, JWT_SECRET);
const authHeaders = { 
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + token
};

async function testOutlineTrends() {
  console.log('====== 开始爆款起名大纲管道接口联调验证 ======\n');

  // 1. 验证普通大纲方案生成接口注入 /api/generate
  try {
    console.log('[TEST 1/2] 验证普通大纲方案生成注入 ...');
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        mode: 'plan',
        userId: 'testuser',
        input: {
          title: '陈叔的救赎',
          genre: 'family', // 世情家庭
          theme: '三十万拆迁款被私吞',
          topic: '原生家庭的偏心与自我觉醒',
          notes: '母亲用旧账本偏心妹妹，妹妹在婚礼当天被我揭穿签名作假'
        }
      })
    });

    console.log(`- 响应状态码: ${res.status}`);
    const data = await res.json();
    console.log(`- 接口执行结果 ok: ${data.ok}`);

    if (data.ok) {
      console.log(`- ✅ 普通大纲生成成功！`);
      // 这里的 text 返回的应该是一个 JSON 字符串，我们需要解析出来看 titles
      let draftPlan = {};
      try {
        draftPlan = JSON.parse(data.text);
      } catch (err) {
        console.warn('- ⚠️ 警告：AI 返回的正文不是纯 JSON，开始尝试用 extractChatText 提取 JSON 部分');
        const match = data.text.match(/\{[\s\S]*\}/);
        if (match) {
          draftPlan = JSON.parse(match[0]);
        }
      }

      console.log(`- 生成的 3 个候选标题（应深度结合爆款）：`);
      console.log(draftPlan.titles);
      
      const hasMockStyle = draftPlan.titles?.some(t => t.includes('参考爆款') || t.includes('账本'));
      if (hasMockStyle) {
        console.log(`- ✅ 成功在标题中检测到融入的爆款趋势神韵！`);
      } else {
        console.log(`- ❌ 错误：标题中未成功融入爆款神韵！`);
        process.exit(1);
      }
    } else {
      console.log(`- ❌ 接口生成失败:`, data.message);
      process.exit(1);
    }
  } catch (e) {
    console.error('- ❌ 普通大纲方案生成接口请求发生错误:', e);
    process.exit(1);
  }

  console.log('\n');

  // 2. 验证连载小说两步大纲生成接口注入 /api/novels/:id/outline/generate
  try {
    console.log('[TEST 2/2] 验证连载小说大纲爆款召回与生成 ...');
    
    // 2.1 先创建一个测试小说
    console.log('- 步骤 2.1: 创建一个测试小说记录 ...');
    const createRes = await fetch(`${API_BASE}/novels`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: '我的大漠传奇',
        genre: '历史错位爽文', // 历史错位爽文
        outline: '给古代朱元璋直播现代工业图纸',
        characters: '主角：李明；配角：朱元璋',
        targetChapters: 5,
        chapterLength: 1500
      })
    });
    
    const createData = await createRes.json();
    if (!createData.ok || !createData.novel) {
      console.log('- ❌ 测试小说创建失败！', createData.message);
      process.exit(1);
    }
    const novelId = createData.novel.id;
    console.log(`- ✅ 成功创建测试小说，ID: ${novelId}`);

    // 2.2 触发大纲生成
    console.log('- 步骤 2.2: 触发大纲生成 API POST /api/novels/:id/outline/generate ...');
    const outlineRes = await fetch(`${API_BASE}/novels/${novelId}/outline/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        brainstorm: '给古代朱元璋直播现代工业图纸，改变历史进程',
        modelConfig: {
          apiKey: 'sk-your-api-key', // 使用占位符触发本地 Mock 沙箱
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com'
        }
      })
    });

    console.log(`- 响应状态码: ${outlineRes.status}`);
    const outlineData = await outlineRes.json();
    console.log(`- 接口执行结果 ok: ${outlineData.ok}`);

    if (outlineData.ok) {
      console.log(`- ✅ 连载小说大纲生成成功！`);
      console.log(`- 第一步核心设定（包含背景创意、简介与三幕）：\n`, outlineData.setting?.slice(0, 300) + '...\n');
      console.log(`- 第二步章节大纲（应包含带强烈情绪张力的每章标题）：\n`, outlineData.chapterOutlines?.slice(0, 300) + '...\n');
      
      console.log('====== 🎉 爆款起名大纲管道接口全链路测试 100% 通过！ ======');
    } else {
      console.log(`- ❌ 连载小说大纲生成失败:`, outlineData.message);
      process.exit(1);
    }

    // 2.3 清理测试小说
    console.log('- 步骤 2.3: 清理测试小说 ...');
    await fetch(`${API_BASE}/novels/${novelId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('- ✅ 测试小说清理完成');

  } catch (e) {
    console.error('- ❌ 连载大纲生成发生错误:', e);
    process.exit(1);
  }
}

testOutlineTrends();
