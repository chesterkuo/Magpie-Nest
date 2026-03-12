# Magpie MVP Gap Fill — Design Spec

> Addresses all missing P0 MVP features identified by comparing the PRD against current implementation.
> Date: 2026-03-13

## Context

The Magpie MVP is ~60-65% complete. Core file indexing, vector search, HLS streaming, and the agent loop are solid. This spec covers the remaining gaps required to match the PRD's MVP definition.

### Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Voice (F1) | P0 MVP, included | PRD requirement |
| STT/TTS hosting | Native macOS processes (whisper.cpp binary + Kokoro Python venv) | Consistent with minimal-Docker architecture; lower RAM than containers |
| Doc preview | mammoth.js (DOCX→HTML) + PDF.js (PDF), XLSX→HTML, others download | Leverages existing deps, avoids heavy LibreOffice install |
| Stub pages | Full interactive (search, sort, filter, editable settings) | Complete app feel |
| Playlists | Persistent in SQLite + `create_playlist` agent tool | PRD F3 requirement |
| PWA | App shell + cached conversations in IndexedDB | Installable PWA with offline review of past chats |
| Wake word | Deferred to Phase 2; push-to-talk for MVP | Browser wake word is unreliable and battery-heavy |
| Implementation approach | Parallel tracks (backend + frontend) | Fastest to completion; converge at voice integration |

---

## 1. Database Schema Extensions

Three new tables in `packages/server/services/db.ts`:

### `playlists`

