/**
 * 数字人演示平台 — 前端逻辑
 *
 * 架构：
 *   用户交互 → optimizeScript() → POST /api/generate-script → 显示优化脚本
 *   用户点击生成 → generateVideo() → POST /api/create-video → 轮询 /api/video-status/:id
 */

// ── 配置 ───────────────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://localhost:3000`
  : '';  // 生产环境同域

// Avatar 名称映射
const AVATAR_NAMES = {
  'female-warm':      '小智 · 教育讲师',
  'male-calm':        '小军 · 培训讲师',
  'female-friendly':  '小慧 · 智能客服',
  'female-elegant':   '小雅 · 文旅讲解',
  'male-pro':         '小政 · 政策顾问',
};

// ── 全局状态 ───────────────────────────────────────────────────────────────
let state = {
  currentScene:   'edu',
  currentScript:  '',
  currentVideoId: null,
  pollTimer:      null,
  pollCount:      0,
};

// ── 初始化 ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSceneCards();
  initTextarea();
  checkApiStatus();

  // 填入默认场景文案
  const defaultCard = document.querySelector('.scene-card.active');
  if (defaultCard) loadScene(defaultCard);
});

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

  document.getElementById('script-input').value = text;
  document.getElementById('avatar-select').value = avatar;
  document.getElementById('voice-select').value  = voice;

  updateCharCount();
  updateAvatarPreview(avatar);
  state.currentScript = text;
  state.currentScene  = card.dataset.scene || 'custom';
}

// ── 文本区 ─────────────────────────────────────────────────────────────────
function initTextarea() {
  const ta = document.getElementById('script-input');
  ta.addEventListener('input', () => {
    updateCharCount();
    state.currentScript = ta.value;
  });
}

function updateCharCount() {
  const val = document.getElementById('script-input').value;
  document.getElementById('char-count').textContent = `${val.length} 字`;
}

// ── Avatar 预览更新 ────────────────────────────────────────────────────────
function updateAvatarPreview(avatarKey) {
  const label = document.getElementById('avatar-label');
  if (label) label.textContent = AVATAR_NAMES[avatarKey] || '小智 · AI讲师';
}

document.getElementById('avatar-select')?.addEventListener('change', function() {
  updateAvatarPreview(this.value);
});

// ── API 状态检测 ───────────────────────────────────────────────────────────
async function checkApiStatus() {
  const dot  = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  try {
    const res = await fetch(`${API_BASE}/api/avatars`, { method: 'GET' });
    if (res.ok) {
      dot.classList.add('online');
      text.textContent = '服务在线';
    } else {
      throw new Error('服务异常');
    }
  } catch {
    dot.classList.add('offline');
    text.textContent = '后端未连接（请启动 server.js）';
  }
}

