# Magpie — AI-Native NAS & Storage Agent

> Your personal AI storage assistant — manage, search, play, and organize files with natural language. Runs 100% locally on your device.

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## What is Magpie?

Magpie is an **AI-native NAS/storage agent** that turns your Mac Mini (or any Mac) into a smart file server. Through a single web app accessible from any device — iPhone, iPad, PC — you can chat with an AI assistant that understands your files and helps you find, play, organize, and upload them using plain language.

Think of it as a self-hosted, AI-powered alternative to cloud storage — with the intelligence of a personal assistant.

**No cloud. No subscriptions. Your data never leaves your device.**

## Features

### AI Agent
- **Natural Language Search** — "Find the presentation I worked on last week" via hybrid search (vector + keyword re-ranking)
- **File Organization** — AI-powered tools to organize files by type/date and batch rename with regex
- **AirDrop Control** — Enable/disable AirDrop on your Mac via chat commands
- **Multi-turn Conversations** — Persistent chat history with date-grouped view and batch delete

### Media
- **Video Streaming** — Built-in HLS streaming with on-demand transcoding, thumbnail generation
- **Audio Player** — Artist/album display, queue, shuffle, repeat, volume control
- **Document Preview** — View PDFs (with fullscreen), DOCX, XLSX, PPTX directly in browser
- **Image Gallery** — Grid view with lightbox navigation

### Storage
- **File Upload** — Drag-and-drop upload from any device (iPhone, PC) over LAN with progress bars
- **Smart Indexing** — Automatic file watching with semantic vector search
- **Rich Metadata** — Extracts duration, artist, album, dimensions, page count from files