```sql
CREATE TABLE playlists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

### `playlist_items`

```sql
CREATE TABLE playlist_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  file_id     TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  added_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_playlist_items_playlist ON playlist_items(playlist_id, position);
```

### `conversations`

```sql
CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,
  messages    TEXT NOT NULL,  -- JSON array of Message[]
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
```

### New MagpieDb Methods

- `createPlaylist(id, name)` / `deletePlaylist(id)` / `listPlaylists()`
- `addToPlaylist(playlistId, fileId, position)` / `removeFromPlaylist(playlistId, fileId)`
- `getPlaylistItems(playlistId): FileRecord[]`
- `saveConversation(id, messages)` / `getConversation(id)` / `listConversations(limit)`

---

## 2. API Endpoints

### New Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `POST` | `/api/stt` | Accept audio blob, return transcribed text | Yes |
| `POST` | `/api/tts` | Accept text, return audio/mpeg stream | Yes |
| `GET` | `/api/file/:id` | Serve original file with correct MIME (replace 501 stub) | Yes |
| `GET` | `/api/file/:id/preview` | DOCX→HTML / XLSX→HTML preview | Yes |
| `GET` | `/api/files` | Paginated file listing with sort/filter | Yes |
| `GET` | `/api/playlists` | List all playlists | Yes |
| `POST` | `/api/playlists` | Create playlist | Yes |
| `GET` | `/api/playlists/:id` | Get playlist with items | Yes |
| `PUT` | `/api/playlists/:id` | Update playlist (reorder, rename) | Yes |
| `DELETE` | `/api/playlists/:id` | Delete playlist | Yes |
| `POST` | `/api/playlists/:id/items` | Add file to playlist | Yes |
| `DELETE` | `/api/playlists/:id/items/:fileId` | Remove file from playlist | Yes |
| `GET` | `/api/conversations` | List recent conversations | Yes |
| `GET` | `/api/conversations/:id` | Get full conversation | Yes |
| `GET` | `/api/settings` | Read system status + config | Yes |
| `PUT` | `/api/settings` | Update mutable settings (watch dirs) | Yes |
| `POST` | `/api/index/trigger` | Trigger manual re-index of a path | Yes |

### STT Contract

```typescript
// Request: multipart/form-data with "audio" field (webm/wav blob)
// Response:
{ text: string; language: string; duration: number }
```

### TTS Contract

```typescript
// Request:
{ text: string; language?: 'en' | 'zh' }
// Response: audio/mpeg stream (chunked transfer)
```

### File Serving (`/api/file/:id`)

- Look up `FileRecord` by id, stream file from `record.path`
- Set `Content-Type` from `record.mime_type`
- Set `Content-Disposition: inline; filename="${record.name}"`
- Support `Range` header for partial content (206 responses)

### File Preview (`/api/file/:id/preview`)

- DOCX: `mammoth.convertToHtml()` → return `text/html`
- XLSX: `xlsx` library → convert sheets to HTML table
- PDF: redirect to `/api/file/:id` (PDF.js handles client-side)
- Others: 404

### Files Listing (`/api/files`)

Query params: `?sort=modified_at|name|size`, `?order=asc|desc`, `?type=video|audio|pdf|image|doc`, `?days=7|30|90`, `?limit=50&offset=0`

### New Shared Types

```typescript
export interface Playlist {
  id: string
  name: string
  items: FileItem[]
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// Extend AgentChunk
export interface AgentChunk {
  type: 'thinking' | 'text' | 'render' | 'error' | 'audio'
  content?: string
  tool?: string
  items?: FileItem[]
  message?: string
  audioUrl?: string  // For TTS playback URL
}
```

---

## 3. Voice Pipeline (STT + TTS)

### STT Service (`packages/server/services/stt.ts`)

- **Mode**: CLI per-request — each request writes audio to temp file, spawns whisper.cpp, parses JSON output
- **Pipeline**: audio blob → temp file → FFmpeg resample to 16kHz mono WAV → `whisper.cpp --model base.en --output-json` → parse → return text
- **Model path**: `${DATA_DIR}/models/ggml-base.en.bin`
- **Timeout**: 10 seconds per request
- **Cleanup**: temp files deleted after processing

### TTS Service (`packages/server/services/tts.ts`)

- **Mode**: Kokoro runs as a Python FastAPI process, lazy-started on first TTS request
- **Management**: `Bun.spawn()`, health-checked before use, stays alive between requests, killed on server shutdown
- **Venv**: `${DATA_DIR}/kokoro-venv/`
- **Internal API**: `POST http://localhost:8880/tts` with `{ text, language }` → audio/mpeg
- **Bun proxies** the response stream back to the client

### Bootstrap

- Add `setup-models` script: downloads whisper.cpp binary + base.en model, creates Kokoro venv + installs deps
- Lazy initialization — processes start on first voice request, not at server boot

### Client: VoiceInput Component

`packages/client/src/components/VoiceInput.tsx`:

- Push-to-talk button (mic icon) placed alongside ChatInput
- Uses `MediaRecorder` API to capture audio as WebM
- On release or 2-second silence detection: POST blob to `/api/stt`, get text back, feed into `sendMessage()`
- Visual states: idle → recording (pulsing red) → processing (spinner)

### Client: TTS Playback

- Client-side triggering: after assistant message completes, if "Read aloud" is enabled in Settings, POST response text to `/api/tts` and play returned audio
- Toggle stored in `localStorage`
- Keeps agent loop clean — TTS is purely a presentation concern

---

## 4. Document Preview & File Serving

### Server: `/api/file/:id` (replace 501 stub)

`packages/server/routes/file.ts`:

- Look up `FileRecord` by id from SQLite
- Verify file exists on disk
- Stream file with correct MIME type and `Content-Disposition: inline`
- Support `Range` header via Bun's native file APIs for seek/partial content

### Server: `/api/file/:id/preview`

- DOCX: `mammoth.convertToHtml()` → return HTML with basic styling wrapper
- XLSX: `xlsx` → convert all sheets to HTML tables
- PDF: redirect to `/api/file/:id`
- Others: 404

### Client: PDF.js Viewer

Replace current `PDFViewer.tsx` with embedded viewer:

- Add `pdfjs-dist` to client dependencies
- Fetch PDF via `/api/file/:id`
- Render pages in scrollable canvas container
- Controls: page navigation, zoom in/out, fullscreen
- Lazy-load pages (render visible + 1 ahead)

### Client: DocViewer

New `packages/client/src/components/renderers/DocViewer.tsx`:

- Fetch HTML from `/api/file/:id/preview`
- Render in sandboxed `<iframe srcDoc={html}>` with scoped styles
- Fallback download link if preview fails

### RenderBlock Changes

- `pdf_preview` → routes to updated `PDFViewer` (embedded PDF.js)
- `file_list` items with DOCX/XLSX type → show "Preview" button opening `DocViewer` in modal

---

## 5. Audio Player & Persistent Playlists

### Enhanced AudioPlayer

Replace native `<audio controls>` with custom UI:

- Progress bar (seekable)
- Play/pause, prev/next track buttons
- Shuffle toggle, loop mode toggle (off → loop-all → loop-one)
- Volume slider
- Current track info (album art, title, artist)
- Track list drawer showing current queue

### `usePlayback` Hook

`packages/client/src/hooks/usePlayback.ts`:

- Singleton audio context — one `<audio>` element at App level, not per AudioPlayer card
- State: `currentTrack`, `queue: FileItem[]`, `shuffled`, `loopMode`, `isPlaying`, `progress`
- Actions: `play(item)`, `playAll(items)`, `addToQueue(item)`, `next()`, `prev()`, `toggleShuffle()`, `cycleLoop()`
- Shuffle: Fisher-Yates pre-shuffled index array so prev/next work correctly
- On track end: auto-advance based on loop mode

### Persistent Playback Bar

- Fixed bar above bottom nav (Spotify mini-player pattern)
- Shows current track info + play/pause + progress
- Tap to expand full AudioPlayer view
- Visible across all pages

### Playlist UI (Media Page)

- "New Playlist" button → name input → `POST /api/playlists`
- Playlist cards: name, track count, total duration
- Tap playlist → track list with drag-to-reorder
- Swipe-to-delete tracks, long-press to add to queue
- "Play All" / "Shuffle Play" buttons per playlist

### `create_playlist` Agent Tool

- Args: `{ name: string; query?: string; file_type?: 'audio'; limit?: number }`
- Runs `search_files` internally for audio matches
- Creates playlist in SQLite, adds matched files
- Returns: `{ playlist: Playlist; files: FileItem[] }`

---

## 6. Interactive Pages

### Recent Page (`packages/client/src/routes/Recent.tsx`)

- Uses `GET /api/files?sort=modified_at&order=desc&days=30`
- Groups files by date: Today, Yesterday, This Week, Earlier
- Each row: thumbnail, name, type icon, size, relative date
- Tap → relevant action (play media, preview doc, view image)
- Pull-to-refresh, infinite scroll pagination

### Media Page (`packages/client/src/routes/Media.tsx`)

Tab sub-navigation: **Videos | Music | Photos**

- **Videos**: grid of VideoCards, sorted by date, uses `GET /api/files?type=video`
- **Music**: toggleable views — "All Tracks" list (sortable by name/artist/date) and "Playlists" (playlist cards with play/shuffle, "New Playlist" CTA)
- **Photos**: date-grouped ImageGrid, tap for fullscreen, uses `GET /api/files?type=image`
- Search bar at top — client-side filtering within current tab

### Settings Page (`packages/client/src/routes/Settings.tsx`)

Uses `GET /api/settings` and `PUT /api/settings`.

Sections:
- **Status**: Ollama (model, RAM), LanceDB (vector count), SQLite (file counts by type), disk usage
- **Watch Directories**: list, add, remove directories; trigger manual re-index
- **Indexing**: queue length, last indexed time, "Re-index All" button
- **Voice**: "Read responses aloud" toggle (persisted in localStorage)
- **Auth**: show/regenerate API token
- **About**: version, project link

---

## 7. PWA & Offline Caching

### Service Worker (`packages/client/public/sw.js`)

- **Precache**: app shell (HTML, JS, CSS bundles, manifest, icons) on install
- **Runtime strategies**:
  - Static assets (`/assets/*`): Cache-first
  - API data (`/api/files`, `/api/playlists`): Network-first, cached fallback
  - Thumbnails (`/api/thumb/*`): Cache-first
  - Streaming/file endpoints: Network-only
- **Versioned caches**: old caches cleaned on activate
- **Update UX**: "Update available" banner, `skipWaiting()` on confirm

### Conversation Cache (IndexedDB)

`packages/client/src/lib/conversationStore.ts`:

- IndexedDB store `magpie-conversations`
- On message completion: save to IndexedDB + `POST /api/conversations/:id`
- On first load: `GET /api/conversations` populates IndexedDB
- Offline: load from IndexedDB, read-only (chat input disabled)
- Cap: 50 conversations, evict oldest

### Manifest Improvements

```json
{
  "name": "Magpie",
  "short_name": "Magpie",
  "description": "Local AI Storage Agent",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Icon generation build script using sharp from source SVG/PNG.

### Offline Indicator

- `useOnlineStatus()` hook — `navigator.onLine` + periodic `/api/health` ping
- When offline: banner "You're offline — viewing cached data", chat disabled, media disabled

---

## 8. Health Endpoint Enhancement

Replace minimal `{ status: 'ok' }` in `packages/server/routes/health.ts`:

```typescript
{
  status: 'ok' | 'degraded' | 'error',
  services: {
    ollama: { status: 'ok' | 'error', model: string, loaded: boolean },
    lancedb: { status: 'ok' | 'error', totalChunks: number },
    sqlite: { status: 'ok' | 'error', totalFiles: number },
    whisper: { status: 'ok' | 'unavailable', modelPath: string },
    kokoro: { status: 'ok' | 'unavailable', processRunning: boolean }
  },
  disk: {
    dataDir: { path: string, freeBytes: number, totalBytes: number },
    watchDirs: Array<{ path: string, freeBytes: number, totalBytes: number }>
  },
  uptime: number,
  version: string
}
```

- `ok`: all critical services (ollama, lancedb, sqlite) healthy
- `degraded`: voice services unavailable but core works
- `error`: any critical service down
- Ollama check: `GET http://ollama:11434/api/tags`
- LanceDB: count query on `file_chunks`
- SQLite: `SELECT count(*) FROM files`
- Disk: `Bun.spawn(['df', '-B1', path])`

---

## 9. Agent Tools & System Prompt

### New Tools (5 → 8)

**6. `create_playlist`**
- Args: `{ name: string; query?: string; file_type?: 'audio'; limit?: number }`
- Search audio files, create playlist in SQLite, add matched files
- Returns: `{ playlist: Playlist; files: FileItem[] }`

**7. `list_directory`**
- Args: `{ path: string; sort_by?: 'name' | 'modified' | 'size'; file_type?: FileType }`
- List indexed files under a directory path from SQLite
- Returns: `{ files: FileItem[] }`

**8. `get_disk_status`**
- Args: `{ path?: string }`
- Run `df` for disk usage, query SQLite for file counts/sizes by type
- Returns: `{ disk: { free, total, used }, fileStats: Record<FileType, { count, totalSize }> }`

### System Prompt Additions

```
- When the user asks to play multiple songs or a collection, return all matching files so they queue automatically.
- When the user asks to create or save a playlist, use the create_playlist tool.
- When the user asks about disk space or storage stats, use the get_disk_status tool.
- When the user asks to browse a folder, use the list_directory tool.
```

No changes needed to `ToolContext` interface — all new tools use existing `db`, `vectorDb`, `embedQuery`, `dataDir`.

---

## File Impact Summary

### New Files (~25)

**Server:**
- `packages/server/services/stt.ts`
- `packages/server/services/tts.ts`
- `packages/server/routes/stt.ts`
- `packages/server/routes/tts.ts`
- `packages/server/routes/playlists.ts`
- `packages/server/routes/conversations.ts`
- `packages/server/routes/files.ts`
- `packages/server/routes/settings.ts`
- `packages/server/agent/tools/createPlaylist.ts`
- `packages/server/agent/tools/listDirectory.ts`
- `packages/server/agent/tools/getDiskStatus.ts`
- `scripts/setup-models.sh`

**Client:**
- `packages/client/src/components/VoiceInput.tsx`
- `packages/client/src/components/renderers/DocViewer.tsx`
- `packages/client/src/components/PlaybackBar.tsx`
- `packages/client/src/hooks/usePlayback.ts`
- `packages/client/src/hooks/useOnlineStatus.ts`
- `packages/client/src/lib/conversationStore.ts`
- `packages/client/src/routes/Recent.tsx`
- `packages/client/src/routes/Media.tsx`
- `packages/client/src/routes/Settings.tsx`
- `packages/client/public/sw.js`
- `packages/client/public/icons/` (generated)

### Modified Files (~15)

- `packages/server/services/db.ts` — new tables + methods
- `packages/server/routes/file.ts` — replace 501 stub
- `packages/server/routes/health.ts` — enhanced checks
- `packages/server/agent/tools/registry.ts` — 3 new tools
- `packages/server/agent/prompt.ts` — new tool instructions
- `packages/server/bootstrap.ts` — voice service init
- `packages/server/index.ts` — mount new routes
- `packages/shared/types.ts` — Playlist, Conversation, AgentChunk extensions
- `packages/client/src/App.tsx` — PlaybackBar, route implementations
- `packages/client/src/components/ChatInput.tsx` — VoiceInput integration
- `packages/client/src/components/renderers/PDFViewer.tsx` — PDF.js rewrite
- `packages/client/src/components/renderers/AudioPlayer.tsx` — custom UI rewrite
- `packages/client/src/components/renderers/RenderBlock.tsx` — DocViewer routing
- `packages/client/src/hooks/useSSE.ts` — conversation persistence
- `packages/client/public/manifest.json` — icons + metadata

### New Dependencies

- `pdfjs-dist` (client) — PDF rendering
