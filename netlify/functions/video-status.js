// netlify/functions/video-status.js

// 导入 create-video 中的 videoTasks（需要共享状态）
// 简单起见，这里使用一个全局 Map（实际项目中应该用 Redis）
const videoTasks = new Map();

// 导出函数供其他模块使用
if (typeof global._videoTasks === 'undefined') {
  global._videoTasks = new Map();
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 从路径中提取 videoId
  const pathParts = event.path.split('/');
  const videoId = pathParts[pathParts.length - 1];

  if (!videoId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Video ID is required' })
    };
  }

  // 从全局存储中获取任务
  const task = global._videoTasks.get(videoId);

  if (!task) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Video task not found' })
    };
  }

  const response = {
    success: true,
    video_id: task.videoId,
    status: task.status,
    progress: task.progress,
    demoMode: task.demoMode || false
  };

  if (task.status === 'completed') {
    response.videoUrl = task.videoUrl;
    response.thumbnailUrl = task.thumbnailUrl;
  }

  if (task.status === 'failed') {
    response.message = task.errorMessage || 'Video generation failed';
  }

  if (task.demoMode && task.status === 'processing') {
    response.message = `正在生成视频... ${task.progress}%`;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(response)
  };
};