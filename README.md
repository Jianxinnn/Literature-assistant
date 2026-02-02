# Literature Assistant - Standalone

AI-powered scientific literature analysis assistant. Upload PDF papers and get intelligent analysis, summaries, and Q&A capabilities.

## Features

- PDF literature upload and parsing
- Multiple AI models support (Gemini, GPT, DeepSeek, etc.)
- Real-time streaming responses
- Multiple analysis modes (quick summary, deep dive, critique, etc.)
- Session management
- Google OAuth authentication
- Community sharing (optional)

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Google Cloud project (for OAuth)

### Local Development

#### Step 1: 安装依赖

```bash
cd literature-assistant-standalone
npm run setup    # 这会安装 root、backend、frontend 三个目录的依赖
```

#### Step 2: 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件（见下方 Google OAuth 配置说明）。

#### Step 3: 配置 Google OAuth（详细步骤）

**3.1 创建 Google Cloud 项目**

1. 打开 [Google Cloud Console](https://console.cloud.google.com)
2. 点击顶部项目选择器 → **New Project**
3. 项目名称随意填写，如 `literature-assistant`
4. 点击 **Create**

**3.2 配置 OAuth 同意屏幕**

1. 左侧菜单：**APIs & Services** → **OAuth consent screen**
2. User Type 选择 **External** → **Create**
3. 填写必填项：
   - App name: `Literature Assistant`
   - User support email: 你的邮箱
   - Developer contact: 你的邮箱
4. 点击 **Save and Continue** 跳过 Scopes 和 Test users
5. 回到 Summary 点击 **Back to Dashboard**

**3.3 创建 OAuth 凭据**

1. 左侧菜单：**APIs & Services** → **Credentials**
2. 点击 **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Literature Assistant Local`
5. **Authorized JavaScript origins** 添加：
   - `http://localhost:3000`
   - `http://localhost:5173`
6. **Authorized redirect URIs** 添加：
   - `http://localhost:3000/api/auth/google/callback`
7. 点击 **Create**
8. 复制 **Client ID** 和 **Client Secret**

**3.4 更新 .env 文件**

```bash
# Google OAuth
GOOGLE_CLIENT_ID=你复制的Client_ID
GOOGLE_CLIENT_SECRET=你复制的Client_Secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# JWT & Session (随便填一个长字符串)
JWT_SECRET=my-super-secret-jwt-key-12345
SESSION_SECRET=my-super-secret-session-key-12345

# 前端地址
FRONTEND_URL=http://localhost:5173
```

#### Step 4: 配置 LLM Provider

至少配置一个 LLM API Key：

```bash
# Gemini (推荐，免费额度大)
GEMINI_API_KEY=你的API密钥

# 或 OpenAI
OPENAI_API_KEY=你的API密钥

# 或 DeepSeek
DEEPSEEK_API_KEY=你的API密钥
```

#### Step 5: 启动开发服务器

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3000

#### 常见问题

**Q: `concurrently: not found`**
```bash
npm install   # 在根目录安装依赖
```

**Q: `Cannot find module 'xxx'`**
```bash
npm run setup   # 重新安装所有依赖
```

**Q: Google 登录报错 `redirect_uri_mismatch`**
- 检查 Google Console 中的 redirect URI 是否完全匹配 `http://localhost:3000/api/auth/google/callback`
- 注意是 http 不是 https，端口是 3000 不是 5173

## Production Deployment

### Using Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

### Manual Deployment

```bash
# Build frontend
npm run build

# Start production server
NODE_ENV=production npm start
```

### Deploy to Zeabur

Zeabur 是一个简单的云部署平台，支持自动从 GitHub 部署。

#### 本地开发 vs Zeabur 部署配置对比

| 配置项 | 本地开发 | Zeabur 生产环境 |
|--------|---------|----------------|
| `NODE_ENV` | `development` | `production` |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/api/auth/google/callback` | `https://你的域名/api/auth/google/callback` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://你的域名` |
| Google OAuth 重定向 URI | `http://localhost:3000/...` | 需要在 Google Console 添加生产域名 |

**核心区别：只需要改 3 个地方：**
1. `GOOGLE_CALLBACK_URL` - 改成 Zeabur 分配的域名
2. `FRONTEND_URL` - 改成 Zeabur 分配的域名
3. Google Cloud Console - 添加新的授权重定向 URI

#### 部署步骤

**Step 1: 推送代码到 GitHub**

```bash
cd literature-assistant-standalone
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/literature-assistant-standalone.git
git push -u origin main
```

**Step 2: 在 Zeabur 创建项目**

1. 访问 https://zeabur.com 并登录（支持 GitHub 登录）
2. 点击 **"New Project"**
3. 选择 **"Deploy from GitHub"**
4. 授权并选择你的仓库

**Step 3: 配置环境变量**

在 Zeabur 项目的 **Variables** 页面添加：

```bash
# 必须配置
NODE_ENV=production
JWT_SECRET=你的随机密钥32位以上
SESSION_SECRET=你的随机密钥32位以上
GOOGLE_CLIENT_ID=你的Google客户端ID
GOOGLE_CLIENT_SECRET=你的Google客户端密钥
GOOGLE_CALLBACK_URL=https://你的zeabur域名/api/auth/google/callback

# LLM API Key（至少配置一个）
GEMINI_API_KEY=你的API密钥

# 可选
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
MINERU_API_TOKEN=
```

生成随机密钥：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Step 4: 配置域名**

1. 在 Zeabur 服务页面点击 **"Domains"**
2. 点击 **"Generate Domain"** 获取免费域名（如 `xxx.zeabur.app`）
3. 复制这个域名用于下一步

**Step 5: 更新 Google OAuth 设置**

1. 打开 [Google Cloud Console](https://console.cloud.google.com)
2. 进入 **APIs & Services** > **Credentials**
3. 编辑你的 OAuth 2.0 Client
4. 在 **Authorized redirect URIs** 添加：
   - `https://你的zeabur域名/api/auth/google/callback`
5. 保存

**Step 6: 触发部署**

- 推送代码到 GitHub 会自动触发部署
- 或在 Zeabur 控制台手动点击 **"Redeploy"**

#### 更新代码后重新部署

```bash
# 修改代码后
git add .
git commit -m "你的修改说明"
git push

# Zeabur 会自动检测并重新部署，无需其他操作
```

#### 添加持久化存储（推荐）

默认情况下，Zeabur 服务重启会丢失 SQLite 数据。添加持久化存储：

1. 在项目中点击 **"Add Service"**
2. 选择 **"Persistent Storage"**
3. 挂载路径设为 `/app/data`

#### 常见问题

**Q: 部署失败怎么办？**
- 查看 Zeabur 的 Logs 页面获取错误信息
- 确认所有必需的环境变量都已配置
- 确认 GitHub 仓库是最新的

**Q: Google 登录提示 redirect_uri_mismatch？**
- 确认 `GOOGLE_CALLBACK_URL` 环境变量与 Google Console 中配置的完全一致
- 注意 https vs http，域名大小写

**Q: 上传的 PDF 文件丢失？**
- 需要添加 Persistent Storage 服务
- 或考虑使用对象存储（如 S3）

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | Yes |
| `JWT_SECRET` | Secret for JWT tokens | Yes |
| `SESSION_SECRET` | Secret for sessions | Yes |
| `GEMINI_API_KEY` | Gemini API key | At least one LLM |
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `DEEPSEEK_API_KEY` | DeepSeek API key | Optional |
| `MINERU_API_TOKEN` | MinerU token for PDF parsing | Optional |

### LLM Providers

Edit `backend/config/llm-providers.json` to configure available LLM providers.

### Analysis Prompts

Edit `backend/config/prompts.json` to customize analysis prompts.

## Architecture

```
literature-assistant-standalone/
├── frontend/           # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/      # Main pages
│   │   ├── components/ # UI components
│   │   ├── stores/     # Zustand state
│   │   └── services/   # API client
│   └── ...
├── backend/            # Express + SQLite
│   ├── api/            # Route handlers
│   ├── lib/            # Database, utilities
│   ├── middleware/     # Auth middleware
│   └── config/         # LLM & prompt configs
├── data/               # Data directory
│   ├── database/       # SQLite DB
│   ├── uploads/        # PDF files
│   └── figures/        # Parsed images
└── docker/             # Docker configs
```

## Development

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Zustand, Tailwind CSS, shadcn/ui
- **Backend**: Express 5, SQLite3, Passport.js
- **Auth**: Google OAuth 2.0 + JWT
- **PDF**: pdf-parse (text), MinerU (images, optional)

### Adding a New LLM Provider

1. Add configuration to `backend/config/llm-providers.json`
2. Set the API key in `.env`
3. Restart the server

### Customizing Analysis Types

Edit `backend/config/prompts.json` to add or modify analysis types.

## License

MIT
