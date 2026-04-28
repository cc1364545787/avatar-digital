// netlify/functions/generate-script.js

exports.handler = async (event, context) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
  
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }
  
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }
  
    try {
      const { text, voice, style, platform } = JSON.parse(event.body);
  
      if (!text) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'text is required' })
        };
      }
  
      // AI 优化脚本的逻辑
      let optimizedScript = text;
  
      // 简单的脚本优化规则（你可以根据需要扩展）
      // 去除多余空格、换行
      optimizedScript = optimizedScript.trim().replace(/\s+/g, ' ');
      
      // 确保以句号结尾
      if (!optimizedScript.endsWith('。') && !optimizedScript.endsWith('.') && 
          !optimizedScript.endsWith('！') && !optimizedScript.endsWith('？')) {
        optimizedScript += '。';
      }
  
      // 计算预估时长（假设每秒2.5个字）
      const charCount = optimizedScript.length;
      const estimatedSeconds = Math.ceil(charCount / 2.5);
  
      // 可选：添加一些开场白（如果原文很短）
      if (charCount < 20 && charCount > 0) {
        optimizedScript = `大家好，欢迎收看。${optimizedScript}`;
      }
  
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          script: optimizedScript,
          original: text,
          stats: {
            chars: optimizedScript.length,
            originalChars: text.length,
            estimatedSeconds: estimatedSeconds
          },
          platform: platform || 'HeyGen',
          voice: voice,
          style: style
        })
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