### Interface
- **macOS-Native Design** — Light theme with Apple system fonts, frosted glass sidebar, iOS-style navigation
- **Responsive** — Desktop sidebar + mobile bottom navigation, optimized for iPhone
- **10 Languages** — English, 繁體中文, 简体中文, Français, Español, 日本語, 한국어, ไทย, Nederlands, Bahasa Indonesia — auto-detected from browser/OS settings
- **Voice Interface** — Push-to-talk speech input (whisper.cpp) and text-to-speech (Kokoro)
- **PWA** — Install as a standalone app with offline support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Server | [Hono](https://hono.dev) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| LLM | OpenAI-compatible API (default: Gemini 2.5 Flash) or [Ollama](https://ollama.com) |
| Embeddings | Gemini Embedding or Ollama (nomic-embed-text) |
| Vector DB | [LanceDB](https://lancedb.com) |
| Database | SQLite (bun:sqlite) |
| i18n | react-i18next (10 languages) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## Quick Start

### Prerequisites

- macOS with Apple Silicon (M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org) (for video streaming and thumbnails)
- An LLM API key (e.g. [Google AI Studio](https://aistudio.google.com) for Gemini — free) **or** [Ollama](https://ollama.com) for fully local inference

### 1. Clone and install

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set LLM_API_KEY and WATCH_DIRS at minimum
```

See [LLM Provider Configuration](#llm-provider-configuration) below for details.

### 3. (Optional) Use Ollama for local inference

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

Then set `LLM_PROVIDER=ollama` and `EMBED_PROVIDER=ollama` in `.env`.

### 4. (Optional) Set up voice

```bash
bash scripts/setup-models.sh
```

### 5. Run

```bash
# Start server + client (hot reload)
bun run dev

# Start the indexer worker (in a separate terminal)
bun run dev:indexer

# Or run components separately
bun run dev:server   # API on port 8000
bun run dev:client   # Vite dev server on port 5173
```

> **Important:** The indexer worker must be running for uploaded/watched files to be indexed and searchable.

### 6. Access

- **Desktop:** Open [http://localhost:5173](http://localhost:5173)
- **iPhone/Mobile:** Open `http://<your-mac-ip>:5173` (e.g. `http://192.168.1.108:5173`)
- **Upload files:** Use the Upload page or AirDrop to your Mac

### 7. Build for production

```bash
bun run build        # Build client
bun run dev:server   # Serve everything on port 8000
```

## Project Structure

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono API server
│   │   ├── agent/            # ReAct loop, tools, system prompt
│   │   ├── routes/           # REST API endpoints
│   │   ├── services/         # DB, LanceDB, indexer, search, HLS, providers
│   │   │   └── providers/    # LLM/embedding provider abstraction
│   │   ├── middleware/       # Auth
│   │   └── workers/          # Background indexer worker
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # Chat, Conversations, Recent, Media, Upload, Settings
│   │   ├── src/hooks/        # useSSE, usePlayback, useOnlineStatus
│   │   ├── src/components/   # UI components + renderers
│   │   └── src/locales/      # i18n translation files (10 languages)
│   └── shared/               # Shared TypeScript types
├── e2e/                      # Playwright end-to-end tests
├── docs/                     # Specs and implementation plans
├── docker/                   # Docker Compose (Ollama)
├── scripts/                  # Setup scripts (voice models, icon generation)
└── data/                     # Runtime data (SQLite, LanceDB, thumbs, HLS cache)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/chat` | Yes | Chat with AI agent (SSE stream) |
| POST | `/api/upload` | Yes | Upload files (multipart/form-data) |
| GET | `/api/files` | Yes | List files with filtering and pagination |
| GET | `/api/file/:id` | Yes | Serve file (supports Range requests) |
| GET | `/api/file/:id/preview` | Yes | Document preview (DOCX/XLSX → HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | No | HLS video playlist |
| GET | `/api/stream/:id/:segment` | No | HLS video segment |
| GET | `/api/thumb/:id` | No | File thumbnail (WebP) |
| GET/POST | `/api/playlists` | Yes | Playlist CRUD |
| GET/PUT/DELETE | `/api/conversations` | Yes | Conversation CRUD (single + batch delete) |
| GET/PUT | `/api/settings` | Yes | Settings management |
| POST | `/api/settings/test-connection` | Yes | Test LLM/embedding provider connection |
| POST | `/api/stt` | Yes | Speech-to-text |
| POST | `/api/tts` | Yes | Text-to-speech |
| GET | `/api/health` | No | System health check |

## Agent Tools

The AI agent has access to these tools via function calling:

| Tool | Description |
|------|-------------|
| `search_files` | Hybrid search (vector + keyword) with type/date filters |
| `play_media` | Stream video or audio files |
| `open_document` | Preview documents (PDF, DOCX, XLSX, PPTX) |
| `list_recent` | Browse recently modified files |
| `get_file_info` | Get file metadata and details |
| `create_playlist` | Create playlists with optional auto-fill from search |
| `list_directory` | Browse files in a specific folder |
| `get_disk_status` | Check disk usage and file statistics |
| `organize_files` | Organize files into subfolders by type or date |
| `batch_rename` | Rename files matching a regex pattern (dry-run preview) |
| `airdrop_control` | Enable/disable AirDrop, check status |

## Testing

```bash
# API & unit tests (192 tests)
cd packages/server
bun test
bun test --watch

# E2E browser tests (38 tests, Playwright + Chromium)
bunx playwright test
```

> First-time setup: `bun add -d @playwright/test && bunx playwright install chromium`

## LLM Provider Configuration

Magpie supports multiple LLM providers via an OpenAI-compatible API interface. The **default provider is Gemini 2.5 Flash** through Google's OpenAI-compatible endpoint. Ollama is supported as a fully local option.

Chat and embedding models can be configured **independently**. Configuration via `.env` or the **Settings page** in the UI.

### Using Gemini (default)

Get a free API key from [Google AI Studio](https://aistudio.google.com):

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-google-api-key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.5-flash

EMBED_PROVIDER=openai-compatible
EMBED_API_KEY=your-google-api-key
EMBED_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
EMBED_MODEL=gemini-embedding-2-preview
```

### Using any OpenAI-compatible provider

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Works with OpenAI, Groq, OpenRouter, Together, and any OpenAI-compatible endpoint.

### Using Ollama (fully local)

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## Environment Variables

### LLM (chat model)

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` or `ollama` |
| `LLM_API_KEY` | — | API key for chat provider |
| `LLM_BASE_URL` | Gemini endpoint | OpenAI-compatible base URL |
| `LLM_MODEL` | `gemini-2.5-flash` | Chat model name |

### Embedding model

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` or `ollama` |
| `EMBED_API_KEY` | — | API key for embedding provider |
| `EMBED_BASE_URL` | Gemini endpoint | OpenAI-compatible base URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | Embedding model name |

### Ollama

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama chat model |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |

### General

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | Data storage directory |
| `API_SECRET` | `magpie-dev` | API authentication token |
| `PORT` | `8000` | Server port |
| `WATCH_DIRS` | — | Comma-separated paths to watch and index |

## License

Copyright 2026 Plusblocks Technology Ltd.
