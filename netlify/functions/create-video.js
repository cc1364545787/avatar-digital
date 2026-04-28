// netlify/functions/create-video.js

// 模拟存储（实际项目中应该用 Redis 或数据库）
const videoTasks = new Map();

function generateVideoId() {
  return `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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
    const { script, voice, avatarKey } = JSON.parse(event.body);

    if (!script || script.length < 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Script must be at least 10 characters' })
      };
    }

    const videoId = generateVideoId();
    
    // 存储任务信息
    videoTasks.set(videoId, {
      videoId: videoId,
      status: 'processing',
      progress: 0,
      script: script,
      voice: voice,
      avatarKey: avatarKey,
      createdAt: new Date().toISOString(),
      demoMode: true
    });

    // 模拟异步视频生成
    startVideoProcessing(videoId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        video_id: videoId,
        demoMode: true,
        message: 'Video generation started'
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

// 模拟视频处理过程
function startVideoProcessing(videoId) {
  const task = videoTasks.get(videoId);
  if (!task) return;

  let progress = 0;
  const interval = setInterval(() => {
    progress += 20;
    
    if (progress >= 100) {
      clearInterval(interval);
      // 视频生成完成，生成一个模拟的视频 URL
      // 注意：实际应该调用 HeyGen API 获取真实视频
      task.status = 'completed';
      task.progress = 100;
      task.videoUrl = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4`;
      task.thumbnailUrl = `https://picsum.photos/300/200?random=${videoId}`;
      videoTasks.set(videoId, task);
    } else {
      task.progress = progress;
      task.status = 'processing';
      videoTasks.set(videoId, task);
    }
  }, 3000);
}

// 导出 videoTasks 供 status 函数使用
exports.videoTasks = videoTasks;