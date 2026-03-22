# Multi-Provider LLM Support & UI Redesign

**Date:** 2026-03-22
**Status:** Approved

---

## 1. Multi-Provider LLM Support

### Problem

Magpie currently only supports Ollama for chat and embeddings, requiring a local LLM setup. On 8GB Macs, this limits model quality and response speed. Users should be able to use external providers (Gemini, OpenAI, etc.) via OpenAI-compatible APIs, with independent configuration for chat and embedding models.

### Architecture

#### Provider Abstraction

```
packages/server/services/providers/
├── types.ts          # Interfaces and shared types
├── ollama.ts         # Ollama implementation (chat + embed)
├── openai-compat.ts  # OpenAI-compatible implementation (chat + embed)
└── factory.ts        # Creates provider instances from config
```

**Shared types:**
```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface ToolCall {
  id: string
  function: { name: string; arguments: Record<string, unknown> }
}

interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface ChatResponse {
  content: string
  tool_calls?: ToolCall[]
}

interface ChatStreamChunk {
  content: string  // partial text delta
}
```

**LLMProvider interface:**
```typescript
interface LLMProvider {
  // Non-streaming: returns full response (used for tool-calling phase)
  chat(opts: {
    messages: ChatMessage[]
    tools?: ToolDefinition[]
  }): Promise<ChatResponse>

  // Streaming: yields text deltas (used for final response)
  chatStream(opts: {
    messages: ChatMessage[]
  }): AsyncIterable<ChatStreamChunk>

  name(): string        // "ollama" | "openai-compatible"
  modelName(): string   // "gemini-2.5-flash" etc.
  healthCheck(): Promise<{ status: string; model: string; loaded: boolean }>
}
```

**EmbeddingProvider interface:**
```typescript
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
  embedSingle(text: string): Promise<number[]>
  name(): string
  modelName(): string
  dimensions(): number
}
```

**Key design:** `chat()` and `chatStream()` are separate methods (not a `stream` boolean flag) because the two-pass pattern in the agent loop (non-streaming for tool detection, streaming for final response) is preserved. Each provider normalizes its SDK response into the shared types:
- **Ollama:** `message.tool_calls[].function.arguments` is already an object — pass through
- **OpenAI:** `choices[0].message.tool_calls[].function.arguments` is a JSON string — `JSON.parse()` it
- **Ollama streaming:** `chunk.message.content` → `{ content }`
- **OpenAI streaming:** `chunk.choices[0].delta.content` → `{ content }`

#### Configuration

**Environment variables (.env):**
```
# Chat provider
LLM_PROVIDER=openai-compatible    # "ollama" | "openai-compatible"
LLM_API_KEY=<key>
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.5-flash

# Embedding provider
EMBED_PROVIDER=openai-compatible  # "ollama" | "openai-compatible"
EMBED_API_KEY=<key>
EMBED_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
EMBED_MODEL=gemini-embedding-2-preview

# Ollama (used when provider=ollama)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

**Runtime override via Settings UI:**
- Settings page gains an "LLM Configuration" section
- User can switch providers, set API keys, base URLs, model names
- Stored in a new SQLite `settings` table (see schema below)
- Runtime settings override env vars
- API keys stored as plaintext in SQLite (acceptable — local-only app, single user)
- API keys masked in UI (show last 4 chars only)
- "Test Connection" button to validate config

**Priority:** Runtime settings > .env > hardcoded defaults

#### Settings Table (new SQLite schema)

Add to `createDb()` in `db.ts`:
```sql
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

**Keys used:**
```
llm_provider        → "ollama" | "openai-compatible"
llm_api_key         → string
llm_base_url        → string
llm_model           → string
embed_provider      → "ollama" | "openai-compatible"
embed_api_key       → string
embed_base_url      → string
embed_model         → string
embed_dimensions    → number (stored as string)
```

**New MagpieDb methods:**
```typescript
getSetting(key: string): string | null
setSetting(key: string, value: string): void
getAllSettings(): Record<string, string>
```

#### Settings API Endpoints

**GET /api/settings** (updated response):
```json
{
  "watchDirs": [...],
  "indexing": {...},
  "llm": {
    "provider": "openai-compatible",
    "apiKey": "****dIw",
    "baseUrl": "https://...",
    "model": "gemini-2.5-flash"
  },
  "embedding": {
    "provider": "openai-compatible",
    "apiKey": "****dIw",
    "baseUrl": "https://...",
    "model": "gemini-embedding-2-preview"
  },
  "version": "1.0.0"
}
```

