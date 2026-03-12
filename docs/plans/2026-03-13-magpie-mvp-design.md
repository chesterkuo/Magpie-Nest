# Magpie MVP Design Document

> AI Storage Agent for Your Digital Life
> Approved: March 2026

---

## 1. PRD Refinements

| Decision | Original PRD | Refined |
|----------|-------------|---------|
| Product name | Mixed Magpie/Friday | **Magpie** everywhere |
| Runtime model | All Docker | **Native core + Docker for Ollama only** |
| File watcher | Python watchdog | **TS-native (chokidar in Bun)** |
| Voice (MVP) | Full STT + TTS + wake word | **Text chat only, voice in Phase 2** |
| LLM engine | Ollama | **Ollama for MVP, evaluate MLX in Phase 2** |
| Data stores | LanceDB + SQLite | **Keep both (confirmed)** |
| Video streaming | HLS | **HLS (confirmed)** |
| Document extraction | Apache Tika (Docker) | **JS libs (pdf-parse, mammoth, xlsx)** |
| Static serving | Nginx Docker | **Bun + Hono serves React build** |
| Auth | Unspecified | **Simple token auth on LAN** |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React PWA)                                      │
│  Chat UI + Media Players + File Browsers                  │
│  Served as static files by Bun                            │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP / SSE / HLS
┌────────────────────▼─────────────────────────────────────┐
│  Bun + Hono (Single Native Process)                       │
│                                                           │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐ │
│  │ Chat API │ │ Agent    │ │ File API  │ │ HLS Stream  │ │
│  │ (SSE)   │ │ ReAct    │ │ /thumb    │ │ (FFmpeg)    │ │
│  │         │ │ Loop     │ │ /file     │ │             │ │
│  └────┬────┘ └────┬─────┘ └─────┬─────┘ └──────┬──────┘ │
│       │           │             │               │         │
│  ┌────▼───────────▼─────────────▼───────────────▼──────┐ │
│  │              Service Layer                           │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐            │ │
│  │  │ Indexer  │ │ Search   │ │ Thumbnail │            │ │
│  │  │ (worker) │ │ (Lance)  │ │ (FFmpeg)  │            │ │
│  │  └──────────┘ └──────────┘ └───────────┘            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐        │
│  │ SQLite   │  │ LanceDB  │  │ File System      │        │
│  │ (tracks) │  │ (vectors)│  │ (media/docs)     │        │
│  └──────────┘  └──────────┘  └──────────────────┘        │
└──────────────────────────────────────────────────────────┘
                     │
                     │ HTTP (localhost:11434)
              ┌──────▼──────┐
              │   Docker    │
              │   Ollama    │
              │   Qwen3 8B  │
              └─────────────┘
```

**Key points:**
- Single Bun process, native on macOS
- Indexer runs as a Bun worker thread to avoid blocking the API
- FFmpeg called as a child process for HLS segmenting and thumbnail generation
- Ollama is the only Docker container
- File watcher (chokidar) runs in the main process, dispatches to indexer worker
- Simple token auth middleware on all API routes

---

## 3. Data Model & Storage

### SQLite Schema

```sql
-- Core file registry
files
  id          TEXT PRIMARY KEY  -- nanoid
  path        TEXT UNIQUE       -- absolute path on disk
  name        TEXT              -- filename
  mime_type   TEXT              -- detected MIME type
  size        INTEGER           -- bytes
  modified_at TEXT              -- file mtime (ISO 8601)
  indexed_at  TEXT              -- when we last indexed
  file_type   TEXT              -- 'video' | 'audio' | 'pdf' | 'image' | 'doc'
  meta        TEXT              -- JSON blob (exif, id3, duration, dimensions, etc.)
  hash        TEXT              -- content hash for dedup/change detection

-- Index queue for the worker
index_queue
  id          INTEGER PRIMARY KEY AUTOINCREMENT
  file_path   TEXT
  event_type  TEXT              -- 'created' | 'modified' | 'deleted'
  queued_at   TEXT
  status      TEXT              -- 'pending' | 'processing' | 'done' | 'error'
```

### LanceDB Schema

```
table: file_chunks
  id          STRING            -- chunk id (file_id + chunk_index)
  file_id     STRING            -- FK to SQLite files.id
  text        STRING            -- chunk text content
  vector      VECTOR(768)       -- nomic-embed-text embedding
  file_name   STRING            -- denormalized for search results
  file_type   STRING            -- denormalized
  file_path   STRING            -- denormalized
```

### Indexing Data Flow

```
File system event (chokidar)
  → debounce 30s
  → insert into index_queue (SQLite)
  → worker picks up pending items
  → extract text (pdf-parse / mammoth / xlsx / music-metadata for media)
  → chunk text (512-1024 chars, prepend metadata)
  → embed via Ollama nomic-embed-text
  → write chunks to LanceDB
  → update files table with metadata
  → mark queue item done
```

- SQLite is the source of truth for file existence and metadata
- LanceDB stores text chunks + vectors for semantic search
- Index queue decouples file detection from processing (resilient to crashes)
- Content hash prevents re-indexing unchanged files
- Media files get metadata indexed but no text chunks — searchable by filename, tags, EXIF

---

## 4. Agent & Tool System

### ReAct Loop

```
User message
  → Hono POST /api/chat (SSE response)
  → Build messages array with system prompt + tool definitions
  → Loop (max 5 iterations):
      → Send to Ollama (qwen3:8b, tools enabled)
      → If tool_calls → execute tools, push results, continue loop
      → If text response → stream to client via SSE, break
