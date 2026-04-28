/**
 * 数字人演示平台 — 前端逻辑（优化版）
 * 
 * 功能：
 * - 科技大气的 UI 交互
 * - 真实 AI 脚本优化（调用 Claude API）
 * - 优先使用男声（匹配男性数字人形象）
 */

// ── 配置 ───────────────────────────────────────────────────────────────────
const CONFIG = {
  API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : '',
  MAX_POLL_COUNT: 60,
  POLL_INTERVAL: 5000,
  TYPEWRITER_SPEED: 18,
};

// 声音配置（优先匹配演示视频的男性形象）
const VOICE_PRIORITY = {
  default: '沉稳男声',  // 默认使用男声
  male: ['沉稳男声', '专业男声'],
  female: ['温柔女声', '亲切女声', '文艺女声']
};

// Avatar 名称映射
const AVATAR_NAMES = {
  'female-warm': '小智 · 教育讲师',
  'male-calm': '小军 · 培训讲师',
  'female-friendly': '小慧 · 智能客服',
  'female-elegant': '小雅 · 文旅讲解',
  'male-pro': '小政 · 政策顾问',
};

// ── 全局状态 ───────────────────────────────────────────────────────────────
const state = {
  currentScene: 'edu',
  currentScript: '',
  currentVideoId: null,
  pollTimer: null,
  stepTimer: null,
  pollCount: 0,
};

// DOM 元素缓存
const elements = {};

// ── 初始化 ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initSceneCards();
  initTextarea();
  initAvatarSelect();
  initVoiceSelect();
  initBackgroundSelect();
  checkApiStatus();

  // 默认选择男性声音（匹配演示视频）
  const voiceSelect = elements['voice-select'];
  if (voiceSelect && voiceSelect.value !== '沉稳男声') {
    voiceSelect.value = '沉稳男声';
  }
  updateAvatarPreview(elements['avatar-select']?.value || 'male-calm');

  // 填入默认场景文案
  const defaultCard = document.querySelector('.scene-card.active');
  if (defaultCard) loadScene(defaultCard);
});

