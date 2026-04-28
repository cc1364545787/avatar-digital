/**
 * 数字人演示平台 — 前端逻辑
 *
 * 架构：
 *   用户交互 → optimizeScript() → POST /api/generate-script → 显示优化脚本
 *   用户点击生成 → generateVideo() → POST /api/create-video → 轮询 /api/video-status/:id
 */

// ── 配置 ───────────────────────────────────────────────────────────────────
const CONFIG = {
  API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : '',
  MAX_POLL_COUNT: 60,      // 最多轮询 60 次（约 5 分钟）
  POLL_INTERVAL: 5000,     // 轮询间隔 5 秒
  TYPEWRITER_SPEED: 18,    // 逐字打印速度
};

// Avatar 名称映射
const AVATAR_NAMES = {
  'female-warm':      '小智 · 教育讲师',
  'male-calm':        '小军 · 培训讲师',
  'female-friendly':  '小慧 · 智能客服',
  'female-elegant':   '小雅 · 文旅讲解',
  'male-pro':         '小政 · 政策顾问',
};

// ── 全局状态 ───────────────────────────────────────────────────────────────
const state = {
  currentScene:   'edu',
  currentScript:  '',
  currentVideoId: null,
  pollTimer:      null,
  stepTimer:      null,
  pollCount:      0,
};

// DOM 元素缓存
const elements = {};

// ── 初始化 ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initSceneCards();
  initTextarea();
  checkApiStatus();

  // 填入默认场景文案
  const defaultCard = document.querySelector('.scene-card.active');
  if (defaultCard) loadScene(defaultCard);
});

// 缓存 DOM 元素
function cacheElements() {
  const ids = [
    'script-input', 'avatar-select', 'voice-select', 'char-count',
    'avatar-label', 'api-status-dot', 'api-status-text', 'btn-optimize',
    'btn-generate', 'step3', 'script-preview', 'result-sub',
    'progress-fill', 'progress-section', 'video-section', 'error-section',
    'error-msg', 'result-video', 'video-source', 'download-btn', 'speaking-bar'
  ];
  ids.forEach(id => { elements[id] = document.getElementById(id); });
}

// ── 场景卡片 ───────────────────────────────────────────────────────────────
function initSceneCards() {
  document.querySelectorAll('.scene-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.scene-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      loadScene(card);
    });
  });
}

function loadScene(card) {
  const text   = card.dataset.text   || '';
  const avatar = card.dataset.avatar || 'female-warm';
  const voice  = card.dataset.voice  || '温柔女声';

  if (elements['script-input']) elements['script-input'].value = text;
  if (elements['avatar-select']) elements['avatar-select'].value = avatar;
  if (elements['voice-select']) elements['voice-select'].value = voice;

  updateCharCount();
  updateAvatarPreview(avatar);
  state.currentScript = text;
  state.currentScene  = card.dataset.scene || 'custom';
}

// ── 文本区 ─────────────────────────────────────────────────────────────────
function initTextarea() {
  if (!elements['script-input']) return;
  elements['script-input'].addEventListener('input', () => {
    updateCharCount();
    state.currentScript = elements['script-input'].value;
  });
}

function updateCharCount() {
  if (!elements['script-input'] || !elements['char-count']) return;
  const val = elements['script-input'].value;
  elements['char-count'].textContent = `${val.length} 字`;
}

// ── Avatar 预览更新 ────────────────────────────────────────────────────────
function updateAvatarPreview(avatarKey) {
  if (elements['avatar-label']) {
    elements['avatar-label'].textContent = AVATAR_NAMES[avatarKey] || '小智 · AI讲师';
  }
}

if (elements['avatar-select']) {
  elements['avatar-select'].addEventListener('change', function() {
    updateAvatarPreview(this.value);
  });
}

