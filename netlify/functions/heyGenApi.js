// netlify/functions/heyGenApi.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // 设置 CORS 头，让前端可以调用
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // 处理预检请求 (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // 只允许 POST 请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 解析前端传过来的数据
    const requestBody = JSON.parse(event.body);
    const { text, avatarId } = requestBody;

    // 从环境变量读取 HeyGen API Key
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

    if (!HEYGEN_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API Key not configured' })
      };
    }

    // 调用 HeyGen API 生成视频
    const heygenResponse = await fetch('https://api.heygen.com/v1/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        avatar_id: avatarId || 'default_avatar',
        // 其他参数根据你的需要配置
      })
    });

    const data = await heygenResponse.json();

    // 返回结果给前端
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
};