// 缓存 DOM 元素
function cacheElements() {
  const ids = [
    'script-input', 'avatar-select', 'voice-select', 'bg-select',
    'char-count', 'avatar-label', 'api-status-dot', 'api-status-text',
    'btn-optimize', 'btn-generate', 'step3', 'script-preview',
    'result-sub', 'progress-fill', 'progress-section', 'video-section',
    'error-section', 'error-msg', 'result-video', 'video-source',
    'download-btn', 'speaking-bar', 'avatar-screen'
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
  const text = card.dataset.text || '';
  const avatar = card.dataset.avatar || 'male-calm';
  const voice = card.dataset.voice || '沉稳男声';

  if (elements['script-input']) elements['script-input'].value = text;
  if (elements['avatar-select']) elements['avatar-select'].value = avatar;
  if (elements['voice-select']) elements['voice-select'].value = voice;

  updateCharCount();
  updateAvatarPreview(avatar);
  updateSpeakingAnimation(avatar);
  state.currentScript = text;
  state.currentScene = card.dataset.scene || 'custom';
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

// ── Avatar 选择 ────────────────────────────────────────────────────────────
function initAvatarSelect() {
  if (!elements['avatar-select']) return;
  elements['avatar-select'].addEventListener('change', function() {
    updateAvatarPreview(this.value);
    updateSpeakingAnimation(this.value);
    // 根据形象自动推荐声音
    const isMale = this.value === 'male-calm' || this.value === 'male-pro';
    if (elements['voice-select']) {
      elements['voice-select'].value = isMale ? '沉稳男声' : '温柔女声';
    }
  });
}

function initVoiceSelect() {
  if (!elements['voice-select']) return;
  elements['voice-select'].addEventListener('change', function() {
    // 可以添加声音预览功能
    console.log('声音已切换为:', this.value);
  });
}

function initBackgroundSelect() {
  if (!elements['bg-select']) return;
  elements['bg-select'].addEventListener('change', function() {
    if (elements['avatar-screen']) {
      elements['avatar-screen'].style.background = `linear-gradient(135deg, ${this.value}20, rgba(0, 102, 255, 0.02))`;
    }
  });
}

function updateAvatarPreview(avatarKey) {
  if (elements['avatar-label']) {
    elements['avatar-label'].textContent = AVATAR_NAMES[avatarKey] || '小军 · 培训讲师';
  }
}

function updateSpeakingAnimation(avatarKey) {
  const isMale = avatarKey === 'male-calm' || avatarKey === 'male-pro';
  const circle = document.querySelector('.avatar-circle');
  if (circle) {
    const gradient = isMale 
      ? 'linear-gradient(135deg, #00d4ff, #0066ff)'
      : 'linear-gradient(135deg, #ff6b9d, #ff2d75)';
    circle.style.background = gradient;
  }
}

// ── API 状态检测 ───────────────────────────────────────────────────────────
async function checkApiStatus() {
  if (!elements['api-status-dot'] || !elements['api-status-text']) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/avatars`, { method: 'GET' });
    if (res.ok) {
      elements['api-status-dot'].classList.add('online');
      elements['api-status-dot'].classList.remove('offline');
      elements['api-status-text'].textContent = '服务在线 | API 就绪';
    } else {
      throw new Error('服务异常');
    }
  } catch {
    elements['api-status-dot'].classList.add('offline');
    elements['api-status-dot'].classList.remove('online');
    elements['api-status-text'].textContent = '后端未连接（请启动 server.js）';
  }
}

// ── Step 1：AI 优化脚本（真实调用 API）────────────────────────────────────
async function optimizeScript() {
  const text = elements['script-input']?.value.trim();
  const voice = elements['voice-select']?.value;
  const style = elements['avatar-select']?.value;
  const btn = elements['btn-optimize'];

  if (!text) { showToast('请先输入文案'); return; }

  setButtonLoading(btn, true, 'AI 优化中...');
  setSpeaking(true);

  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, style, platform: 'HeyGen' }),
    });

    const data = await response.json();

    if (!response.ok || (data.error && !data.fallback)) {
      throw new Error(data.error || data.message || '优化失败');
    }

    // 显示优化后的脚本
    if (elements['script-input']) {
      elements['script-input'].value = data.script;
      updateCharCount();
      state.currentScript = data.script;
    }

    if (data.fallback) {
      showToast(`⚠️ ${data.warning || '使用本地优化'}`, 'warning');
    } else {
      const stats = data.stats || {};
      showToast(`✓ 脚本优化完成 · ${stats.chars || data.script.length} 字`);
    }
  } catch (err) {
    console.error('[optimizeScript] Error:', err);
    showToast('优化失败：' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false, 'AI 优化脚本');
    setSpeaking(false);
  }
}

// ── Step 2：生成数字人视频 ─────────────────────────────────────────────────
async function generateVideo() {
  const script = elements['script-input']?.value.trim();
  const voice = elements['voice-select']?.value;
  const avatar = elements['avatar-select']?.value;
  const btn = elements['btn-generate'];

  if (!script) { showToast('请先输入或生成播报脚本'); return; }
  if (script.length < 10) { showToast('脚本太短，至少需要10个字'); return; }

  // 显示 step3
  if (elements.step3) {
    elements.step3.style.display = 'block';
    elements.step3.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  resetStep3UI();

  if (elements['script-preview']) {
    const previewText = script.length > 200 ? script.substring(0, 200) + '...' : script;
    elements['script-preview'].textContent = `📝 播报内容：${previewText}`;
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
        ? '🎬 演示模式：正在生成视频...'
        : '🎬 视频生成中，通常需要 1-3 分钟...';
    }

    if (data.warning) showToast(`⚠️ ${data.warning}`, 'warning');

    startPolling(data.video_id);
  } catch (err) {
    showError(err.message);
    setButtonLoading(btn, false, '生成数字人视频');
    setSpeaking(false);
  }
}

// ── 轮询视频状态 ───────────────────────────────────────────────────────────
function startPolling(videoId) {
  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.stepTimer) clearInterval(state.stepTimer);

  state.pollCount = 0;

  const steps = ['pstep-1', 'pstep-2', 'pstep-3', 'pstep-4', 'pstep-5'];
  let stepIndex = 1;

  function advanceStep() {
    if (stepIndex < steps.length) {
      const dot = document.querySelector(`#${steps[stepIndex]} .pstep-dot`);
      if (dot) dot.classList.add('active');
      stepIndex++;
    }
  }

  state.stepTimer = setInterval(advanceStep, 6000);

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
        showError(data.message || '视频生成失败，请检查 API 配额');
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
    videoEl.play().catch(() => console.log('自动播放被浏览器阻止'));
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

// ── 分享功能 ──────────────────────────────────────────────────────────────
function showSharePanel() {
  const url = elements['video-source']?.src;
  if (!url) {
    showToast('没有可分享的视频', 'error');
    return;
  }
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
    btn.innerHTML = originalHtml || btn.getAttribute('data-original-html') || 
      (btn.id === 'btn-optimize' ? '<span class="btn-icon">✦</span> AI 优化脚本' : 
       '<span class="btn-icon">▶</span> 生成数字人视频');
  }
}

function setSpeaking(isSpeaking) {
  const bar = elements['speaking-bar'];
  if (bar) {
    bar.style.display = isSpeaking ? 'flex' : 'none';
    if (isSpeaking) {
      bar.style.animation = 'none';
      bar.offsetHeight;
      bar.style.animation = null;
    }
  }
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.log('[toast]', msg);
    return;
  }
  const colors = {
    success: '#00d4ff',
    error: '#ff6666',
    warning: '#ffaa44'
  };
  toast.style.borderColor = colors[type] || colors.success;
  toast.style.color = colors[type] || colors.success;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// 导出全局函数
window.optimizeScript = optimizeScript;
window.generateVideo = generateVideo;
window.resetDemo = resetDemo;
window.showSharePanel = showSharePanel;