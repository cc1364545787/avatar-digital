// netlify/functions/avatars.js

exports.handler = async (event, context) => {
    // 设置 CORS 头
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };
  
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }
  
    // 只允许 GET 请求
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }
  
    // 返回可用的 Avatar 列表
    const avatars = [
      { id: 'female-warm', name: '小军 · 培训讲师', gender: 'female', style: 'warm' },
      { id: 'male-calm', name: '小智 · 教育讲师', gender: 'male', style: 'calm' },
      { id: 'female-friendly', name: '小慧 · 智能客服', gender: 'female', style: 'friendly' },
      { id: 'female-elegant', name: '小雅 · 文旅讲解', gender: 'female', style: 'elegant' },
      { id: 'male-pro', name: '小政 · 政策顾问', gender: 'male', style: 'professional' }
    ];
  
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, avatars })
    };
  };