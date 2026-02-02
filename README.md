# Literature Assistant - Standalone

AI-powered scientific literature analysis assistant with comprehensive library management, community sharing, and multi-modal PDF parsing capabilities.

## Features

### Core Features
- **PDF Upload & Parsing** - Upload PDF papers with automatic text extraction
- **Multi-Model AI Analysis** - Support for 19+ LLM providers (Gemini, GPT, DeepSeek, Kimi, Claude, etc.)
- **Real-time Streaming** - Live streaming responses with heartbeat mechanism
- **Multiple Analysis Modes** - Deep dive, quick summary, multi-PDF comparison, image report, critique
- **Custom Prompts** - Create and manage your own analysis prompts

### Library Management
- **Folder System** - Organize papers into custom folders (Want to read, Reading, Completed, etc.)
- **File Preview** - Quick preview panel with expandable view
- **Grid/List View** - Toggle between different view modes
- **Search** - Search across your library
- **Batch Operations** - Manage multiple documents

### Community Sharing
- **Public Sessions** - Share your analysis with others
- **Discover** - Browse public literature analyses
- **Copy/Fork** - Copy public sessions to your library
- **View/Copy Counts** - Track engagement metrics

### Advanced Features
- **MinerU Integration** - High-quality PDF parsing with figure extraction (图文解析)
- **Figure-Aware Markdown** - Render figures inline with AI responses
- **URL Import** - Direct import from arXiv, OpenReview, Nature
- **Notes** - Add personal notes to sessions
- **Message Editing** - Edit and resend messages
- **Multi-format Download** - Download as Markdown, PDF, or MinerU format
- **Theme Toggle** - Light/Dark mode support
- **Drag & Drop** - Drag files to upload

### Authentication
- **Google OAuth 2.0** - Secure authentication
- **JWT Tokens** - Stateless API authentication

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Google Cloud project (for OAuth)

### Installation

```bash
cd literature-assistant-standalone
npm run setup    # Install dependencies for root, backend, and frontend
```

### Configuration

#### Step 1: Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# ==================== Authentication ====================
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

JWT_SECRET=your-random-jwt-secret-32-chars-minimum
SESSION_SECRET=your-random-session-secret-32-chars-minimum

FRONTEND_URL=http://localhost:5173

# ==================== LLM Providers ====================
# Option 1: JXTANG API Gateway (supports multiple models)
JXTANG_BASE_URL=https://your-api-gateway/v1/chat/completions
JXTANG_API_KEY=your-api-key

# Option 2: Direct Provider APIs
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key

# ==================== Optional Services ====================
# MinerU - PDF image extraction (图文解析)
MINERU_API_TOKEN=your-mineru-token

# DNS servers for MinerU CDN (optional)
DNS_SERVERS=8.8.8.8,1.1.1.1,114.114.114.114
```

#### Step 2: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **OAuth consent screen**
   - User Type: External
   - Fill required fields (App name, emails)
4. Navigate to **APIs & Services** → **Credentials**
   - Click **+ Create Credentials** → **OAuth client ID**
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`, `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
5. Copy Client ID and Client Secret to `.env`

#### Step 3: Configure LLM Providers

Edit `backend/config/llm-providers.json` to enable/disable providers:

```json
{
  "defaultProvider": "gemini-3-pro-preview",
  "providers": {
    "gemini-3-pro-preview": {
      "name": "JXTANG",
      "baseUrlEnv": "JXTANG_BASE_URL",
      "apiKeyEnv": "JXTANG_API_KEY",
      "model": "gemini-3-pro-preview",
      "maxTokens": 32000,
      "multimodal": true,
      "enabled": true
    }
  }
}
```

### Start Development Server

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Production Deployment

### Using Docker

```bash
docker-compose up -d
docker-compose logs -f
```

### Manual Deployment

```bash
npm run build
NODE_ENV=production npm start
```

### Deploy to Zeabur

1. Push code to GitHub
2. Create project on [Zeabur](https://zeabur.com)
3. Configure environment variables (change URLs to production domain)
4. Add production redirect URI to Google OAuth
5. Add Persistent Storage for `/app/data`

## Architecture

```
literature-assistant-standalone/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   └── LiteratureAssistant.tsx  # Main page (5600+ lines)
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── layout/          # Layout components
│   │   │   ├── literature-assistant/
│   │   │   │   └── FigureAwareMarkdown.tsx
│   │   │   └── MermaidChart.tsx
│   │   ├── stores/
│   │   │   └── literature-assistant-store.ts
│   │   ├── services/
│   │   │   ├── api.ts           # API client
│   │   │   └── auth.ts          # Auth service
│   │   └── hooks/
│   │       └── useTheme.ts      # Theme hook
│   └── ...
├── backend/                     # Express + SQLite
│   ├── api/
│   │   ├── auth-routes.js       # OAuth routes
│   │   ├── session-routes.js    # Session CRUD
│   │   ├── document-routes.js   # Document & figure routes
│   │   └── analysis-routes.js   # AI analysis, downloads, community
│   ├── lib/
│   │   ├── database.js          # SQLite wrapper
│   │   └── mineru-service.js    # MinerU integration
│   ├── middleware/
│   │   └── auth.js              # JWT middleware
│   └── config/
│       ├── llm-providers.json   # LLM configuration
│       └── prompts.json         # Analysis prompts
├── data/                        # Data directory
│   ├── database/                # SQLite database
│   ├── uploads/                 # PDF files
│   └── figures/                 # Extracted images
└── docker/                      # Docker configs
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Sessions
- `GET /api/sessions` - List sessions
- `GET /api/sessions/:id` - Get session with documents & messages
- `POST /api/sessions` - Create session
- `PATCH /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session
- `PATCH /api/sessions/:id/public` - Toggle public status

### Documents
- `POST /api/documents` - Upload document
- `GET /api/documents/:id` - Download document
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/parse-images` - Trigger MinerU parsing
- `GET /api/documents/:id/figures` - Get document figures
- `GET /api/documents/:id/figures/by-label/:label` - Get figure by label