```

### System Prompt

```
You are Magpie, a local AI storage assistant. You help users find,
play, and manage their files. Use the provided tools to fulfill
requests. Always use tools rather than guessing file locations.
Respond concisely. Default language: match the user's language.
```

### MVP Tools (P0)

| Tool | Input | Output |
|------|-------|--------|
| `search_files` | `{ query, file_type?, days_ago?, limit? }` | `FileItem[]` |
| `play_media` | `{ file_id }` | `{ streamUrl, thumbUrl, renderType }` |
| `open_document` | `{ file_id }` | `{ fileUrl, thumbUrl, renderType }` |
| `list_recent` | `{ days?, file_type?, limit? }` | `FileItem[]` |
| `get_file_info` | `{ file_id }` | `FileItem + full metadata` |

### SSE Chunk Protocol

```typescript
{ type: 'thinking', tool: 'search_files' }   // tool being called
{ type: 'render',   items: FileItem[] }        // UI components to render
{ type: 'text',     content: '...' }           // streamed text tokens
{ type: 'error',    message: '...' }           // error
```

- Tools return structured data mapping to frontend render components
- `search_files` combines vector similarity (LanceDB) with metadata filters (SQLite)
- `play_media` triggers HLS playlist generation on-demand (FFmpeg, segments cached)
- `render` chunks sent immediately so UI shows results before LLM finishes text

---

## 5. Frontend & PWA

### Routes

```
/          → Chat interface (default home)
/recent    → Recently added/accessed files
/media     → Media library browser
/settings  → Configuration, indexing status
```

### Component Tree

```
App
├── Layout (bottom tab nav)
├── ChatView
│   ├── MessageList
│   │   ├── UserMessage
│   │   └── AssistantMessage
│   │       ├── ThinkingIndicator
│   │       ├── TextContent (streamed markdown)
│   │       └── RenderBlock (dynamic by renderType)
│   │           ├── VideoCard → click opens HLS player
│   │           ├── AudioPlayer → inline playback
│   │           ├── PDFViewer → PDF.js embedded
│   │           ├── ImageGrid → thumbnails, click fullscreen
│   │           └── FileList → icon + name + size + date
│   └── ChatInput (text field + send button)
├── RecentView
├── MediaView
└── SettingsView
```

### Tech

- React 19 + Vite, TailwindCSS v4, React Router
- Custom `useSSE` hook for `/api/chat` streaming
- HLS.js for video playback, PDF.js for document viewing
- PWA: standalone mode, service worker for static caching, dark mode
- Mobile-first responsive, no state management library needed

---

## 6. HLS Streaming & Thumbnails

### HLS Pipeline

```
play_media(file_id)
  → Look up file path in SQLite
  → Check HLS cache → hit: return playlist URL
  → Miss: spawn FFmpeg
      → MP4/MKV (compatible codecs): transmux (copy, near-instant)
      → AVI/other: transcode (libx264 ultrafast + aac)
  → Return /api/stream/:id/playlist.m3u8
```

- Segments: 10s each, cached at `~/magpie/data/hls-cache/<file_id>/`
- LRU eviction when cache exceeds 10GB (configurable)

### Thumbnails

| Type | Method | Output |
|------|--------|--------|
| Video | FFmpeg, frame at 10s, scale 320px | WebP |
| Image | sharp, resize 320px | WebP |
| PDF | pdf-parse first page render | WebP |
| Audio | Extract embedded album art (music-metadata) | WebP |

- Cached at `~/magpie/data/thumbs/<file_id>.webp`
- Generated on-demand at first request

---

## 7. Project Structure

```
magpie/
├── package.json              # Workspace root
├── tsconfig.base.json
├── docker/
│   └── compose.yml           # Ollama only
├── packages/
│   ├── server/
│   │   ├── index.ts
│   │   ├── middleware/auth.ts
│   │   ├── routes/           # chat, stream, thumb, file, health
│   │   ├── agent/
│   │   │   ├── loop.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools/        # searchFiles, playMedia, etc.
│   │   ├── services/         # db, lancedb, embeddings, indexer, watcher, hls, thumbnail
│   │   └── workers/
│   │       └── indexer.worker.ts
│   ├── client/
│   │   ├── vite.config.ts
│   │   ├── public/           # manifest.json, sw.js
│   │   └── src/
│   │       ├── routes/       # Chat, Recent, Media, Settings
│   │       ├── components/   # ChatInput, MessageList, renderers/
│   │       └── hooks/useSSE.ts
│   └── shared/
│       └── types.ts          # FileItem, AgentChunk, RenderType
├── data/                     # Runtime (gitignored)
│   ├── lancedb/
│   ├── sqlite/
│   ├── thumbs/
│   └── hls-cache/
└── docs/plans/
```

### Key Dependencies

**Server:** hono, better-sqlite3, @lancedb/lancedb, chokidar, ollama, pdf-parse, mammoth, xlsx, sharp, music-metadata, nanoid

**Client:** react, react-dom, react-router, tailwindcss, hls.js, pdfjs-dist

---

## 8. MVP Scope Summary

**In scope:**
- Text-based AI chat with tool calling (Ollama + Qwen3 8B)
- Semantic file search (LanceDB + nomic-embed-text)
- HLS video streaming with on-demand segmenting
- Audio playback with metadata display
- PDF viewing (PDF.js)
- Image browsing with thumbnails
- File watcher + indexing pipeline (Bun worker thread)
- React PWA with chat-first UI
- Simple token auth
- Docker only for Ollama

**Deferred to Phase 2:**
- Voice input/output (STT/TTS)
- Wake word detection
- Tailscale external access
- Media auto-classification
- Borgmatic backup
- Syncthing sync

**Deferred to Phase 3:**
- AI-driven folder organization
- Batch rename
- Playlist generation
- Disk analytics