// ── API 状态检测 ───────────────────────────────────────────────────────────
async function checkApiStatus() {
  if (!elements['api-status-dot'] || !elements['api-status-text']) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/avatars`, { method: 'GET' });
    if (res.ok) {
      elements['api-status-dot'].classList.add('online');
      elements['api-status-dot'].classList.remove('offline');
      elements['api-status-text'].textContent = '服务在线';
    } else {
      throw new Error('服务异常');
    }
  } catch {
    elements['api-status-dot'].classList.add('offline');
    elements['api-status-dot'].classList.remove('online');
    elements['api-status-text'].textContent = '后端未连接（请启动 server.js）';
  }
}

// ── Step 1：AI 优化脚本 ────────────────────────────────────────────────────
async function optimizeScript() {
  const text = elements['script-input']?.value.trim();
  const voice = elements['voice-select']?.value;
  const style = elements['avatar-select']?.value;
  const btn = elements['btn-optimize'];

  if (!text) { showToast('请先输入文案'); return; }

  setButtonLoading(btn, true, '优化中...');
  setSpeaking(true);

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, style, platform: 'HeyGen' }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '优化失败');

    // 逐字打印效果
    if (elements['script-input']) {
      elements['script-input'].value = '';
      await typeWriter(elements['script-input'], data.script);
    }

    updateCharCount();
    state.currentScript = data.script;

    if (data.warning) showToast(`提示：${data.warning}`, 'error');
    showToast(`✓ 脚本已优化 · ${data.stats?.chars || data.script.length} 字 · 用时约 ${data.stats?.estimatedSeconds || '?'}ms`);
  } catch (err) {
    showToast('优化失败：' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false, 'AI 优化脚本');
    setSpeaking(false);
  }
}

// 逐字打印
function typeWriter(element, text, speed = CONFIG.TYPEWRITER_SPEED) {
  return new Promise(resolve => {
    let i = 0;
    element.value = '';
    const interval = setInterval(() => {
      if (i < text.length) {
        element.value += text[i++];
        element.scrollTop = element.scrollHeight;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}

// ── Step 2：生成数字人视频 ─────────────────────────────────────────────────
async function generateVideo() {
  const script = elements['script-input']?.value.trim();
  const voice  = elements['voice-select']?.value;
  const avatar = elements['avatar-select']?.value;
  const btn    = elements['btn-generate'];

  if (!script) { showToast('请先输入或生成播报脚本'); return; }
  if (script.length < 10) { showToast('脚本太短，至少需要10个字'); return; }

  // 显示 step3
  if (elements.step3) {
    elements.step3.style.display = 'block';
    elements.step3.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  resetStep3UI();

  if (elements['script-preview']) {
    elements['script-preview'].textContent = `播报内容：${script}`;
  }

  setButtonLoading(btn, true, '提交生成任务...');
  setSpeaking(true);

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/create-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, voice, avatarKey: avatar }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '提交失败');

    state.currentVideoId = data.video_id;
    if (elements['result-sub']) {
      elements['result-sub'].textContent = data.demoMode
        ? '视频生成中，通常需要 1-3 分钟...'
        : '视频生成中，通常需要 1-3 分钟...';
    }

    if (data.warning) showToast(`提示：${data.warning}`, 'error');

    startPolling(data.video_id);
  } catch (err) {
    showError(err.message);
    setButtonLoading(btn, false, '生成数字人视频');
    setSpeaking(false);
  }
}

// ── 轮询视频状态 ───────────────────────────────────────────────────────────
function startPolling(videoId) {
  // 清理已有的定时器
  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.stepTimer) clearInterval(state.stepTimer);

  state.pollCount = 0;

  const steps = ['pstep-1', 'pstep-2', 'pstep-3', 'pstep-4'];
  let stepIndex = 1;

  function advanceStep() {
    if (stepIndex < steps.length) {
      const dot = document.querySelector(`#${steps[stepIndex]} .pstep-dot`);
      if (dot) dot.classList.add('active');
      stepIndex++;
    }
  }

  // 每 8 秒推进一个步骤（视觉效果）
  state.stepTimer = setInterval(advanceStep, 8000);

  state.pollTimer = setInterval(async () => {
    state.pollCount++;

    if (state.pollCount > CONFIG.MAX_POLL_COUNT) {
      cleanupPolling();
      showError('生成超时，请重试');
      return;
    }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/video-status/${videoId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '查询失败');

      // 更新进度条
      const progress = Math.min(data.progress || (state.pollCount * 2), 95);
      if (elements['progress-fill']) {
        elements['progress-fill'].style.width = progress + '%';
      }

      if (data.demoMode && data.message && elements['result-sub']) {
        elements['result-sub'].textContent = data.message;
      }

      if (data.status === 'completed' && data.videoUrl) {
        cleanupPolling();
        onVideoReady(data.videoUrl, data.thumbnailUrl);
      } else if (data.status === 'failed') {
        cleanupPolling();
        showError(data.message || '视频生成失败，请检查 HeyGen API 配额');
      }
    } catch (err) {
      console.error('[poll]', err);
    }
  }, CONFIG.POLL_INTERVAL);
}

function cleanupPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.stepTimer) clearInterval(state.stepTimer);
  state.pollTimer = null;
  state.stepTimer = null;
}

// ── 视频就绪 ───────────────────────────────────────────────────────────────
function onVideoReady(videoUrl, thumbnailUrl) {
  // 完成进度
  if (elements['progress-fill']) elements['progress-fill'].style.width = '100%';
  document.querySelectorAll('.pstep-dot').forEach(d => {
    d.classList.remove('active');
    d.classList.add('done');
  });

  if (elements['progress-section']) elements['progress-section'].style.display = 'none';
  if (elements['video-section']) elements['video-section'].style.display = 'block';
  if (elements['result-sub']) elements['result-sub'].textContent = '✓ 视频生成完成！';

  const videoEl = elements['result-video'];
  const sourceEl = elements['video-source'];
  if (videoEl && sourceEl) {
    sourceEl.src = videoUrl;
    videoEl.load();
    videoEl.play().catch(() => {}); // 自动播放（可能被浏览器阻止）
  }

  if (elements['download-btn']) {
    elements['download-btn'].href = videoUrl;
    elements['download-btn'].download = `数字人_${Date.now()}.mp4`;
  }

  setButtonLoading(elements['btn-generate'], false, '生成数字人视频');
  setSpeaking(false);

  showToast('✓ 数字人视频已生成完毕！');
}

// ── 错误显示 ───────────────────────────────────────────────────────────────
function showError(msg) {
  if (elements['progress-section']) elements['progress-section'].style.display = 'none';
  if (elements['error-section']) elements['error-section'].style.display = 'block';
  if (elements['error-msg']) elements['error-msg'].textContent = msg;

  setSpeaking(false);
  setButtonLoading(elements['btn-generate'], false, '生成数字人视频');
}

// ── 重置 ───────────────────────────────────────────────────────────────────
function resetDemo() {
  cleanupPolling();
  state.currentVideoId = null;
  state.pollCount = 0;

  if (elements.step3) elements.step3.style.display = 'none';
  resetStep3UI();

  if (elements['btn-generate']) {
    elements['btn-generate'].disabled = false;
    elements['btn-generate'].innerHTML = '<span class="btn-icon">▶</span> 生成数字人视频';
  }
  setSpeaking(false);
}

function resetStep3UI() {
  if (elements['progress-fill']) elements['progress-fill'].style.width = '0%';
  if (elements['progress-section']) elements['progress-section'].style.display = 'block';
  if (elements['video-section']) elements['video-section'].style.display = 'none';
  if (elements['error-section']) elements['error-section'].style.display = 'none';
  if (elements['script-preview']) elements['script-preview'].textContent = '';

  document.querySelectorAll('.pstep-dot').forEach((d, i) => {
    d.classList.remove('active', 'done');
    if (i === 0) d.classList.add('active');
  });
}

// ── 分享面板 ──────────────────────────────────────────────────────────────
function showSharePanel() {
  const url = elements['video-source']?.src;
  if (!url) return;
  navigator.clipboard.writeText(url)
    .then(() => showToast('视频链接已复制到剪贴板'))
    .catch(() => showToast('请手动复制地址栏链接'));
}

// ── 辅助函数 ───────────────────────────────────────────────────────────────
function setButtonLoading(btn, isLoading, loadingText = '处理中...', originalHtml = null) {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-icon">⋯</span> ${loadingText}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalHtml || btn.getAttribute('data-original-html') || btn.innerHTML;
  }
}

function setSpeaking(isSpeaking) {
  if (elements['speaking-bar']) {
    elements['speaking-bar'].style.display = isSpeaking ? 'flex' : 'none';
  }
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.log('[toast]', msg);
    return;
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// 导出全局函数（供 HTML 调用）
window.optimizeScript = optimizeScript;
window.generateVideo = generateVideo;
window.resetDemo = resetDemo;
window.showSharePanel = showSharePanel;