**PUT /api/settings** (updated body — all fields optional):
```json
{
  "watchDirs": [...],
  "llm": {
    "provider": "openai-compatible",
    "apiKey": "AIza...",
    "baseUrl": "https://...",
    "model": "gemini-2.5-flash"
  },
  "embedding": {
    "provider": "openai-compatible",
    "apiKey": "AIza...",
    "baseUrl": "https://...",
    "model": "gemini-embedding-2-preview"
  }
}
```

**POST /api/settings/test-connection** (new):
```json
// Request
{
  "type": "llm" | "embedding",
  "provider": "openai-compatible",
  "apiKey": "...",
  "baseUrl": "https://...",
  "model": "gemini-2.5-flash"
}

// Response 200
{ "ok": true, "message": "Connected to gemini-2.5-flash" }

// Response 400/500
{ "ok": false, "message": "Invalid API key" }
```

Implementation: creates a temporary provider instance and calls `healthCheck()` (for LLM) or `embedSingle("test")` (for embedding).

#### Runtime Provider Hot-Swapping

When settings are updated via PUT /api/settings:

1. Settings saved to SQLite
2. `providerManager.reload()` is called
3. `ProviderManager` re-reads config (SQLite first, then env fallback)
4. Creates new provider instances, replaces old ones
5. Tool context's `embedQuery` function is a closure that delegates to `providerManager.getEmbeddingProvider()` — no re-wiring needed

```typescript
// In bootstrap.ts
const providerManager = new ProviderManager()
providerManager.init() // reads config, creates providers

// Tool context uses indirect reference
initToolContext({
  db,
  vectorDb,
  embedQuery: (text) => providerManager.getEmbeddingProvider().embedSingle(text),
  dataDir,
})

// In settings route, after saving
providerManager.reload()
```

#### Default behavior

- **Default provider: `openai-compatible`** (external LLM)
- If no API key is set and `LLM_PROVIDER` is `openai-compatible`, falls back to Ollama
- If Ollama is also unavailable, chat returns an error chunk: `{ type: 'error', message: 'No LLM provider available. Configure an API key in Settings or start Ollama.' }`
- Health endpoint reports provider status with clear messaging

#### OpenAI-Compatible Provider Implementation

Uses the `openai` npm package:
```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
})
```

**Chat (non-streaming):**
```typescript
const res = await client.chat.completions.create({
  model: config.model,
  messages,
  tools,
  stream: false,
})
// Normalize: choices[0].message → ChatResponse
// Parse tool_calls arguments from JSON string to object
```

**Chat (streaming):**
```typescript
const stream = await client.chat.completions.create({
  model: config.model,
  messages,
  stream: true,
})
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) yield { content }
}
```

**Embeddings:**
```typescript
const res = await client.embeddings.create({
  model: config.model,
  input: texts,
})
return res.data.map(d => d.embedding)
```

#### Embedding Dimension Handling

Different embedding models produce different vector dimensions:
- `nomic-embed-text`: 768 dimensions
- `gemini-embedding-2-preview`: 3072 dimensions

**Impact:** LanceDB table schema must match. When embedding provider/model changes, existing vectors become incompatible.

**Solution:**

1. Store current embedding config in SQLite settings (`embed_model`, `embed_dimensions`)
2. On provider change via Settings UI, compare new dimensions with stored dimensions
3. If dimensions differ:
   - UI shows warning: "Changing embedding model requires re-indexing all files. This may take a while."
   - User confirms
   - Backend drops LanceDB `file_chunks` table and recreates it
   - Triggers background re-indexing of all files in SQLite `files` table

**New VectorDb methods:**
```typescript
dropTable(): Promise<void>        // Drop and recreate file_chunks table
getDimensions(): number | null     // Read dimension of first vector, or null if empty
```

**Re-indexing process:**
1. Drop LanceDB table
2. Reset all files in SQLite by clearing `indexed_at`
3. Enqueue all file paths to `index_queue`
4. Existing indexer worker picks them up in batches of 10
5. Settings UI shows indexing progress via existing `GET /api/settings` response (`indexing.queueLength`)

This is a background operation — search is temporarily unavailable until re-indexing completes, returning empty results.

#### Files Changed

