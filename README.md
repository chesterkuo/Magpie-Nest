# Magpie — Local AI Storage Agent

> Manage, search, and play all your digital files with natural language — 100% local, zero cloud.

[繁體中文](./README.zh-TW.md)

## What is Magpie?

Magpie is a self-hosted AI storage agent that runs entirely on your Mac Mini. Through a single web app, you can chat with an AI assistant that understands your files — documents, videos, music, photos — and helps you find, play, and organize them using plain language.

**No cloud. No subscriptions. Your data never leaves your device.**

## Features

- **Natural Language Search** — Ask "find the presentation I worked on last week" and get results via hybrid search (vector + keyword re-ranking)
- **Media Playback** — Built-in video streaming (HLS) with duration overlay, audio player with artist/album display, queue, shuffle, and loop
- **Document Preview** — View PDFs (with fullscreen mode), DOCX, XLSX, and PPTX directly in the browser
- **Smart Indexing** — Automatic file watching (30s debounce) with semantic vector search and date-prefixed chunks
- **File Organization** — AI-powered tools to organize files by type/date and batch rename with regex
- **Voice Interface** — Push-to-talk speech input (whisper.cpp) and text-to-speech responses (Kokoro)
- **Conversation History** — Multi-turn chat with persistent conversation history
- **Playlist Management** — Create and manage audio playlists via chat or UI
- **Rich Metadata** — Extracts duration, artist, album, dimensions from media files
- **PWA** — Install as a standalone app with offline support
- **Privacy First** — Everything runs locally on your hardware

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Server | [Hono](https://hono.dev) |
| Frontend | React 19 + Vite + TailwindCSS v4 |
| LLM | OpenAI-compatible API (default: Gemini) or [Ollama](https://ollama.com) |
| Vector DB | [LanceDB](https://lancedb.com) |
| Database | SQLite (bun:sqlite) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## Quick Start

### Prerequisites

- macOS with Apple Silicon (M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org) (for media streaming and thumbnails)
- An LLM API key (e.g. Google AI Studio for Gemini) **or** [Ollama](https://ollama.com) for fully local inference
- [Docker](https://docker.com) _(optional — only if you prefer to run Ollama in a container)_

### 1. Clone and install

```bash
git clone https://github.com/plusblocks/magpie.git
cd magpie
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set LLM_API_KEY and WATCH_DIRS
```

See [LLM Provider Configuration](#llm-provider-configuration) below for details on configuring your preferred LLM provider.

### 3. (Optional) Use Ollama for local inference

If you prefer fully local inference instead of an external API, install Ollama and pull models:

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

Then set `LLM_PROVIDER=ollama` and `EMBED_PROVIDER=ollama` in your `.env`.

> **Docker alternative:** If you prefer running Ollama in a container, use `docker compose -f docker/compose.yml up -d` and pull models with `docker exec magpie-ollama ollama pull <model>`.

### 4. (Optional) Set up voice

```bash
bash scripts/setup-models.sh
```

### 5. Run

```bash
# Development (hot reload)
bun run dev

# Or run server and client separately
bun run dev:server   # API on port 8000
bun run dev:client   # Vite dev server on port 5173
```

### 6. Build for production

```bash
bun run build        # Build client
bun run dev:server   # Serve everything on port 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## Project Structure

```
magpie/
├── packages/
│   ├── server/           # Bun + Hono API server
│   │   ├── agent/        # ReAct loop, tools, system prompt
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # DB, LanceDB, embeddings, indexer, search, HLS, STT, TTS
│   │   ├── middleware/   # Auth
│   │   └── workers/      # Background indexer worker
│   ├── client/           # React 19 PWA
│   │   ├── src/routes/   # Chat, ConversationList, Recent, Media, Settings
│   │   ├── src/hooks/    # useSSE, usePlayback, useOnlineStatus
│   │   └── src/components/ # UI components + renderers
│   └── shared/           # Shared TypeScript types
├── e2e/                  # Playwright end-to-end tests
├── docker/               # Docker Compose (Ollama)
├── scripts/              # Setup scripts (voice models, icon generation)
└── data/                 # Runtime data (SQLite, LanceDB, thumbs, HLS cache)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/chat` | Yes | Chat with AI agent (SSE stream) |
| GET | `/api/files` | Yes | List files with filtering and pagination |
| GET | `/api/file/:id` | Yes | Serve file (supports Range requests) |
| GET | `/api/file/:id/preview` | Yes | Document preview (DOCX/XLSX to HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | Yes | HLS video playlist |
| GET | `/api/thumb/:id` | Yes | File thumbnail (WebP) |
| GET/POST | `/api/playlists` | Yes | Playlist CRUD |
| GET/PUT | `/api/conversations/:id` | Yes | Conversation persistence |
| GET/PUT | `/api/settings` | Yes | Settings management |
| POST | `/api/stt` | Yes | Speech-to-text |
| POST | `/api/tts` | Yes | Text-to-speech |
| GET | `/api/health` | No | System health check |

## Agent Tools

The AI agent has access to these tools via function calling:

- `search_files` — Hybrid search (vector + keyword) across all indexed files with type/date filters
- `play_media` — Stream video or audio files
- `open_document` — Preview documents (PDF, DOCX, XLSX, PPTX)
- `list_recent` — Browse recently modified files
- `get_file_info` — Get file metadata and details
- `create_playlist` — Create playlists with optional auto-fill from search
- `list_directory` — Browse files in a specific folder
- `get_disk_status` — Check disk usage and file statistics
- `organize_files` — Organize files into subfolders by type or date
- `batch_rename` — Rename files matching a regex pattern (supports dry-run preview)

## Testing

```bash
# API & unit tests (165 tests)
cd packages/server
bun test
bun test --watch      # Watch mode

# E2E browser tests (38 tests, Playwright + Chromium)
bunx playwright test
```

> First-time setup: `bun add -d @playwright/test && bunx playwright install chromium && sudo bunx playwright install-deps chromium`

## LLM Provider Configuration

Magpie supports multiple LLM providers via an OpenAI-compatible API interface. The **default provider is Gemini** through Google's OpenAI-compatible endpoint. Ollama remains supported as a fully local option.

The chat model and embedding model can be configured independently — for example, you can use Gemini for chat and a local Ollama model for embeddings, or any other combination.

Configuration can be set via environment variables in `.env` **or** through the **Settings page** in the UI at runtime.

### Using Gemini (default)

Get a free API key from [Google AI Studio](https://aistudio.google.com), then set in `.env`:

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

Set `LLM_PROVIDER=openai-compatible` and point `LLM_BASE_URL` at any OpenAI-compatible endpoint (OpenAI, Groq, OpenRouter, etc.):

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

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
| `LLM_PROVIDER` | `openai-compatible` | Provider: `openai-compatible` or `ollama` |
| `LLM_API_KEY` | _(empty)_ | API key for the chat LLM provider |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | Base URL for OpenAI-compatible chat endpoint |
| `LLM_MODEL` | `gemini-2.5-flash` | Chat model name |

### Embedding model

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBED_PROVIDER` | `openai-compatible` | Provider: `openai-compatible` or `ollama` |
| `EMBED_API_KEY` | _(empty)_ | API key for the embedding provider |
| `EMBED_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | Base URL for OpenAI-compatible embedding endpoint |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | Embedding model name |

### Ollama (used when provider is `ollama`)

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
| `WATCH_DIRS` | _(empty)_ | Comma-separated paths to watch and index |

## License

Copyright 2026 Plusblocks Technology Ltd.
