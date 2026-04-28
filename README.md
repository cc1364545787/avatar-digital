# 数字人演示平台

> 课堂开场演示工具：输入文字 → AI优化脚本 → 生成真实数字人视频

---

## 目录结构

```
digital-human-demo/
├── frontend/
│   ├── index.html      # 主页面
│   ├── style.css       # 样式（支持暗色模式）
│   └── app.js          # 前端逻辑
├── backend/
│   ├── server.js       # Express 后端服务
│   └── package.json
└── README.md
```

---

## 快速启动

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置 API Key

**方式A（推荐）：环境变量**
```bash
export ANTHROPIC_API_KEY='Your_ANTHROPIC_API_KEY'
export HEYGEN_API_KEY='Your_HEYGEN_API_KEY'
```

#### Anthropic / OpenAI 兼容上游说明（重要）

本项目的“脚本优化”支持两种上游模式：

- **OpenAI 兼容模式（默认）**：`ANTHROPIC_PROVIDER=openai_compatible`，请求 `ANTHROPIC_API_URL` 的 `/v1/chat/completions` 风格接口，Header 用 `Authorization: Bearer ...`。
- **Anthropic 官方模式**：`ANTHROPIC_PROVIDER=anthropic`，请求 Anthropic Messages API（如 `https://api.anthropic.com/v1/messages`），Header 用 `x-api-key` + `anthropic-version`。

你需要确保 **`ANTHROPIC_API_KEY` 与 `ANTHROPIC_API_URL` 是同一服务商的一组配置**，否则会出现 401。

示例（Anthropic 官方）：

```bash
export ANTHROPIC_PROVIDER=anthropic
export ANTHROPIC_API_URL='https://api.anthropic.com/v1/messages'
export ANTHROPIC_MODEL='claude-3-5-sonnet-latest'
export ANTHROPIC_VERSION='2023-06-01'
```

示例（OpenAI 兼容中转）：

```bash
export ANTHROPIC_PROVIDER=openai_compatible
export ANTHROPIC_API_URL='https://your-gateway.example.com/v1/chat/completions'
export ANTHROPIC_MODEL='gpt-3.5-turbo'
```

#### HeyGen 中文语音（解决 “Unable to generate audio...”）

如果你遇到：
`Unable to generate audio. This voice may not support this language.`

说明当前 `voice_id` 不支持中文。部分 HeyGen Key 可能无法访问 `/v2/voices` 来自动查询 voice 列表，因此需要手动在 `.env` 配置一个支持 `zh-CN` 的 voice_id：

```bash
export HEYGEN_ZH_FEMALE_VOICE_ID='your_zh_cn_female_voice_id'
export HEYGEN_ZH_MALE_VOICE_ID='your_zh_cn_male_voice_id'
```

**方式B：直接修改 server.js**
```js
const CONFIG = {
  ANTHROPIC_API_KEY: 'Your_ANTHROPIC_API_KEY',
  HEYGEN_API_KEY:    'Your_HEYGEN_API_KEY',
  PORT: 3000,
};
```

### 3. 启动服务

```bash
node server.js
# 或开发模式（Node 18+）：
node --watch server.js
```

### 4. 访问页面

打开浏览器：http://localhost:3000

---

## 如何获取 API Key

### Anthropic（Claude）
1. 访问 https://console.anthropic.com
2. 进入 API Keys 页面
3. 创建新 Key（以 `sk-ant-` 开头）

### HeyGen
1. 访问 https://app.heygen.com
2. 点击右上角头像 → API
3. 生成 API Key
4. 注意：免费账号有 Credit 限制，建议先购买 Creator 套餐（$29/月）

---

## API 接口说明

### POST /api/generate-script
AI优化播报脚本

**请求体：**
```json
{
  "text": "原始文案",
  "voice": "温柔女声",
  "style": "教育讲解",
  "platform": "HeyGen"
}
```

**返回：**
```json
{
  "success": true,
  "script": "优化后的脚本...",
  "stats": {
    "chars": 180,
    "estimatedSeconds": 40,
    "estimatedCost": "0.360"
  }
}
```

---

### POST /api/create-video
提交数字人视频生成任务

**请求体：**
```json
{
  "script": "要播报的文字",
  "voice": "温柔女声",
  "avatarKey": "female-warm"
}
```

**返回：**
```json
{
  "success": true,
  "video_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "视频生成任务已提交"
}
```

---

### GET /api/video-status/:videoId
查询视频生成进度

**返回：**
```json
{
  "success": true,
  "status": "completed",       // processing | completed | failed
  "videoUrl": "https://...",   // 完成时才有
  "thumbnailUrl": "https://...",
  "progress": 100
}
```

---

## 部署方案

### 方案A：本地演示（最简单）
直接运行 `node server.js`，课堂上用自己电脑演示即可。

### 方案B：内网部署（部队/企业）
```bash
# 在内网服务器上运行
PORT=8080 node server.js
# 局域网内其他设备访问：http://[服务器IP]:8080
```

### 方案C：云端部署（阿里云/腾讯云）
```bash
# 使用 PM2 守护进程
npm install -g pm2
pm2 start server.js --name digital-human
pm2 save
pm2 startup
```

---

## 扩展开发计划

- [ ] 接入硅基流动（国产替代 HeyGen）
- [ ] 接入腾讯智影 API
- [ ] 支持实时直播流输出
- [ ] 添加知识库问答（RAG）
- [ ] 微信小程序版本
- [ ] 后台管理面板（视频历史记录）

---

## 成本估算

| 操作 | 成本 |
|------|------|
| 脚本生成（Claude Sonnet） | ~¥0.01/次 |
| 数字人视频（HeyGen） | ~¥0.5-2/条（取决于时长） |
| 服务器（阿里云 ECS 入门型） | ~¥99/月 |

**培训课演示场景**：每次课程演示约 3-5 个视频，成本约 ¥2-10，可忽略不计。

---

## 联系与支持

如需定制开发（内网离线部署、微信小程序版、企业定制形象），请联系开发团队。