| File | Change |
|------|--------|
| `services/providers/types.ts` | New — interfaces and shared types |
| `services/providers/ollama.ts` | New — Ollama chat + embed provider |
| `services/providers/openai-compat.ts` | New — OpenAI-compatible chat + embed provider |
| `services/providers/factory.ts` | New — ProviderManager class |
| `services/embeddings.ts` | Remove — replaced by providers |
| `services/lancedb.ts` | Add `dropTable()` and `getDimensions()` methods |
| `services/db.ts` | Add `settings` table, `getSetting`/`setSetting`/`getAllSettings` methods |
| `agent/loop.ts` | Refactor to accept `LLMProvider` parameter instead of direct Ollama usage |
| `bootstrap.ts` | Initialize ProviderManager, pass to routes and agent |
| `routes/health.ts` | Report chat + embedding provider statuses separately |
| `routes/settings.ts` | Add LLM/embedding config in GET/PUT, add POST test-connection |
| `routes/chat.ts` | Pass LLMProvider to runAgent |
| `.env.example` | Add new env vars |
| `package.json` | Add `openai` dependency |

---

## 2. UI Redesign

### Problem

The current UI is functional but not professional: emoji icons, minimal visual hierarchy, no responsive layout, inconsistent spacing, basic loading states. It needs a Spotify/Discord-style rich interface.

### Design System

#### Icons
- **Heroicons** (`@heroicons/react`) — solid + outline variants
- Replace ALL emoji icons (▶️ ⏸ 🔀 🎤 ✕ etc.) with SVG equivalents

#### Color Palette
```
Background:  gray-950 (base), gray-900 (elevated), gray-800 (cards)
Surface:     gray-800 (cards), gray-700 (hover), gray-800/50 (active)
Primary:     blue-500 (actions), blue-600 (hover)
Text:        white (primary), gray-300 (secondary), gray-500 (muted)
Success:     emerald-500
Warning:     amber-500
Error:       rose-500
Accent:      violet-500 (now playing indicator)
```

Note: `gray-750` is not a standard Tailwind color. Use `gray-800/50` or `gray-700` for intermediate states.

#### Typography
- Headings: text-lg font-semibold (page titles), text-base font-medium (section titles)
- Body: text-sm (default), text-xs (metadata)
- No custom fonts — system font stack via Tailwind defaults

#### Spacing
- Consistent 4px grid: p-2, p-3, p-4, gap-2, gap-3, gap-4
- Card padding: p-4
- Page padding: p-4 (mobile), p-6 (desktop)

#### Transitions
- All interactive elements: `transition-colors duration-150`
- Hover states on every clickable element
- Smooth opacity transitions for loading states

### Layout

#### Responsive Navigation

**Desktop (>=768px):**
```
┌──────────┬─────────────────────────────────┐
│          │                                 │
│ Sidebar  │       Main Content              │
│ w-60     │       flex-1                    │
│          │                                 │
│ Logo     │                                 │
│ ──────── │                                 │
│ Chat     │                                 │
│ Recent   │                                 │
│ Media    │                                 │
│ Settings │                                 │
│          │                                 │
│          ├─────────────────────────────────┤
│          │       Playback Bar              │
└──────────┴─────────────────────────────────┘
```

**Mobile (<768px):**
```
┌─────────────────────────────────┐
│       Main Content              │
│       flex-1                    │
│                                 │
├─────────────────────────────────┤
│       Playback Bar              │
├─────────────────────────────────┤
│  Chat  Recent  Media  Settings  │
│       Bottom Nav                │
└─────────────────────────────────┘
```

Sidebar is collapsible to icon-only mode (w-16) via toggle button.

#### Component Redesigns

**ChatInput:**
- Rounded container with subtle border (border-gray-700)
- Textarea (auto-grow) instead of single-line input
- Send button with Heroicon `PaperAirplaneIcon`
- Voice button with `MicrophoneIcon`, recording state with red ring-2 ring-rose-500 animate-pulse

**MessageList:**
- User messages: right-aligned, blue-600 rounded bubbles
- Assistant messages: left-aligned, gray-800 background, full-width
- Avatar indicators (`UserCircleIcon` / custom Magpie icon)
- `whitespace-pre-wrap` for assistant text (no markdown library needed for now)
- Smooth fade-in animation for new messages (`animate-in`)

**PlaybackBar:**
- Album art with rounded-md and shadow-lg
- Track info with proper truncation (min-w-0 + truncate)
- Styled range input for progress (accent-blue-500)
- Heroicon controls: `ArrowsRightLeftIcon` (shuffle), `BackwardIcon`, `PlayIcon`/`PauseIcon`, `ForwardIcon`, `ArrowPathIcon` (repeat)
- Volume slider with `SpeakerWaveIcon` (desktop only, hidden md:flex)
- Time display: `text-xs text-gray-500`