### Analysis
- `POST /api/analyze` - Stream AI analysis
- `DELETE /api/messages/:id` - Delete message
- `POST /api/upload-from-url` - Import from URL (arXiv, OpenReview, Nature)

### Downloads
- `GET /api/download/availability/:sessionId` - Check download options
- `GET /api/download/ai-response/:messageId` - Download as Markdown
- `GET /api/download/original-pdf/:documentId` - Download original PDF
- `GET /api/download/mineru-markdown/:documentId` - Download MinerU Markdown
- `GET /api/download/mineru-folder/:documentId` - Download MinerU ZIP

### Community
- `GET /api/community/sessions` - List public sessions
- `POST /api/community/copy/:sessionId` - Copy public session
- `POST /api/community/view/:sessionId` - Record view
- `GET /api/community/settings` - Get share settings
- `POST /api/community/settings` - Update share settings

### Custom Prompts
- `GET /api/custom-prompts` - List custom prompts
- `POST /api/custom-prompts` - Create custom prompt
- `DELETE /api/custom-prompts/:id` - Delete custom prompt

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | Yes |
| `JWT_SECRET` | Secret for JWT tokens (32+ chars) | Yes |
| `SESSION_SECRET` | Secret for sessions (32+ chars) | Yes |
| `FRONTEND_URL` | Frontend URL for CORS | Yes |
| `JXTANG_BASE_URL` | API gateway base URL | At least one LLM |
| `JXTANG_API_KEY` | API gateway key | At least one LLM |
| `GEMINI_API_KEY` | Direct Gemini API key | Optional |
| `OPENAI_API_KEY` | Direct OpenAI API key | Optional |
| `DEEPSEEK_API_KEY` | Direct DeepSeek API key | Optional |
| `MINERU_API_TOKEN` | MinerU token for image parsing | Optional |
| `DNS_SERVERS` | DNS servers for MinerU CDN | Optional |

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Zustand (state management)
- Tailwind CSS + shadcn/ui
- Framer Motion (animations)
- React Markdown + KaTeX + Mermaid
- Recharts (analytics)

### Backend
- Express 5
- SQLite3
- Passport.js (Google OAuth)
- JWT authentication
- pdf-parse (text extraction)
- MinerU API (image extraction)
- Sharp (image processing)

## Troubleshooting

### `concurrently: not found`
```bash
npm install   # In root directory
```

### `Cannot find module 'xxx'`
```bash
npm run setup   # Reinstall all dependencies
```

### Google OAuth `redirect_uri_mismatch`
- Verify redirect URI in Google Console matches exactly
- Check http vs https, correct port (3000 not 5173)

### MinerU parsing fails
- Verify `MINERU_API_TOKEN` is set
- Check network connectivity to mineru.net
- Try configuring `DNS_SERVERS` if CDN is blocked

### PDF upload fails
- Check file size (max 150MB)
- Ensure `data/uploads` directory is writable

## License

MIT
