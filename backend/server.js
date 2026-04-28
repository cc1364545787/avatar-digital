/**
 * 数字人演示后端服务
 * 功能：
 *   1. 调用 Anthropic Claude API 优化播报脚本
 *   2. 调用 HeyGen API 生成数字人视频
 *   3. 轮询 HeyGen 任务状态
 *   4. 提供静态前端文件服务
 * 
 * 安全说明：
 *   - 所有 API Key 必须通过环境变量配置
 *   - 请在项目根目录创建 .env 文件
 *   - 严禁将 .env 文件提交到版本控制系统
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// ─── 配置（所有密钥必须从环境变量读取）────────────────────────────────────
// 必需的配置项 - 如果没有设置会报错
const REQUIRED_CONFIG = ['ANTHROPIC_API_KEY', 'HEYGEN_API_KEY'];

// 检查并加载配置
const CONFIG = {
  // Anthropic API 配置
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL: process.env.ANTHROPIC_API_URL || 'https://tokenshengsheng.com/v1/chat/completions',
  ANTHROPIC_PROVIDER: process.env.ANTHROPIC_PROVIDER || 'openai_compatible', // openai_compatible | anthropic
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'gpt-3.5-turbo',
  // HeyGen API 配置
  HEYGEN_API_KEY: process.env.HEYGEN_API_KEY,
  HEYGEN_API_BASE_URL: process.env.HEYGEN_API_BASE_URL || 'https://api.heygen.com',
  FORCE_DEMO_VIDEO: process.env.FORCE_DEMO_VIDEO === 'true',
  DEMO_VIDEO_SOURCE_URL: process.env.DEMO_VIDEO_SOURCE_URL || '',
  DEMO_LOCAL_VIDEO_FILE: process.env.DEMO_LOCAL_VIDEO_FILE || '数字人技术体验课_小智助教_720p.mp4',
  // 如果你的 HeyGen Key 无法访问 /v2/voices 接口，需要手动配置一个支持中文的 voice_id
  HEYGEN_ZH_FEMALE_VOICE_ID: process.env.HEYGEN_ZH_FEMALE_VOICE_ID || '',
  HEYGEN_ZH_MALE_VOICE_ID: process.env.HEYGEN_ZH_MALE_VOICE_ID || '',
  ENABLE_MOCK_FALLBACK: process.env.ENABLE_MOCK_FALLBACK !== 'false',
  DEMO_VIDEO_URL: process.env.DEMO_VIDEO_URL || '/数字人技术体验课_小智助教_720p.mp4',
  // 服务器端口
  PORT: process.env.PORT || 3000,
};

// 启动时验证必需的环境变量
const missingConfigs = REQUIRED_CONFIG.filter(key => !CONFIG[key] || CONFIG[key].trim() === '');
if (missingConfigs.length > 0) {
  console.error('\n❌ 错误：缺少必需的环境变量配置！');
  console.error(`   请创建 .env 文件并设置以下变量：`);
  missingConfigs.forEach(key => {
    console.error(`     - ${key}`);
  });
  console.error(`\n   .env 文件示例：`);
  console.error(`     ANTHROPIC_API_KEY=your_anthropic_key_here`);
  console.error(`     HEYGEN_API_KEY=your_heygen_key_here`);
  console.error(`     ANTHROPIC_API_URL=https://tokenshengsheng.com/v1/chat/completions`);
  console.error(`     PORT=3000\n`);
  
  // 仅在开发环境允许启动（用于演示），生产环境应直接退出
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️  警告：开发模式下继续运行，但 API 调用将失败！\n');
  }
}

// ─── HeyGen 预置数字人形象 ID（这些是公开配置，可以硬编码）───────────────
const HEYGEN_AVATARS = {
  'female-warm': 'Daisy-inskirt-20220818',
  'male-calm': 'Tyler-incasualsuit-20220721',
  'female-friendly': 'Anna_public_3_20240108',
  'female-elegant': 'Susan_public_2_20240328',
  'male-pro': 'Eric_public_pro_20230608',
};

const HEYGEN_VOICES = {
  '温柔女声': '1bd001e7e50f421d891986aad5158bc8',
  '沉稳男声': '2d5b0e6cf36f460aa7fc47e3eee4ba54',
  '亲切女声': 'a0e99841fd0a4ad98af2bec7f26fe295',
  '文艺女声': '1bd001e7e50f421d891986aad5158bc8',
  '专业男声': '2d5b0e6cf36f460aa7fc47e3eee4ba54',
};

// ─── 辅助函数：安全获取配置（不暴露完整密钥）──────────────────────────────
const getMaskedKey = (key) => {
  if (!key) return '未配置';
  if (key.length <= 12) return '***';
  return key.substring(0, 6) + '***' + key.substring(key.length - 4);
};

const mockVideoJobs = new Map();

function formatNetworkError(err, serviceName) {
  const cause = err?.cause || {};
  const code = cause.code || err.code;
  const host = cause.hostname;

  if (code === 'ENOTFOUND' && host) {
    return `${serviceName} 域名解析失败：无法访问 ${host}`;
  }

  if (code === 'ECONNREFUSED') {
    return `${serviceName} 连接被拒绝，请检查服务地址或网络策略`;
  }

  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `${serviceName} 请求超时，请稍后重试`;
  }

  return err.message || `${serviceName} 调用失败`;
}

function buildFallbackScript(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  // return [
  //   '大家好，欢迎来到今天的数字人演示。',
  //   normalized,
  //   '如果您希望，我还可以继续为您生成更适合播报节奏的版本。'
  // ].join(' ');
  return normalized
}

async function resolveDemoVideoUrl() {
  if (!CONFIG.DEMO_VIDEO_SOURCE_URL) return CONFIG.DEMO_VIDEO_URL;

  try {
    const response = await fetch(CONFIG.DEMO_VIDEO_SOURCE_URL, { method: 'GET' });
    if (!response.ok) return CONFIG.DEMO_VIDEO_URL;

    const html = await response.text();
    // 从 heygen 视频详情页注入数据中提取 video_url 字段
    const match = html.match(/\\"video_url\\",\\"([^"]+\\.mp4[^"]*)\\"/);
    if (!match || !match[1]) return CONFIG.DEMO_VIDEO_URL;

    return match[1].replace(/\\u0026/g, '&');
  } catch (err) {
    console.warn('[resolveDemoVideoUrl] 解析失败，使用默认演示视频:', err.message);
    return CONFIG.DEMO_VIDEO_URL;
  }
}

function isChineseText(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ''));
}

function chooseHeyGenVoiceId({ voiceLabel, script }) {
  const label = String(voiceLabel || '');
  const zh = isChineseText(script);

  if (zh) {
    const wantsMale = /男/.test(label);
    const preferred = wantsMale ? CONFIG.HEYGEN_ZH_MALE_VOICE_ID : CONFIG.HEYGEN_ZH_FEMALE_VOICE_ID;
    const fallback = wantsMale ? CONFIG.HEYGEN_ZH_FEMALE_VOICE_ID : CONFIG.HEYGEN_ZH_MALE_VOICE_ID;
    // 如果只配置了其中一种中文 voice，也允许回退使用，避免直接报“未配置”
    return preferred || fallback || '';
  }

  return HEYGEN_VOICES[voiceLabel] || HEYGEN_VOICES['温柔女声'];
}

async function callScriptProvider(prompt) {
  if (CONFIG.ANTHROPIC_PROVIDER === 'anthropic') {
    const response = await fetch(CONFIG.ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.ANTHROPIC_API_KEY,
        'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
      },
      body: JSON.stringify({
        model: CONFIG.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    return { response, provider: 'anthropic' };
  }

  const response = await fetch(CONFIG.ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.ANTHROPIC_API_KEY}`,
    },
    body: JSON.stringify({
      model: CONFIG.ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  return { response, provider: 'openai_compatible' };
}

function parseScriptResponse(data, provider) {
  if (provider === 'anthropic') {
    const text = data?.content?.[0]?.text;
    return typeof text === 'string' ? text : '';
  }

  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text : '';
}

function createMockVideoJob(script, voice, avatarKey, demoVideoUrl) {
  const videoId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  mockVideoJobs.set(videoId, {
    createdAt: Date.now(),
    readyAt: Date.now() + 12000,
    demoVideoUrl: demoVideoUrl || CONFIG.DEMO_VIDEO_URL,
    script,
    voice,
    avatarKey,
  });
  return videoId;
}

function getMockVideoStatus(videoId) {
  const job = mockVideoJobs.get(videoId);
  if (!job) return null;

  const elapsed = Date.now() - job.createdAt;
  const total = Math.max(job.readyAt - job.createdAt, 1);
  const progress = Math.min(Math.round((elapsed / total) * 100), 100);
  const completed = Date.now() >= job.readyAt;

  return {
    success: true,
    status: completed ? 'completed' : 'processing',
    videoUrl: completed ? (job.demoVideoUrl || CONFIG.DEMO_VIDEO_URL) : null,
    thumbnailUrl: null,
    progress: completed ? 100 : Math.max(progress, 8),
    demoMode: true,
    message: completed ? '视频生成中，通常需要 1-3 分钟...' : '正在生成视频...',
  };
}

function isHeyGenInsufficientCredit(data) {
  const msg = String(
    data?.message ||
    data?.error?.message ||
    data?.error ||
    data?.detail?.message ||
    ''
  ).toLowerCase();

  return msg.includes('insufficient credit') || msg.includes('api credits');
}

function extractHeyGenErrorMessage(data) {
  return (
    data?.error?.message ||
    data?.error?.error?.message ||
    data?.error?.error ||
    data?.error ||
    data?.message ||
    data?.detail?.message ||
    data?.detail?.error?.message ||
    data?.detail?.error ||
    ''
  );
}

async function readApiResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return {
        parseError: true,
        rawText: text,
        message: `JSON 解析失败：${err.message}`,
      };
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      nonJson: true,
      rawText: text,
      message: text.slice(0, 200),
    };
  }
}

// ─── 路由 1：AI 优化脚本 ─────────────────────────────────────────────────────
app.post('/api/generate-script', async (req, res) => {
  const { text, voice, style, platform } = req.body;

  // 检查 API Key 是否配置
  if (!CONFIG.ANTHROPIC_API_KEY || CONFIG.ANTHROPIC_API_KEY.trim() === '') {
    return res.status(503).json({ 
      error: '服务配置错误', 
      message: 'Anthropic API Key 未配置，请联系管理员',
      fallback: true
    });
  }

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: '请输入播报文字' });
  }

  try {
    const prompt = `你是一个专业的数字人播报脚本优化师。

用户输入了以下原始文字：
"${text}"

配置信息：声音风格=${voice}，内容风格=${style}，平台=${platform}

请优化成一段适合数字人朗读的播报脚本，要求：
1. 语言自然流畅，口语化，适合语音合成
2. 总字数控制在 150-250 字之间
3. 开头加一句吸引注意力的开场白（如"大家好""您好"等）
4. 结尾加一句明确的行动号召
5. 不要加任何标点说明、括号注释或舞台指示，纯净文字即可

只输出脚本正文，不要任何前缀说明。`;

    console.log('[generate-script] 调用上游:', { provider: CONFIG.ANTHROPIC_PROVIDER, url: CONFIG.ANTHROPIC_API_URL });

    const { response, provider } = await callScriptProvider(prompt);

    if (!response.ok) {
      const errText = await response.text();
      const fallbackScript = buildFallbackScript(text);
      console.error('[generate-script] API错误:', response.status, errText);
      return res.status(200).json({
        success: true,
        script: fallbackScript,
        fallback: true,
        warning: `脚本优化服务暂不可用（HTTP ${response.status}），已使用原始文案`,
        stats: {
          chars: fallbackScript.length,
          estimatedSeconds: Math.round(fallbackScript.length / 4.5),
          estimatedCost: (fallbackScript.length * 0.002).toFixed(3),
        },
      });
    }

    const data = await response.json();
    console.log('[generate-script] API响应成功');
    
    let script = parseScriptResponse(data, provider);
    if (!script) {
      console.error('[generate-script] 未知响应格式:', data);
      script = buildFallbackScript(text);
    }

    const chars = script.length;
    const estimatedSeconds = Math.round(chars / 4.5);

    res.json({
      success: true,
      script,
      stats: {
        chars,
        estimatedSeconds,
        estimatedCost: (chars * 0.002).toFixed(3),
      },
    });
  } catch (err) {
    console.error('[generate-script] 错误:', err);
    const fallbackScript = buildFallbackScript(text);
    res.status(200).json({
      success: true,
      script: fallbackScript || text,
      fallback: true,
      warning: formatNetworkError(err, '脚本优化服务'),
      stats: {
        chars: (fallbackScript || text).length,
        estimatedSeconds: Math.round((fallbackScript || text).length / 4.5),
        estimatedCost: ((fallbackScript || text).length * 0.002).toFixed(3),
      },
    });
  }
});

// ─── 路由 2：提交 HeyGen 视频生成任务 ───────────────────────────────────────
app.post('/api/create-video', async (req, res) => {
  const { script, voice, avatarKey } = req.body;

  // 检查 API Key 是否配置
  if (!CONFIG.HEYGEN_API_KEY || CONFIG.HEYGEN_API_KEY.trim() === '') {
    return res.status(503).json({ 
      error: '服务配置错误', 
      message: 'HeyGen API Key 未配置，请联系管理员'
    });
  }

  if (!script) return res.status(400).json({ error: '缺少脚本内容' });

  if (CONFIG.FORCE_DEMO_VIDEO) {
    const demoVideoUrl = await resolveDemoVideoUrl();
    const mockVideoId = createMockVideoJob(script, voice, avatarKey, demoVideoUrl);
    return res.json({
      success: true,
      video_id: mockVideoId,
      demoMode: true,
      warning: '当前为演示模式：每次都会返回固定演示视频，不调用 HeyGen 生成',
      message: '演示视频任务已创建',
    });
  }

  const avatar_id = HEYGEN_AVATARS[avatarKey] || HEYGEN_AVATARS['male-calm'];
  const voice_id = chooseHeyGenVoiceId({ voiceLabel: voice, script });

  if (isChineseText(script) && !voice_id) {
    return res.status(400).json({
      error: '中文语音未配置',
      message: 'HeyGen 返回：Unable to generate audio. This voice may not support this language. 需要在 .env 配置 HEYGEN_ZH_FEMALE_VOICE_ID / HEYGEN_ZH_MALE_VOICE_ID（选择支持 zh-CN 的 voice_id）。'
    });
  }

  try {
    const payload = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatar_id,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: voice_id,
            ...(isChineseText(script) ? { locale: 'zh-CN' } : {}),
            speed: 1.0,
          },
          background: {
            type: 'color',
            value: '#f0f4f8',
          },
        },
      ],
      dimension: { width: 1280, height: 720 },
      aspect_ratio: '16:9',
    };

    console.log('[create-video] 提交HeyGen任务:', { avatar_id, voice_id, scriptLength: script.length });

    const response = await fetch(`${CONFIG.HEYGEN_API_BASE_URL}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': CONFIG.HEYGEN_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('[create-video] HeyGen响应状态:', response.status);

    const video_id = data.data?.video_id || data.data?.task_id || data.data?.id;
    const hasHeyGenError = !!data.error;
    
    if (!response.ok || hasHeyGenError || !video_id) {
      if (CONFIG.ENABLE_MOCK_FALLBACK) {
        const demoVideoUrl = await resolveDemoVideoUrl();
        const mockVideoId = createMockVideoJob(script, voice, avatarKey, demoVideoUrl);
        const heygenMsg = extractHeyGenErrorMessage(data);
        const creditHint = isHeyGenInsufficientCredit(data)
          ? '（HeyGen credits 不足：请在 HeyGen 控制台充值/购买 API credits）'
          : '';

        return res.json({
          success: true,
          video_id: mockVideoId,
          demoMode: true,
          warning: `HeyGen 生成失败，已切换到本地演示模式。${creditHint}`,
          message: heygenMsg || 'HeyGen 生成失败（详见后端日志）',
          heygenDetail: data,
        });
      }

      return res.status(500).json({
        error: 'HeyGen API 错误',
        detail: data,
        message: data.message || '视频生成失败'
      });
    }

    res.json({
      success: true,
      video_id: video_id,
      message: '视频生成任务已提交，通常需要 1-3 分钟',
    });
  } catch (err) {
    console.error('[create-video] 错误:', err);
    if (CONFIG.ENABLE_MOCK_FALLBACK) {
      const demoVideoUrl = await resolveDemoVideoUrl();
      const mockVideoId = createMockVideoJob(script, voice, avatarKey, demoVideoUrl);
      return res.json({
        success: true,
        video_id: mockVideoId,
        demoMode: true,
        warning: formatNetworkError(err, 'HeyGen 视频服务'),
        message: '外部视频服务不可达，已切换到本地演示模式',
      });
    }

    res.status(500).json({ error: formatNetworkError(err, 'HeyGen 视频服务') });
  }
});

// ─── 路由 3：查询 HeyGen 视频状态 ───────────────────────────────────────────
app.get('/api/video-status/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (videoId.startsWith('mock_')) {
    const mockStatus = getMockVideoStatus(videoId);
    if (!mockStatus) return res.status(404).json({ error: '演示任务不存在或已过期' });
    return res.json(mockStatus);
  }

  if (!CONFIG.HEYGEN_API_KEY || CONFIG.HEYGEN_API_KEY.trim() === '') {
    return res.status(503).json({ error: '服务配置错误', message: 'HeyGen API Key 未配置' });
  }

  try {
    console.log('[video-status] 查询视频:', videoId);
    
    let response = await fetch(`${CONFIG.HEYGEN_API_BASE_URL}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
      headers: { 'X-Api-Key': CONFIG.HEYGEN_API_KEY },
    });

    let data = await readApiResponse(response);
    
    if (!response.ok || data.nonJson || data.parseError) {
      console.log('[video-status] v1返回非JSON或失败，尝试v3 API');
      response = await fetch(`${CONFIG.HEYGEN_API_BASE_URL}/v3/videos/${encodeURIComponent(videoId)}`, {
        headers: { 'X-Api-Key': CONFIG.HEYGEN_API_KEY },
      });
      data = await readApiResponse(response);
    }

    if (!response.ok || data.nonJson || data.parseError || (data.code && ![100, 200].includes(data.code))) {
      return res.status(500).json({ 
        error: 'HeyGen 状态查询失败', 
        detail: data,
        message: data.message || '查询失败'
      });
    }

    let status = 'processing';
    let videoUrl = null;
    let thumbnailUrl = null;
    let failureReason = null;

    if (data.data) {
      status = data.data.status || data.data.state || 'processing';
      videoUrl = data.data.video_url || data.data.video_urls?.[0] || null;
      thumbnailUrl = data.data.thumbnail_url || null;
      failureReason = data.data.error?.message || data.data.error || null;
    }

    if (!failureReason && data.error) {
      failureReason = data.error?.message || data.error;
    }

    let progress = 0;
    if (status === 'completed') progress = 100;
    else if (status === 'processing') progress = 50;
    else if (status === 'failed') progress = 0;

    res.json({
      success: true,
      status,
      videoUrl: videoUrl,
      thumbnailUrl: thumbnailUrl,
      progress: progress,
      message: failureReason,
    });
  } catch (err) {
    console.error('[video-status] 错误:', err);
    if (CONFIG.ENABLE_MOCK_FALLBACK) {
      const mockStatus = getMockVideoStatus(videoId);
      if (mockStatus) return res.json(mockStatus);
    }

    res.status(500).json({ error: formatNetworkError(err, 'HeyGen 状态查询服务') });
  }
});

// ─── 路由 4：获取可用 Avatar 列表 ──────────────────────────────────────────
app.get('/api/avatars', async (req, res) => {
  try {
    const fallbackAvatars = Object.entries(HEYGEN_AVATARS).map(([key, id]) => ({
      avatar_id: id,
      avatar_name: key,
      preview_image_url: null
    }));

    if (!CONFIG.HEYGEN_API_KEY || CONFIG.HEYGEN_API_KEY.trim() === '') {
      return res.json({ success: true, avatars: fallbackAvatars, isFallback: true, warning: 'API Key未配置' });
    }

    const response = await fetch(`${CONFIG.HEYGEN_API_BASE_URL}/v2/avatars`, {
      headers: { 'X-Api-Key': CONFIG.HEYGEN_API_KEY },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.data?.avatars) {
        return res.json({ success: true, avatars: data.data.avatars });
      }
    }
    
    res.json({ success: true, avatars: fallbackAvatars, isFallback: true });
  } catch (err) {
    console.error('[avatars] 错误:', err);
    const fallbackAvatars = Object.entries(HEYGEN_AVATARS).map(([key, id]) => ({
      avatar_id: id,
      avatar_name: key,
      preview_image_url: null
    }));
    res.json({ success: true, avatars: fallbackAvatars, isFallback: true });
  }
});

// ─── 路由 5：获取配置状态（安全版，不暴露完整密钥）────────────────────────
app.get('/api/config-status', async (req, res) => {
  res.json({
    success: true,
    config: {
      anthropic: {
        configured: !!(CONFIG.ANTHROPIC_API_KEY && CONFIG.ANTHROPIC_API_KEY.trim() !== ''),
        url: CONFIG.ANTHROPIC_API_URL,
        provider: CONFIG.ANTHROPIC_PROVIDER,
        model: CONFIG.ANTHROPIC_MODEL,
        key_masked: getMaskedKey(CONFIG.ANTHROPIC_API_KEY)
      },
      heygen: {
        configured: !!(CONFIG.HEYGEN_API_KEY && CONFIG.HEYGEN_API_KEY.trim() !== ''),
        key_masked: getMaskedKey(CONFIG.HEYGEN_API_KEY),
        base_url: CONFIG.HEYGEN_API_BASE_URL,
        zh_voice_configured: !!(CONFIG.HEYGEN_ZH_FEMALE_VOICE_ID || CONFIG.HEYGEN_ZH_MALE_VOICE_ID)
      },
      server: {
        port: CONFIG.PORT,
        env: process.env.NODE_ENV || 'development'
      },
      mockFallbackEnabled: CONFIG.ENABLE_MOCK_FALLBACK,
      forceDemoVideo: CONFIG.FORCE_DEMO_VIDEO
    }
  });
});

// ─── 路由 6：本地演示视频直出 ───────────────────────────────────────────────
app.get('/demo-video.mp4', (req, res) => {
  const localVideoPath = path.join(__dirname, '..', CONFIG.DEMO_LOCAL_VIDEO_FILE);
  res.sendFile(localVideoPath, (err) => {
    if (err) {
      res.status(err.statusCode || 404).json({
        error: '本地演示视频不存在',
        message: `请确认文件存在：${CONFIG.DEMO_LOCAL_VIDEO_FILE}`
      });
    }
  });
});

// ─── 静态前端文件 ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── 启动服务器 ──────────────────────────────────────────────────────────────
const server = app.listen(CONFIG.PORT, () => {
  console.log(`\n🚀 数字人演示服务已启动`);
  console.log(`   本地访问：   http://localhost:${CONFIG.PORT}`);
  console.log(`   环境：       ${process.env.NODE_ENV || 'development'}`);
  
  console.log(`\n🔐 API 配置状态：`);
  console.log(`   Anthropic API: ${CONFIG.ANTHROPIC_API_KEY && CONFIG.ANTHROPIC_API_KEY.trim() !== '' ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   HeyGen API:    ${CONFIG.HEYGEN_API_KEY && CONFIG.HEYGEN_API_KEY.trim() !== '' ? '✅ 已配置' : '❌ 未配置'}`);
  
  console.log(`\n📖 API 文档：`);
  console.log(`   POST /api/generate-script   — AI 优化播报脚本`);
  console.log(`   POST /api/create-video      — 提交数字人视频生成`);
  console.log(`   GET  /api/video-status/:id  — 查询视频状态`);
  console.log(`   GET  /api/avatars           — 获取数字人列表`);
  console.log(`   GET  /api/config-status     — 查看配置状态（安全）\n`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});