**VideoCard:**
- Larger thumbnail (aspect-video, w-full)
- Hover overlay with `PlayIcon` centered (bg-black/40 opacity-0 hover:opacity-100 transition)
- Duration badge (bottom-right, bg-black/80, text-xs, rounded px-1.5)
- Title below thumbnail (text-sm font-medium truncate)

**AudioPlayer:**
- Card with album art (w-12 h-12 rounded), track info, play button
- Active track: border-l-2 border-violet-500
- Hover: bg-gray-700/50 transition-colors

**Settings:**
- Grouped sections with cards (bg-gray-800 rounded-xl p-4)
- Toggle switches (custom component with bg-gray-600/bg-blue-500 states)
- LLM Configuration section with:
  - Provider selector (`<select>` styled with bg-gray-700)
  - API key input (type=password, eye toggle to show/hide)
  - Base URL input
  - Model name input
  - "Test Connection" button (bg-emerald-600, shows result inline)
  - Separate cards for "Chat Model" and "Embedding Model"
- Status indicators: colored dots (w-2 h-2 rounded-full bg-emerald-500)

**Loading States:**
- `Spinner.tsx`: animated SVG circle (w-5 h-5 animate-spin text-blue-500)
- Skeleton cards for file lists (bg-gray-800 animate-pulse rounded-lg h-16)
- ThinkingIndicator: Spinner icon + "Using {tool}..." text

### Files Changed

| File | Change |
|------|--------|
| `App.tsx` | Add sidebar layout, responsive breakpoint logic |
| `components/Sidebar.tsx` | New — sidebar navigation (desktop) |
| `components/BottomNav.tsx` | New — extract from App, mobile nav |
| `components/ChatInput.tsx` | Textarea, Heroicons, border styling |
| `components/MessageList.tsx` | Avatars, better bubbles, fade-in |
| `components/PlaybackBar.tsx` | Full redesign with Heroicon controls, volume |
| `components/ThinkingIndicator.tsx` | Spinner icon |
| `components/VoiceInput.tsx` | Heroicon mic, ring animation |
| `components/ImageLightbox.tsx` | Heroicon arrows/close, better backdrop |
| `components/ui/Spinner.tsx` | New — reusable spinner |
| `renderers/VideoCard.tsx` | Larger thumbs, hover overlay |
| `renderers/AudioPlayer.tsx` | Active indicator, better layout |
| `renderers/ImageGrid.tsx` | Hover effects, better spacing |
| `renderers/PDFViewer.tsx` | Heroicon controls |
| `renderers/DocViewer.tsx` | Better card styling |
| `renderers/FileList.tsx` | Hover states, file type icons |
| `routes/Chat.tsx` | Layout adjustments for sidebar |
| `routes/ConversationList.tsx` | Better cards, hover states, icons |
| `routes/Recent.tsx` | Section headers, skeleton loading |
| `routes/Media.tsx` | Tab redesign, styled search input |
| `routes/Settings.tsx` | LLM config UI, toggles, grouped cards |
| `package.json` | Add `@heroicons/react` |

---

## 3. Testing Strategy

### Multi-Provider LLM
- Unit tests for provider factory (mock config → correct provider type)
- Unit tests for message format normalization (Ollama response → ChatResponse, OpenAI response → ChatResponse)
- Unit tests for streaming normalization
- Unit tests for settings table CRUD
- Integration test: health endpoint with different provider configs
- Integration test: test-connection endpoint
- Manual test: chat with Gemini 2.5 Flash via API key
- Manual test: embedding with gemini-embedding-2-preview

### UI Redesign
- Existing Playwright e2e tests should continue passing (same DOM structure, updated styling)
- Visual review of all routes on desktop (>=768px) and mobile (<768px)
- Verify all emoji replacements with Heroicons render correctly
- Test playback controls still function after icon swap
- Test settings page LLM configuration flow end-to-end
- Test sidebar collapse/expand on desktop
- Test bottom nav on mobile viewport

---

## 4. Migration & Backwards Compatibility

- Existing Ollama users: set `LLM_PROVIDER=ollama` in `.env` — everything works as before
- Default is now `openai-compatible` — new users configure an API key
- If no API key and no Ollama, chat returns clear error message
- Existing LanceDB vectors will need re-indexing if embedding model changes (dimension mismatch) — triggered via Settings UI
- New `settings` table is created automatically via `CREATE TABLE IF NOT EXISTS` — no migration script needed
- All existing API endpoints continue to work — settings endpoint is backwards compatible (new fields are optional)