// ── Step 1：AI 优化脚本 ────────────────────────────────────────────────────
async function optimizeScript() {
  const text  = document.getElementById('script-input').value.trim();
  const voice = document.getElementById('voice-select').value;
  const style = document.getElementById('avatar-select').value;
  const btn   = document.getElementById('btn-optimize');

  if (!text) { showToast('请先输入文案'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⋯</span> 优化中...';

  // 开始说话动画
  setSpeaking(true);

  try {
    const res = await fetch(`${API_BASE}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, style, platform: 'HeyGen' }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '优化失败');

    // 逐字打印效果
    const ta = document.getElementById('script-input');
    ta.value = '';
    await typeWriter(ta, data.script);

    updateCharCount();
    state.currentScript = data.script;

    if (data.warning) {
      showToast(`提示：${data.warning}`, 'error');
    }

    showToast(`✓ 脚本已优化 · ${data.stats.chars} 字 · 用时约 ${data.stats.estimatedSeconds}ms`);
  } catch (err) {
    showToast('优化失败：' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">✦</span> AI 优化脚本';
    setSpeaking(false);
  }
}

// 逐字打印
function typeWriter(element, text, speed = 18) {
  return new Promise(resolve => {
    let i = 0;
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
  const script = document.getElementById('script-input').value.trim();
  const voice  = document.getElementById('voice-select').value;
  const avatar = document.getElementById('avatar-select').value;
  const btn    = document.getElementById('btn-generate');

  if (!script) { showToast('请先输入或生成播报脚本'); return; }
  if (script.length < 10) { showToast('脚本太短，至少需要10个字'); return; }

  // 显示 step3
  const step3 = document.getElementById('step3');
  step3.style.display = 'block';
  step3.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 重置 step3 UI
  resetStep3UI();

  // 保存脚本用于展示
  document.getElementById('script-preview').textContent = `播报内容：${script}`;

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⋯</span> 提交生成任务...';
  setSpeaking(true);

  try {
    const res = await fetch(`${API_BASE}/api/create-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, voice, avatarKey: avatar }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '提交失败');

    state.currentVideoId = data.video_id;
    document.getElementById('result-sub').textContent = data.demoMode
      ? '外部视频服务暂不可用，已切换到本地演示模式...'
      : '视频生成中，通常需要 1-3 分钟...';

    if (data.warning) {
      showToast(`提示：${data.warning}`, 'error');
    }

    // 开始轮询
    startPolling(data.video_id);
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">▶</span> 生成数字人视频';
    setSpeaking(false);
  }
}

// ── 轮询视频状态 ───────────────────────────────────────────────────────────
function startPolling(videoId) {
  state.pollCount = 0;
  const maxPolls = 60; // 最多轮询 60 次（约 5 分钟）

  // 模拟进度步骤
  const steps = ['pstep-1', 'pstep-2', 'pstep-3', 'pstep-4'];
  let stepIndex = 1;

  function advanceStep() {
    if (stepIndex < steps.length) {
      document.querySelector(`#${steps[stepIndex]} .pstep-dot`)?.classList.add('active');
      stepIndex++;
    }
  }

  // 每 5 秒推进一个步骤（视觉效果）
  const stepTimer = setInterval(advanceStep, 8000);

  state.pollTimer = setInterval(async () => {
    state.pollCount++;

    if (state.pollCount > maxPolls) {
      clearInterval(state.pollTimer);
      clearInterval(stepTimer);
      showError('生成超时，请重试');
      return;
    }

    try {
      const res  = await fetch(`${API_BASE}/api/video-status/${videoId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '查询失败');

      // 更新进度条
      const progress = Math.min(data.progress || (state.pollCount * 2), 95);
      document.getElementById('progress-fill').style.width = progress + '%';

      if (data.demoMode && data.message) {
        document.getElementById('result-sub').textContent = data.message;
      }

      if (data.status === 'completed' && data.videoUrl) {
        clearInterval(state.pollTimer);
        clearInterval(stepTimer);
        onVideoReady(data.videoUrl, data.thumbnailUrl);
      } else if (data.status === 'failed') {
        clearInterval(state.pollTimer);
        clearInterval(stepTimer);
        showError(data.message || '视频生成失败，请检查 HeyGen API 配额');
      }
      // 'processing' → 继续轮询
    } catch (err) {
      console.error('[poll]', err);
    }
  }, 5000); // 每 5 秒轮询一次
}

// ── 视频就绪 ───────────────────────────────────────────────────────────────
function onVideoReady(videoUrl, thumbnailUrl) {
  // 完成进度
  document.getElementById('progress-fill').style.width = '100%';
  document.querySelectorAll('.pstep-dot').forEach(d => {
    d.classList.remove('active');
    d.classList.add('done');
  });

  // 显示视频
  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('video-section').style.display = 'block';
  document.getElementById('result-sub').textContent = '✓ 视频生成完成！';

  const video  = document.getElementById('result-video');
  const source = document.getElementById('video-source');
  source.src = videoUrl;
  video.load();
  video.play().catch(() => {}); // 自动播放（可能被浏览器阻止）

  // 下载按钮
  const dlBtn = document.getElementById('download-btn');
  dlBtn.href = videoUrl;
  dlBtn.download = `数字人_${Date.now()}.mp4`;

  // 恢复按钮
  const btn = document.getElementById('btn-generate');
  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">▶</span> 生成数字人视频';
  setSpeaking(false);

  showToast('✓ 数字人视频已生成完毕！');
}

// ── 错误显示 ───────────────────────────────────────────────────────────────
function showError(msg) {
  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('error-section').style.display = 'block';
  document.getElementById('error-msg').textContent = msg;
  setSpeaking(false);

  const btn = document.getElementById('btn-generate');
  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">▶</span> 生成数字人视频';
}

// ── 重置 ───────────────────────────────────────────────────────────────────
function resetDemo() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.currentVideoId = null;
  state.pollCount = 0;

  document.getElementById('step3').style.display = 'none';
  resetStep3UI();

  document.getElementById('btn-generate').disabled = false;
  document.getElementById('btn-generate').innerHTML = '<span class="btn-icon">▶</span> 生成数字人视频';
  setSpeaking(false);
}

function resetStep3UI() {
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-section').style.display = 'block';
  document.getElementById('video-section').style.display = 'none';
  document.getElementById('error-section').style.display = 'none';
  document.getElementById('script-preview').textContent = '';

  document.querySelectorAll('.pstep-dot').forEach((d, i) => {
    d.classList.remove('active', 'done');
    if (i === 0) d.classList.add('active');
  });
}

// ── 分享面板（可扩展）─────────────────────────────────────────────────────
function showSharePanel() {
  const url = document.getElementById('video-source')?.src;
  if (!url) return;
  navigator.clipboard.writeText(url)
    .then(() => showToast('视频链接已复制到剪贴板'))
    .catch(() => showToast('请手动复制地址栏链接'));
}

// ── Avatar 说话动画 ────────────────────────────────────────────────────────
function setSpeaking(isSpeaking) {
  const bar = document.getElementById('speaking-bar');
  if (bar) bar.style.display = isSpeaking ? 'flex' : 'none';
}

// ── Toast 通知 ─────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
