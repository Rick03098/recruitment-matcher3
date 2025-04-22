// test-openai.js
require('dotenv').config({ path: '.env.local' }); // 加载 .env.local 文件
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY; // 从环境变量读取

if (!apiKey || !apiKey.startsWith('sk-')) { // 简单检查 Key 格式
    console.error('错误: 在 .env.local 文件中没有找到有效的 OPENAI_API_KEY。请确保 Key 存在且以 sk- 开头。');
    process.exit(1); // 退出脚本
}

console.log(`正在使用 API Key (前5位: ${apiKey.substring(0, 5)}...) 进行测试...`);

// 使用读取到的 Key 初始化 OpenAI 客户端
const openai = new OpenAI({ apiKey });

async function runTest() {
    try {
        console.log('向 OpenAI 发送一个简单的测试请求...');
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: '你好，这是一个测试。请回复 "测试成功"。' }],
            model: 'gpt-3.5-turbo-0125', // 使用你代码中相同的模型
            max_tokens: 10 // 限制回复长度
        });
        console.log('OpenAI 测试请求成功！响应:');
        console.log(completion.choices[0].message.content); // 打印模型的回复
    } catch (error) {
        console.error('OpenAI 测试请求失败:', error.message); // 打印错误信息
        if (error.status === 401) {
             console.error('错误详情：仍然是 401 错误，请再次确认 .env.local 中的 API Key 是否为最新、完整且无误，并已重启 Node.js 进程。');
        } else if (error.status === 429) {
             console.error('错误详情：API 请求过于频繁或超出配额。请检查 OpenAI 账户用量限制。');
        } else {
             console.error('错误详情 (其他):', error.status, error.code);
        }
    }
}

runTest(); // 执行测试函数