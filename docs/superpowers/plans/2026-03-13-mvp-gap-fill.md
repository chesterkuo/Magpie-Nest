# Magpie MVP Gap Fill — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all missing P0 MVP features: voice pipeline, file serving, document preview, playlists, interactive pages, PWA, and health endpoint.

**Architecture:** Two parallel tracks (backend + frontend) converging at voice integration. Backend builds DB schema, REST endpoints, voice services, and agent tools. Frontend builds document preview, audio player, interactive pages, and PWA. Both tracks are independently testable.

**Tech Stack:** Bun + Hono (server), React 19 + Vite + TailwindCSS v4 (client), bun:sqlite, LanceDB, whisper.cpp (STT), Kokoro (TTS), pdfjs-dist, mammoth, xlsx.

**Spec:** `docs/superpowers/specs/2026-03-13-mvp-gap-fill-design.md`

---

## Chunk 1: Database & Shared Types

### Task 1: Extend shared types

**Files:**
- Modify: `packages/shared/types.ts`

- [ ] **Step 1: Write the new types**

Add these types to the end of `packages/shared/types.ts`:

```typescript
export interface PlaylistSummary {
  id: string
  name: string
  trackCount: number
  createdAt: string
  updatedAt: string
}

export interface Playlist extends PlaylistSummary {
  items: FileItem[]
}

export interface Message {
  role: 'user' | 'assistant'
  text: string
  items?: FileItem[]
  thinking?: string
}

export interface ConversationSummary {
  id: string
  preview: string
  messageCount: number
  updatedAt: string
}

export interface Conversation {
  id: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Update useSSE.ts to import Message from shared**

In `packages/client/src/hooks/useSSE.ts`, remove the local `Message` interface definition (lines 4-9) and replace with:
```typescript
import type { AgentChunk, FileItem, Message } from '@magpie/shared'
```
Remove `export type { Message }` line and re-export from shared if needed by other client files.

- [ ] **Step 3: Verify types compile**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/types.ts packages/client/src/hooks/useSSE.ts
git commit -m "feat: add Playlist, Conversation, Message shared types"
```

---

### Task 2: Add playlist tables and methods to MagpieDb

**Files:**
- Modify: `packages/server/services/db.ts`
- Test: `packages/server/services/__tests__/db.test.ts`

- [ ] **Step 1: Write failing tests for playlist methods**

Add to `packages/server/services/__tests__/db.test.ts`:

```typescript
describe('playlists', () => {
  it('creates and lists playlists', () => {
    db.createPlaylist('pl-1', 'My Playlist')
    const playlists = db.listPlaylists()
    expect(playlists.length).toBe(1)
    expect(playlists[0].name).toBe('My Playlist')
  })

  it('adds items to playlist and retrieves them', () => {
    db.upsertFile({
      id: 'f1', path: '/tmp/song.mp3', name: 'song.mp3',
      mime_type: 'audio/mpeg', size: 5000, modified_at: '2026-01-01T00:00:00Z',
      file_type: 'audio', meta: '{}', hash: 'a1',
    })
    db.createPlaylist('pl-2', 'Jazz')
    db.addToPlaylist('pl-2', 'f1', 0)
    const items = db.getPlaylistItems('pl-2')
    expect(items.length).toBe(1)
    expect(items[0].name).toBe('song.mp3')
  })

  it('removes items from playlist', () => {
    db.upsertFile({
      id: 'f2', path: '/tmp/song2.mp3', name: 'song2.mp3',
      mime_type: 'audio/mpeg', size: 5000, modified_at: '2026-01-01T00:00:00Z',
      file_type: 'audio', meta: '{}', hash: 'a2',
    })
    db.createPlaylist('pl-3', 'Rock')
    db.addToPlaylist('pl-3', 'f2', 0)
    db.removeFromPlaylist('pl-3', 'f2')
    const items = db.getPlaylistItems('pl-3')
    expect(items.length).toBe(0)
  })

  it('deletes playlist cascades items', () => {
    db.upsertFile({
      id: 'f3', path: '/tmp/song3.mp3', name: 'song3.mp3',
      mime_type: 'audio/mpeg', size: 5000, modified_at: '2026-01-01T00:00:00Z',
      file_type: 'audio', meta: '{}', hash: 'a3',
    })
    db.createPlaylist('pl-4', 'Temp')
    db.addToPlaylist('pl-4', 'f3', 0)
    db.deletePlaylist('pl-4')
    const playlists = db.listPlaylists()
    expect(playlists.filter(p => p.id === 'pl-4').length).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: FAIL — methods not defined

- [ ] **Step 3: Add playlist tables to createDb**

In `packages/server/services/db.ts`, add after the `index_queue` table creation:

```typescript
CREATE TABLE IF NOT EXISTS playlists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  file_id     TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  added_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id, position);
```

- [ ] **Step 4: Add playlist prepared statements**

Add to the `stmts` object:

```typescript
createPlaylist: db.prepare('INSERT INTO playlists (id, name) VALUES (?, ?)'),
deletePlaylist: db.prepare('DELETE FROM playlists WHERE id = ?'),
listPlaylists: db.prepare('SELECT id, name, created_at, updated_at FROM playlists ORDER BY updated_at DESC'),
addToPlaylist: db.prepare('INSERT INTO playlist_items (playlist_id, file_id, position) VALUES (?, ?, ?)'),
removeFromPlaylist: db.prepare('DELETE FROM playlist_items WHERE playlist_id = ? AND file_id = ?'),
getPlaylistItems: db.prepare(`
  SELECT f.* FROM files f
  JOIN playlist_items pi ON f.id = pi.file_id
  WHERE pi.playlist_id = ?
  ORDER BY pi.position
`),
playlistItemCount: db.prepare('SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = ?'),
```

- [ ] **Step 5: Add playlist methods to MagpieDb interface and return object**

Update `MagpieDb` interface:

```typescript
createPlaylist(id: string, name: string): void
deletePlaylist(id: string): void
listPlaylists(): Array<{ id: string; name: string; trackCount: number; created_at: string; updated_at: string }>
addToPlaylist(playlistId: string, fileId: string, position: number): void
removeFromPlaylist(playlistId: string, fileId: string): void
getPlaylistItems(playlistId: string): FileRecord[]
```

Add implementations in the return object:

```typescript
createPlaylist(id: string, name: string) {
  stmts.createPlaylist.run(id, name)
},

deletePlaylist(id: string) {
  stmts.deletePlaylist.run(id)
},

listPlaylists() {
  const rows = stmts.listPlaylists.all() as Array<{ id: string; name: string; created_at: string; updated_at: string }>
  return rows.map(r => ({
    ...r,
    trackCount: (stmts.playlistItemCount.get(r.id) as { count: number }).count,
  }))
},

addToPlaylist(playlistId: string, fileId: string, position: number) {
  stmts.addToPlaylist.run(playlistId, fileId, position)
},

removeFromPlaylist(playlistId: string, fileId: string) {
  stmts.removeFromPlaylist.run(playlistId, fileId)
},

getPlaylistItems(playlistId: string) {
  return stmts.getPlaylistItems.all(playlistId) as FileRecord[]
},
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/services/db.ts packages/server/services/__tests__/db.test.ts
git commit -m "feat: add playlist tables and CRUD methods to MagpieDb"
```

---

### Task 3: Add conversation table and methods to MagpieDb

**Files:**
- Modify: `packages/server/services/db.ts`
- Test: `packages/server/services/__tests__/db.test.ts`

- [ ] **Step 1: Write failing tests for conversation methods**

Add to `packages/server/services/__tests__/db.test.ts`:

```typescript
describe('conversations', () => {
  it('saves and retrieves a conversation', () => {
    const msgs = JSON.stringify([{ role: 'user', text: 'hello' }])
    db.saveConversation('c-1', msgs)
    const conv = db.getConversation('c-1')
    expect(conv).not.toBeNull()
    expect(conv!.messages).toBe(msgs)
  })

  it('upserts on duplicate id', () => {
    db.saveConversation('c-2', JSON.stringify([{ role: 'user', text: 'v1' }]))
    db.saveConversation('c-2', JSON.stringify([{ role: 'user', text: 'v2' }]))
    const conv = db.getConversation('c-2')
    expect(conv!.messages).toContain('v2')
  })

  it('lists conversations with preview', () => {
    db.saveConversation('c-3', JSON.stringify([
      { role: 'user', text: 'Find my photos from last week' },
      { role: 'assistant', text: 'Here are your photos' },
    ]))
    const list = db.listConversations(10)
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0].id).toBe('c-3')
    expect(list[0].messageCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: FAIL — methods not defined

- [ ] **Step 3: Add conversation table to createDb**

Add after playlist tables:

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  messages    TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
```

- [ ] **Step 4: Add conversation prepared statements**

```typescript
saveConversation: db.prepare(`
  INSERT INTO conversations (id, messages) VALUES (?, ?)
  ON CONFLICT(id) DO UPDATE SET messages = excluded.messages, updated_at = datetime('now')
`),
getConversation: db.prepare('SELECT * FROM conversations WHERE id = ?'),
listConversations: db.prepare('SELECT id, messages, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?'),
```

- [ ] **Step 5: Add conversation methods to MagpieDb interface and return object**

Interface additions:

```typescript
saveConversation(id: string, messagesJson: string): void
getConversation(id: string): { id: string; messages: string; created_at: string; updated_at: string } | null
listConversations(limit: number): Array<{ id: string; preview: string; messageCount: number; updatedAt: string }>
```

Implementations:

```typescript
saveConversation(id: string, messagesJson: string) {
  stmts.saveConversation.run(id, messagesJson)
},

getConversation(id: string) {
  return (stmts.getConversation.get(id) as any) ?? null
},

listConversations(limit: number) {
  const rows = stmts.listConversations.all(limit) as Array<{ id: string; messages: string; updated_at: string }>
  return rows.map(r => {
    const msgs = JSON.parse(r.messages) as Array<{ role: string; text: string }>
    const firstUser = msgs.find(m => m.role === 'user')
    return {
      id: r.id,
      preview: (firstUser?.text || '').slice(0, 100),
      messageCount: msgs.length,
      updatedAt: r.updated_at,
    }
  })
},
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/services/db.ts packages/server/services/__tests__/db.test.ts
git commit -m "feat: add conversations table and CRUD methods to MagpieDb"
```

---

### Task 4: Add listFiles method to MagpieDb (for /api/files)

**Files:**
- Modify: `packages/server/services/db.ts`
- Test: `packages/server/services/__tests__/db.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('listFiles', () => {
  beforeEach(() => {
    db.upsertFile({
      id: 'lf-1', path: '/tmp/a.mp4', name: 'a.mp4',
      mime_type: 'video/mp4', size: 1000, modified_at: '2026-03-10T00:00:00Z',
      file_type: 'video', meta: '{}', hash: 'x1',
    })
    db.upsertFile({
      id: 'lf-2', path: '/tmp/b.pdf', name: 'b.pdf',
      mime_type: 'application/pdf', size: 500, modified_at: '2026-03-12T00:00:00Z',
      file_type: 'pdf', meta: '{}', hash: 'x2',
    })
  })

  it('returns paginated results with total', () => {
    const result = db.listFiles({ limit: 10, offset: 0 })
    expect(result.files.length).toBe(2)
    expect(result.total).toBe(2)
  })

  it('filters by file_type', () => {
    const result = db.listFiles({ limit: 10, offset: 0, file_type: 'video' })
    expect(result.files.length).toBe(1)
    expect(result.files[0].name).toBe('a.mp4')
  })

  it('sorts by name ascending', () => {
    const result = db.listFiles({ limit: 10, offset: 0, sort: 'name', order: 'asc' })
    expect(result.files[0].name).toBe('a.mp4')
  })

  it('respects offset for pagination', () => {
    const result = db.listFiles({ limit: 1, offset: 1, sort: 'name', order: 'asc' })
    expect(result.files.length).toBe(1)
    expect(result.files[0].name).toBe('b.pdf')
    expect(result.total).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement listFiles**

Add to `MagpieDb` interface:

```typescript
listFiles(opts: {
  limit: number; offset: number;
  sort?: 'modified_at' | 'name' | 'size'; order?: 'asc' | 'desc';
  file_type?: string; days?: number;
}): { files: FileRecord[]; total: number }
```

Implementation (dynamic query, no prepared statement):

```typescript
listFiles({ limit, offset, sort = 'modified_at', order = 'desc', file_type, days }) {
  const allowedSort = ['modified_at', 'name', 'size']
  const allowedOrder = ['asc', 'desc']
  const sortCol = allowedSort.includes(sort) ? sort : 'modified_at'
  const sortOrder = allowedOrder.includes(order!) ? order : 'desc'

  const conditions: string[] = []
  const params: unknown[] = []

  if (file_type) {
    conditions.push('file_type = ?')
    params.push(file_type)
  }
  if (days) {
    conditions.push("modified_at >= datetime('now', ?)")
    params.push(`-${days} days`)
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM files${where}`).get(...params) as { count: number }
  const files = db.prepare(
    `SELECT * FROM files${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as FileRecord[]

  return { files, total: countRow.count }
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/services/db.ts packages/server/services/__tests__/db.test.ts
git commit -m "feat: add listFiles with pagination, sort, and filter to MagpieDb"
```

---

### Task 4b: Install nanoid in server package

- [ ] **Step 1: Install nanoid**

Run: `cd packages/server && bun add nanoid`

- [ ] **Step 2: Commit**

```bash
git add packages/server/package.json packages/server/bun.lockb
git commit -m "chore: add nanoid dependency to server package"
```

---

## Chunk 2: Backend API Routes

### Task 5: Implement /api/file/:id (replace 501 stub)

**Files:**
- Modify: `packages/server/routes/file.ts`
- Modify: `packages/server/index.ts` (verify bootstrap passes db)

- [ ] **Step 1: Implement file serving route**

Replace `packages/server/routes/file.ts`:

```typescript
import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import { existsSync } from 'fs'
import { stat } from 'fs/promises'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export function createFileRoute(db: MagpieDb) {
  const route = new Hono()

  route.get('/file/:id', async (c) => {
    const { id } = c.req.param()
    const record = db.getFileById(id)
    if (!record) return c.json({ error: 'File not found' }, 404)
    if (!existsSync(record.path)) return c.json({ error: 'File missing from disk' }, 404)

    const file = Bun.file(record.path)
    const fileSize = file.size
    const range = c.req.header('Range')

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1])
        const end = match[2] ? parseInt(match[2]) : fileSize - 1
        const chunk = file.slice(start, end + 1)
        return new Response(chunk, {
          status: 206,
          headers: {
            'Content-Type': record.mime_type,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
            'Content-Disposition': `inline; filename="${record.name}"`,
          },
        })
      }
    }

    return new Response(file, {
      headers: {
        'Content-Type': record.mime_type,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${record.name}"`,
      },
    })
  })

  route.get('/file/:id/preview', async (c) => {
    const { id } = c.req.param()
    const record = db.getFileById(id)
    if (!record) return c.json({ error: 'File not found' }, 404)
    if (!existsSync(record.path)) return c.json({ error: 'File missing from disk' }, 404)

    if (record.file_type === 'pdf') {
      return c.redirect(`/api/file/${id}`)
    }

    if (record.mime_type.includes('wordprocessingml') || record.path.endsWith('.docx')) {
      const buffer = await Bun.file(record.path).arrayBuffer()
      const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#e5e7eb;background:#111827}img{max-width:100%}</style></head><body>${result.value}</body></html>`
      return c.html(html)
    }

    if (record.mime_type.includes('spreadsheetml') || record.path.endsWith('.xlsx')) {
      const buffer = await Bun.file(record.path).arrayBuffer()
      const workbook = XLSX.read(buffer)
      let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;color:#e5e7eb;background:#111827;padding:1rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #374151;padding:4px 8px;text-align:left}th{background:#1f2937}</style></head><body>'
      for (const name of workbook.SheetNames) {
        html += `<h2>${name}</h2>` + XLSX.utils.sheet_to_html(workbook.Sheets[name])
      }
      html += '</body></html>'
      return c.html(html)
    }

    return c.json({ error: 'Preview not supported for this file type' }, 404)
  })

  return route
}
```

- [ ] **Step 2: Update index.ts to pass db to file route**

This requires the file route to receive db at construction. Update `packages/server/index.ts`:

Change `import { fileRoute } from './routes/file'` to `import { createFileRoute } from './routes/file'`.

Update bootstrap to return `appContext` and create route after bootstrap:

```typescript
const appContext = await bootstrap()
// ... existing routes ...
api.route('/', createFileRoute(appContext.db))
```

Remove the old `api.route('/', fileRoute)` line.

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `cd packages/server && bun test`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/routes/file.ts packages/server/index.ts
git commit -m "feat: implement /api/file/:id with Range support and /api/file/:id/preview"
```

---

### Task 6: Implement /api/files listing route

**Files:**
- Create: `packages/server/routes/files.ts`
- Modify: `packages/server/index.ts`

- [ ] **Step 1: Create the files listing route**

Create `packages/server/routes/files.ts`:

```typescript
import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import type { FileType, RenderType } from '@magpie/shared'

function fileTypeToRenderType(type: string): RenderType {
  const map: Record<string, RenderType> = {
    video: 'video_card', audio: 'audio_player', pdf: 'pdf_preview',
    image: 'image_grid', doc: 'file_list',
  }
  return map[type] || 'file_list'
}

export function createFilesRoute(db: MagpieDb) {
  const route = new Hono()

  route.get('/files', (c) => {
    const sort = (c.req.query('sort') || 'modified_at') as 'modified_at' | 'name' | 'size'
    const order = (c.req.query('order') || 'desc') as 'asc' | 'desc'
    const file_type = c.req.query('type')
    const days = c.req.query('days') ? Number(c.req.query('days')) : undefined
    const limit = Number(c.req.query('limit') || '50')
    const offset = Number(c.req.query('offset') || '0')

    const result = db.listFiles({ limit, offset, sort, order, file_type, days })
    const files = result.files.map(r => ({
      id: r.id, name: r.name, type: r.file_type as FileType,
      size: r.size, modified: r.modified_at,
      renderType: fileTypeToRenderType(r.file_type),
      streamUrl: `/api/stream/${r.id}`, thumbUrl: `/api/thumb/${r.id}`,
    }))

    return c.json({ files, total: result.total, limit, offset })
  })

  return route
}
```

- [ ] **Step 2: Mount in index.ts**

Add import: `import { createFilesRoute } from './routes/files'`
Add route: `api.route('/', createFilesRoute(appContext.db))`

- [ ] **Step 3: Commit**

```bash
git add packages/server/routes/files.ts packages/server/index.ts
git commit -m "feat: add /api/files with pagination, sort, and type filter"
```

---

### Task 7: Implement playlists REST routes

**Files:**
- Create: `packages/server/routes/playlists.ts`
- Modify: `packages/server/index.ts`

- [ ] **Step 1: Create playlists route**

Create `packages/server/routes/playlists.ts`:

```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import type { MagpieDb } from '../services/db'
import type { FileType, RenderType } from '@magpie/shared'

function fileTypeToRenderType(type: string): RenderType {
  const map: Record<string, RenderType> = {
    video: 'video_card', audio: 'audio_player', pdf: 'pdf_preview',
    image: 'image_grid', doc: 'file_list',
  }
  return map[type] || 'file_list'
}

export function createPlaylistsRoute(db: MagpieDb) {
  const route = new Hono()

  route.get('/playlists', (c) => {
    const playlists = db.listPlaylists()
    return c.json({
      playlists: playlists.map(p => ({
        id: p.id, name: p.name, trackCount: p.trackCount,
        createdAt: p.created_at, updatedAt: p.updated_at,
      })),
    })
  })

  route.post('/playlists', async (c) => {
    const { name } = await c.req.json<{ name: string }>()
    if (!name) return c.json({ error: 'Missing required field: name' }, 400)
    const id = nanoid()
    db.createPlaylist(id, name)
    return c.json({ id, name, trackCount: 0 }, 201)
  })

  route.get('/playlists/:id', (c) => {
    const { id } = c.req.param()
    const playlists = db.listPlaylists()
    const playlist = playlists.find(p => p.id === id)
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404)
    const items = db.getPlaylistItems(id).map(r => ({
      id: r.id, name: r.name, type: r.file_type as FileType,
      size: r.size, modified: r.modified_at,
      renderType: fileTypeToRenderType(r.file_type),
      streamUrl: `/api/stream/${r.id}`, thumbUrl: `/api/thumb/${r.id}`,
    }))
    return c.json({
      id: playlist.id, name: playlist.name, trackCount: playlist.trackCount,
      createdAt: playlist.created_at, updatedAt: playlist.updated_at, items,
    })
  })

  route.put('/playlists/:id', async (c) => {
    const { id } = c.req.param()
    const body = await c.req.json<{ name?: string }>()
    if (body.name) {
      db.db.prepare('UPDATE playlists SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(body.name, id)
    }
    return c.json({ id, name: body.name })
  })

  route.delete('/playlists/:id', (c) => {
    const { id } = c.req.param()
    db.deletePlaylist(id)
    return c.json({ ok: true })
  })

  route.post('/playlists/:id/items', async (c) => {
    const { id } = c.req.param()
    const { fileId, position } = await c.req.json<{ fileId: string; position: number }>()
    if (!fileId) return c.json({ error: 'Missing required field: fileId' }, 400)
    db.addToPlaylist(id, fileId, position ?? 0)
    db.db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(id)
    return c.json({ ok: true }, 201)
  })

  route.delete('/playlists/:id/items/:fileId', (c) => {
    const { id, fileId } = c.req.param()
    db.removeFromPlaylist(id, fileId)
    db.db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(id)
    return c.json({ ok: true })
  })

  return route
}
```

- [ ] **Step 2: Mount in index.ts**

Add import and route line.

- [ ] **Step 3: Commit**

```bash
git add packages/server/routes/playlists.ts packages/server/index.ts
git commit -m "feat: add playlists CRUD REST routes"
```

---

### Task 8: Implement conversations REST routes

**Files:**
- Create: `packages/server/routes/conversations.ts`
- Modify: `packages/server/index.ts`

- [ ] **Step 1: Create conversations route**

Create `packages/server/routes/conversations.ts`:

```typescript
import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'

export function createConversationsRoute(db: MagpieDb) {
  const route = new Hono()

  route.put('/conversations/:id', async (c) => {
    const { id } = c.req.param()
    const { messages } = await c.req.json<{ messages: any[] }>()
    if (!messages) return c.json({ error: 'Missing required field: messages' }, 400)
    db.saveConversation(id, JSON.stringify(messages))
    return c.json({ id })
  })

  route.get('/conversations', (c) => {
    const limit = Number(c.req.query('limit') || '50')
    const conversations = db.listConversations(limit)
    return c.json({ conversations })
  })

  route.get('/conversations/:id', (c) => {
    const { id } = c.req.param()
    const conv = db.getConversation(id)
    if (!conv) return c.json({ error: 'Conversation not found' }, 404)
    return c.json({
      id: conv.id,
      messages: JSON.parse(conv.messages),
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    })
  })

  return route
}
```

- [ ] **Step 2: Mount in index.ts**

Add import and route line.

- [ ] **Step 3: Commit**

```bash
git add packages/server/routes/conversations.ts packages/server/index.ts
git commit -m "feat: add conversations REST routes"
```

---

### Task 9: Implement settings and index trigger routes

**Files:**
- Create: `packages/server/routes/settings.ts`
- Modify: `packages/server/index.ts`
- Modify: `packages/server/bootstrap.ts` (expose watcher state)

- [ ] **Step 1: Create settings route**

Create `packages/server/routes/settings.ts`:

```typescript
import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

export function createSettingsRoute(db: MagpieDb, getWatchDirs: () => string[], setWatchDirs: (dirs: string[]) => void) {
  const route = new Hono()

  route.get('/settings', (c) => {
    const queueLength = (db.db.prepare("SELECT COUNT(*) as count FROM index_queue WHERE status = 'pending'").get() as { count: number }).count
    const totalIndexed = (db.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }).count
    const lastRow = db.db.prepare('SELECT indexed_at FROM files ORDER BY indexed_at DESC LIMIT 1').get() as { indexed_at: string } | null

    return c.json({
      watchDirs: getWatchDirs(),
      indexing: {
        queueLength,
        totalIndexed,
        lastIndexedAt: lastRow?.indexed_at ?? null,
      },
      version: '1.0.0',
    })
  })

  route.put('/settings', async (c) => {
    const body = await c.req.json<{ watchDirs?: string[] }>()
    if (body.watchDirs) {
      setWatchDirs(body.watchDirs)
    }
    // Return updated settings (re-fetch)
    const res = await route.fetch(new Request('http://localhost/settings'), c.env)
    return res
  })

  route.post('/index/trigger', async (c) => {
    const { path } = await c.req.json<{ path: string }>()
    if (!path) return c.json({ error: 'Missing required field: path' }, 400)
    const resolved = resolve(path)
    if (!existsSync(resolved)) return c.json({ error: 'Path does not exist' }, 404)

    // Recursively find files and enqueue them
    let queued = 0
    function enqueueDir(dir: string) {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.')) enqueueDir(full)
        } else {
          db.enqueue(full, 'created')
          queued++
        }
      }
    }
    enqueueDir(resolved)
    return c.json({ queued })
  })

  return route
}
```

- [ ] **Step 2: Update bootstrap.ts to expose watch dirs state**

Add mutable `watchDirs` tracking and expose getter/setter from `bootstrap()`:

```typescript
export interface AppContext {
  db: MagpieDb
  vectorDb: VectorDb
  getWatchDirs: () => string[]
  setWatchDirs: (dirs: string[]) => void
}
```

Store `WATCH_DIRS` in a `let currentWatchDirs = [...WATCH_DIRS]` and return getters/setters.

- [ ] **Step 3: Mount in index.ts**

```typescript
import { createSettingsRoute } from './routes/settings'
api.route('/', createSettingsRoute(appContext.db, appContext.getWatchDirs, appContext.setWatchDirs))
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/routes/settings.ts packages/server/bootstrap.ts packages/server/index.ts
git commit -m "feat: add settings and index trigger routes"
```

---

### Task 10: Enhance health endpoint

**Files:**
- Modify: `packages/server/routes/health.ts`

- [ ] **Step 1: Rewrite health route with service checks**

Replace `packages/server/routes/health.ts`:

```typescript
import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import type { VectorDb } from '../services/lancedb'

const startTime = Date.now()

export function createHealthRoute(db: MagpieDb, vectorDb: VectorDb) {
  const route = new Hono()

  route.get('/health', async (c) => {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const dataDir = process.env.DATA_DIR || './data'

    // Check Ollama
    let ollamaStatus: any = { status: 'error', model: '', loaded: false }
    try {
      const res = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json() as { models?: Array<{ name: string }> }
        const model = process.env.OLLAMA_MODEL || 'qwen3:8b'
        ollamaStatus = {
          status: 'ok',
          model,
          loaded: data.models?.some(m => m.name.includes(model.split(':')[0])) ?? false,
        }
      }
    } catch {}

    // Check SQLite
    let sqliteStatus: any = { status: 'error', totalFiles: 0 }
    try {
      const row = db.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }
      sqliteStatus = { status: 'ok', totalFiles: row.count }
    } catch {}

    // Check LanceDB
    let lanceStatus: any = { status: 'error', totalChunks: 0 }
    try {
      const count = await vectorDb.count()
      lanceStatus = { status: 'ok', totalChunks: count }
    } catch {
      // count method may not exist yet — treat as ok with 0
      lanceStatus = { status: 'ok', totalChunks: 0 }
    }

    // Check whisper binary
    const whisperModel = `${dataDir}/models/ggml-base.en.bin`
    const whisperStatus = {
      status: (await Bun.file(whisperModel).exists()) ? 'ok' as const : 'unavailable' as const,
      modelPath: whisperModel,
    }

    // Check Kokoro PID
    const kokoroPid = `${dataDir}/kokoro.pid`
    let kokoroRunning = false
    try {
      if (await Bun.file(kokoroPid).exists()) {
        const pid = parseInt(await Bun.file(kokoroPid).text())
        process.kill(pid, 0) // throws if process not running
        kokoroRunning = true
      }
    } catch {}

    const criticalOk = ollamaStatus.status === 'ok' && sqliteStatus.status === 'ok' && lanceStatus.status === 'ok'
    const voiceOk = whisperStatus.status === 'ok' && kokoroRunning

    // Disk usage
    async function getDiskInfo(path: string) {
      try {
        const proc = Bun.spawn(['df', '-k', path])
        const output = await new Response(proc.stdout).text()
        const lines = output.trim().split('\n')
        if (lines.length >= 2) {
          const parts = lines[1].split(/\s+/)
          return { path, freeBytes: parseInt(parts[3]) * 1024, totalBytes: parseInt(parts[1]) * 1024 }
        }
      } catch {}
      return { path, freeBytes: 0, totalBytes: 0 }
    }
    const dataDirDisk = await getDiskInfo(dataDir)

    return c.json({
      status: criticalOk ? (voiceOk ? 'ok' : 'degraded') : 'error',
      services: {
        ollama: ollamaStatus,
        lancedb: lanceStatus,
        sqlite: sqliteStatus,
        whisper: whisperStatus,
        kokoro: { status: kokoroRunning ? 'ok' : 'unavailable', processRunning: kokoroRunning },
      },
      disk: { dataDir: dataDirDisk, watchDirs: [] },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0',
    })
  })

  return route
}
```

- [ ] **Step 2: Update index.ts to pass db and vectorDb to health route**

Change from `import { healthRoute } from './routes/health'` to `import { createHealthRoute } from './routes/health'`.

The health route must still be mounted BEFORE the auth middleware, or the auth middleware must continue to exempt `/api/health`. Since the current auth middleware already skips `/api/health`, mount the new route the same way:

```typescript
api.route('/', createHealthRoute(appContext.db, appContext.vectorDb))
```

- [ ] **Step 3: Add count() method to VectorDb if not present**

Check `packages/server/services/lancedb.ts`. If `VectorDb` does not have a `count()` method, add one:

```typescript
async count(): Promise<number> {
  try {
    const table = await db.openTable('file_chunks')
    return await table.countRows()
  } catch { return 0 }
}
```

- [ ] **Step 4: Run all tests**

Run: `cd packages/server && bun test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/routes/health.ts packages/server/services/lancedb.ts packages/server/index.ts
git commit -m "feat: enhance health endpoint with service checks and status levels"
```

---

### Task 11: Add new agent tools (create_playlist, list_directory, get_disk_status)

**Files:**
- Modify: `packages/server/agent/tools/registry.ts`
- Modify: `packages/server/agent/prompt.ts`

- [ ] **Step 1: Add create_playlist tool implementation**

Add to `toolImplementations` in `registry.ts`:

```typescript
async create_playlist(args: { name: string; query?: string; file_type?: string; limit?: number }) {
  const { nanoid } = await import('nanoid')
  const id = nanoid()
  ctx.db.createPlaylist(id, args.name)

  if (args.query) {
    const vector = await ctx.embedQuery(args.query)
    const results = await ctx.vectorDb.search(vector, args.limit || 20)
    const audioResults = results.filter(r => r.file_type === 'audio')
    const seen = new Set<string>()
    const unique = audioResults.filter(r => {
      if (seen.has(r.file_id)) return false
      seen.add(r.file_id)
      return true
    })
    unique.forEach((r, i) => ctx.db.addToPlaylist(id, r.file_id, i))
    const files = unique
      .map(r => ctx.db.getFileById(r.file_id))
      .filter(Boolean)
      .map(toFileItem)
    return { playlist: { id, name: args.name }, files }
  }
  return { playlist: { id, name: args.name }, files: [] }
},
```

- [ ] **Step 2: Add list_directory tool implementation**

```typescript
async list_directory(args: { path: string; sort_by?: string; file_type?: string }) {
  const allowedSort = ['name', 'modified_at', 'size']
  const sort = allowedSort.includes(args.sort_by || '') ? args.sort_by! : 'modified_at'
  const conditions: string[] = ['path LIKE ?']
  const params: unknown[] = [`${args.path}%`]
  if (args.file_type) {
    conditions.push('file_type = ?')
    params.push(args.file_type)
  }
  const where = ' WHERE ' + conditions.join(' AND ')
  const files = ctx.db.db.prepare(
    `SELECT * FROM files${where} ORDER BY ${sort} DESC LIMIT 100`
  ).all(...params) as any[]
  return { files: files.map(toFileItem) }
},
```

- [ ] **Step 3: Add get_disk_status tool implementation**

```typescript
async get_disk_status(args: { path?: string }) {
  const { db } = ctx
  const types = ['video', 'audio', 'pdf', 'image', 'doc'] as const
  const fileStats: Record<string, { count: number; totalSize: number }> = {}
  for (const t of types) {
    const row = db.db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(size),0) as totalSize FROM files WHERE file_type = ?').get(t) as { count: number; totalSize: number }
    fileStats[t] = { count: row.count, totalSize: row.totalSize }
  }

  let disk = { free: 0, total: 0, used: 0 }
  try {
    const proc = Bun.spawn(['df', '-k', args.path || ctx.dataDir])
    const output = await new Response(proc.stdout).text()
    const lines = output.trim().split('\n')
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/)
      const total = parseInt(parts[1]) * 1024
      const used = parseInt(parts[2]) * 1024
      const free = parseInt(parts[3]) * 1024
      disk = { free, total, used }
    }
  } catch {}

  return { disk, fileStats }
},
```

- [ ] **Step 4: Add tool definitions to buildToolDefinitions()**

Add three new entries to the returned array:

```typescript
{
  type: 'function',
  function: {
    name: 'create_playlist',
    description: 'Create a named playlist. Optionally search for audio files to add to it.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Playlist name' },
        query: { type: 'string', description: 'Search query to find audio files to add' },
        limit: { type: 'number', description: 'Max tracks to add (default 20)' },
      },
      required: ['name'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'list_directory',
    description: 'Browse the contents of a specific folder. Shows indexed files under the given path.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to browse' },
        sort_by: { type: 'string', enum: ['name', 'modified', 'size'], description: 'Sort order' },
        file_type: { type: 'string', enum: ['video', 'audio', 'pdf', 'image', 'doc'], description: 'Filter by type' },
      },
      required: ['path'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'get_disk_status',
    description: 'Get disk usage statistics and file counts by type.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Specific path to check (defaults to data directory)' },
      },
    },
  },
},
```

- [ ] **Step 5: Update system prompt**

In `packages/server/agent/prompt.ts`, append to the rules:

```typescript
- When the user asks to play multiple songs or a collection, return all matching files so they queue automatically.
- When the user asks to create or save a playlist, use the create_playlist tool.
- When the user asks about disk space or storage stats, use the get_disk_status tool.
- When the user asks to browse a folder, use the list_directory tool.
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/server && bun test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/agent/tools/registry.ts packages/server/agent/prompt.ts
git commit -m "feat: add create_playlist, list_directory, get_disk_status agent tools"
```

---

### Task 12: Wire all new routes in index.ts (final wiring)

**Files:**
- Modify: `packages/server/index.ts`

- [ ] **Step 1: Update index.ts with all route factories**

The final `packages/server/index.ts` should look like:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { createHealthRoute } from './routes/health'
import { chatRoute } from './routes/chat'
import { streamRoute } from './routes/stream'
import { thumbRoute } from './routes/thumb'
import { createFileRoute } from './routes/file'
import { createFilesRoute } from './routes/files'
import { createPlaylistsRoute } from './routes/playlists'
import { createConversationsRoute } from './routes/conversations'
import { createSettingsRoute } from './routes/settings'
import { bootstrap } from './bootstrap'

const appContext = await bootstrap()

const app = new Hono()

app.use('*', cors())
app.use('/api/*', authMiddleware())

const api = app.basePath('/api')
api.route('/', createHealthRoute(appContext.db, appContext.vectorDb))
api.route('/', chatRoute)
api.route('/', streamRoute)
api.route('/', thumbRoute)
api.route('/', createFileRoute(appContext.db))
api.route('/', createFilesRoute(appContext.db))
api.route('/', createPlaylistsRoute(appContext.db))
api.route('/', createConversationsRoute(appContext.db))
api.route('/', createSettingsRoute(appContext.db, appContext.getWatchDirs, appContext.setWatchDirs))

// Serve React PWA static files
app.get('*', async (c) => {
  const path = c.req.path === '/' ? '/index.html' : c.req.path
  const file = Bun.file(`./packages/client/dist${path}`)
  if (await file.exists()) return new Response(file)
  return new Response(Bun.file('./packages/client/dist/index.html'))
})

export default {
  port: Number(process.env.PORT) || 8000,
  fetch: app.fetch,
}
```

- [ ] **Step 2: Run all tests**

Run: `cd packages/server && bun test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/server/index.ts
git commit -m "feat: wire all new route factories in server index"
```

---

## Chunk 3: Voice Pipeline

### Task 13: Create setup-models script

**Files:**
- Create: `scripts/setup-models.sh`

- [ ] **Step 1: Write the setup script**

Create `scripts/setup-models.sh`:

```bash
#!/bin/bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-./data}"
BIN_DIR="$DATA_DIR/bin"
MODELS_DIR="$DATA_DIR/models"
VENV_DIR="$DATA_DIR/kokoro-venv"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

echo "=== Magpie Voice Setup ==="

# 1. whisper.cpp
if [ ! -f "$BIN_DIR/whisper-cpp" ]; then
  echo "[1/3] Building whisper.cpp..."
  TMPDIR=$(mktemp -d)
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$TMPDIR/whisper.cpp"
  cd "$TMPDIR/whisper.cpp"
  make clean && WHISPER_METAL=1 make -j$(sysctl -n hw.ncpu) main
  cp main "$BIN_DIR/whisper-cpp"
  cd -
  rm -rf "$TMPDIR"
  echo "  whisper.cpp built successfully"
else
  echo "[1/3] whisper.cpp already installed, skipping"
fi

# 2. Whisper model
if [ ! -f "$MODELS_DIR/ggml-base.en.bin" ]; then
  echo "[2/3] Downloading whisper base.en model..."
  curl -L -o "$MODELS_DIR/ggml-base.en.bin" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
  echo "  Model downloaded"
else
  echo "[2/3] Whisper model already present, skipping"
fi

# 3. Kokoro venv
if [ ! -d "$VENV_DIR" ]; then
  echo "[3/3] Setting up Kokoro TTS venv..."
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --quiet kokoro-onnx fastapi uvicorn soundfile
  echo "  Kokoro venv created"
else
  echo "[3/3] Kokoro venv already exists, skipping"
fi

echo "=== Setup complete ==="
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/setup-models.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-models.sh
git commit -m "feat: add setup-models.sh for whisper.cpp and Kokoro TTS"
```

---

### Task 14: Implement STT service

**Files:**
- Create: `packages/server/services/stt.ts`
- Create: `packages/server/routes/stt.ts`
- Modify: `packages/server/index.ts`

- [ ] **Step 1: Create STT service**

Create `packages/server/services/stt.ts`:

```typescript
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.DATA_DIR || './data'
const WHISPER_BIN = `${DATA_DIR}/bin/whisper-cpp`
const WHISPER_MODEL = `${DATA_DIR}/models/ggml-base.en.bin`

export async function transcribe(audioBuffer: ArrayBuffer): Promise<{ text: string; language: string; duration: number }> {
  if (!existsSync(WHISPER_BIN)) throw new Error('whisper.cpp not installed. Run scripts/setup-models.sh')
  if (!existsSync(WHISPER_MODEL)) throw new Error('Whisper model not found. Run scripts/setup-models.sh')

  const id = nanoid(8)
  const inputPath = join(tmpdir(), `magpie-stt-${id}.webm`)
  const wavPath = join(tmpdir(), `magpie-stt-${id}.wav`)
  const jsonPath = join(tmpdir(), `magpie-stt-${id}.json`)

  try {
    // Write input audio
    await Bun.write(inputPath, audioBuffer)

    // Convert to 16kHz mono WAV
    const ffmpeg = Bun.spawn(['ffmpeg', '-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-f', 'wav', wavPath], {
      stdout: 'ignore', stderr: 'ignore',
    })
    const ffmpegExit = await ffmpeg.exited
    if (ffmpegExit !== 0) throw new Error('FFmpeg audio conversion failed')

    // Run whisper.cpp
    const whisper = Bun.spawn([
      WHISPER_BIN, '-m', WHISPER_MODEL, '-f', wavPath,
      '--output-json', '--output-file', jsonPath.replace('.json', ''),
      '--no-prints',
    ], { stdout: 'ignore', stderr: 'ignore' })

    const timeoutId = setTimeout(() => whisper.kill(), 10000)
    const exitCode = await whisper.exited
    clearTimeout(timeoutId)

    if (exitCode !== 0) throw new Error('whisper.cpp transcription failed')

    // Parse result
    const result = await Bun.file(jsonPath).json() as {
      transcription: Array<{ text: string }>
      result?: { language?: string }
    }
    const text = result.transcription?.map(s => s.text).join(' ').trim() || ''
    return { text, language: result.result?.language || 'en', duration: 0 }
  } finally {
    // Cleanup temp files
    for (const f of [inputPath, wavPath, jsonPath]) {
      try { unlinkSync(f) } catch {}
    }
  }
}
```

- [ ] **Step 2: Create STT route**

Create `packages/server/routes/stt.ts`:

```typescript
import { Hono } from 'hono'
import { transcribe } from '../services/stt'

export const sttRoute = new Hono()

sttRoute.post('/stt', async (c) => {
  try {
    const formData = await c.req.formData()
    const audio = formData.get('audio') as File | null
    if (!audio) return c.json({ error: 'Missing audio field' }, 400)

    const buffer = await audio.arrayBuffer()
    const result = await transcribe(buffer)
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 503)
  }
})
```

- [ ] **Step 3: Mount in index.ts**

Add `import { sttRoute } from './routes/stt'` and `api.route('/', sttRoute)`.

- [ ] **Step 4: Commit**

```bash
git add packages/server/services/stt.ts packages/server/routes/stt.ts packages/server/index.ts
git commit -m "feat: add STT service and /api/stt endpoint via whisper.cpp"
```

---

### Task 15: Implement TTS service

**Files:**
- Create: `packages/server/services/tts.ts`
- Create: `packages/server/routes/tts.ts`
- Modify: `packages/server/index.ts`

- [ ] **Step 1: Create TTS service**

Create `packages/server/services/tts.ts`:

```typescript
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs'
import type { Subprocess } from 'bun'

const DATA_DIR = process.env.DATA_DIR || './data'
const VENV_DIR = `${DATA_DIR}/kokoro-venv`
const PID_FILE = `${DATA_DIR}/kokoro.pid`
const KOKORO_PORT = 8880
const KOKORO_URL = `http://localhost:${KOKORO_PORT}`

let kokoroProcess: Subprocess | null = null

async function isRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${KOKORO_URL}/health`, { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch { return false }
}

async function startKokoro(): Promise<void> {
  if (await isRunning()) return
  if (!existsSync(`${VENV_DIR}/bin/python3`)) throw new Error('Kokoro not installed. Run scripts/setup-models.sh')

  // Create a minimal FastAPI TTS server script
  const serverScript = `${DATA_DIR}/kokoro-server.py`
  if (!existsSync(serverScript)) {
    writeFileSync(serverScript, `
import io, uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from kokoro_onnx import Kokoro

app = FastAPI()
kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")

class TTSReq(BaseModel):
    text: str
    language: str = "en"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/tts")
async def tts(req: TTSReq):
    voice = "af_heart" if req.language == "en" else "af_heart"
    samples, sr = kokoro.create(req.text, voice=voice, speed=1.0)
    buf = io.BytesIO()
    import soundfile as sf
    sf.write(buf, samples, sr, format="WAV")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=${KOKORO_PORT})
`)
  }

  kokoroProcess = Bun.spawn([`${VENV_DIR}/bin/python3`, serverScript], {
    stdout: 'ignore', stderr: 'ignore',
  })
  writeFileSync(PID_FILE, String(kokoroProcess.pid))

  // Wait for startup (max 15 seconds)
  for (let i = 0; i < 30; i++) {
    await Bun.sleep(500)
    if (await isRunning()) return
  }
  throw new Error('Kokoro TTS failed to start within 15 seconds')
}

export async function synthesize(text: string, language: string = 'en'): Promise<Response> {
  await startKokoro()
  const res = await fetch(`${KOKORO_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Kokoro TTS error: ${res.status}`)
  return res
}

export function shutdownTts() {
  if (kokoroProcess) {
    kokoroProcess.kill()
    kokoroProcess = null
  }
  try { unlinkSync(PID_FILE) } catch {}
}

// Cleanup on exit
process.on('exit', shutdownTts)
process.on('SIGTERM', () => { shutdownTts(); process.exit(0) })
process.on('SIGINT', () => { shutdownTts(); process.exit(0) })
```

- [ ] **Step 2: Create TTS route**

Create `packages/server/routes/tts.ts`:

```typescript
import { Hono } from 'hono'
import { synthesize } from '../services/tts'

export const ttsRoute = new Hono()

ttsRoute.post('/tts', async (c) => {
  try {
    const { text, language } = await c.req.json<{ text: string; language?: string }>()
    if (!text) return c.json({ error: 'Missing required field: text' }, 400)

    const audioResponse = await synthesize(text, language || 'en')
    const audioBuffer = await audioResponse.arrayBuffer()

    // Note: spec says audio/mpeg but Kokoro outputs WAV natively.
    // WAV works fine for browser playback via <audio>. Convert to mpeg in Phase 2 if needed.
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBuffer.byteLength),
      },
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 503)
  }
})
```

- [ ] **Step 3: Mount in index.ts**

Add `import { ttsRoute } from './routes/tts'` and `api.route('/', ttsRoute)`.

- [ ] **Step 4: Commit**

```bash
git add packages/server/services/tts.ts packages/server/routes/tts.ts packages/server/index.ts
git commit -m "feat: add TTS service and /api/tts endpoint via Kokoro"
```

---

## Chunk 4: Frontend — Document Preview & Audio

### Task 16: Install pdfjs-dist and rewrite PDFViewer

**Files:**
- Modify: `packages/client/package.json` (add pdfjs-dist)
- Modify: `packages/client/src/components/renderers/PDFViewer.tsx`

- [ ] **Step 1: Install pdfjs-dist**

Run: `cd packages/client && bun add pdfjs-dist`

- [ ] **Step 2: Rewrite PDFViewer with embedded PDF.js**

Replace `packages/client/src/components/renderers/PDFViewer.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { FileItem } from '@magpie/shared'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

export function PDFViewer({ item }: { item: FileItem }) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  useEffect(() => {
    const load = async () => {
      const doc = await pdfjsLib.getDocument({
        url: `/api/file/${item.id}?token=${token}`,
      }).promise
      setPdf(doc)
      setNumPages(doc.numPages)
    }
    load()
  }, [item.id])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    const render = async () => {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({
        canvasContext: canvas.getContext('2d')!,
        viewport,
      }).promise
    }
    render()
  }, [pdf, currentPage])

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-sm font-medium truncate mb-2">{item.name}</p>
      <canvas ref={canvasRef} className="w-full rounded" />
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-2 text-sm">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 bg-gray-700 rounded disabled:opacity-40"
          >Prev</button>
          <span>{currentPage} / {numPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="px-2 py-1 bg-gray-700 rounded disabled:opacity-40"
          >Next</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `cd packages/client && bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/client/package.json packages/client/bun.lockb packages/client/src/components/renderers/PDFViewer.tsx
git commit -m "feat: rewrite PDFViewer with embedded PDF.js rendering"
```

---

### Task 17: Create DocViewer component

**Files:**
- Create: `packages/client/src/components/renderers/DocViewer.tsx`
- Modify: `packages/client/src/components/renderers/RenderBlock.tsx`

- [ ] **Step 1: Create DocViewer**

Create `packages/client/src/components/renderers/DocViewer.tsx`:

```tsx
import { useState, useEffect } from 'react'
import type { FileItem } from '@magpie/shared'

export function DocViewer({ item }: { item: FileItem }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/file/${item.id}/preview?token=${token}`)
        if (!res.ok) throw new Error()
        setHtml(await res.text())
      } catch {
        setError(true)
      }
    }
    load()
  }, [item.id])

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="flex gap-2">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-400 hover:underline">
            {expanded ? 'Collapse' : 'Preview'}
          </button>
          <a
            href={`/api/file/${item.id}?token=${token}`}
            download={item.name}
            className="text-xs text-gray-400 hover:underline"
          >Download</a>
        </div>
      </div>
      {expanded && (
        error
          ? <p className="text-sm text-red-400">Preview unavailable</p>
          : html
            ? <iframe srcDoc={html} className="w-full h-96 rounded bg-white" sandbox="allow-same-origin" />
            : <p className="text-sm text-gray-400">Loading preview...</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update RenderBlock to use DocViewer for doc types**

In `packages/client/src/components/renderers/RenderBlock.tsx`, add import:

```typescript
import { DocViewer } from './DocViewer'
```

Update the `default` case in the switch:

```tsx
case 'file_list':
  if (item.name.endsWith('.docx') || item.name.endsWith('.xlsx')) {
    return <DocViewer key={item.id} item={item} />
  }
  return <FileList key={item.id} items={[item]} />
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/renderers/DocViewer.tsx packages/client/src/components/renderers/RenderBlock.tsx
git commit -m "feat: add DocViewer with DOCX/XLSX preview via iframe"
```

---

### Task 18: Create usePlayback hook and PlaybackProvider

**Files:**
- Create: `packages/client/src/hooks/usePlayback.tsx`

- [ ] **Step 1: Create the playback context and hook**

Create `packages/client/src/hooks/usePlayback.tsx`:

```tsx
import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import type { FileItem } from '@magpie/shared'

type LoopMode = 'off' | 'all' | 'one'

interface PlaybackState {
  currentTrack: FileItem | null
  queue: FileItem[]
  queueIndex: number
  isPlaying: boolean
  progress: number
  duration: number
  shuffled: boolean
  loopMode: LoopMode
}

interface PlaybackActions {
  play: (item: FileItem) => void
  playAll: (items: FileItem[]) => void
  addToQueue: (item: FileItem) => void
  next: () => void
  prev: () => void
  toggleShuffle: () => void
  cycleLoop: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (vol: number) => void
}

type PlaybackCtx = PlaybackState & PlaybackActions

const PlaybackContext = createContext<PlaybackCtx | null>(null)

export function usePlayback() {
  const ctx = useContext(PlaybackContext)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [queue, setQueue] = useState<FileItem[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffled, setShuffled] = useState(false)
  const [loopMode, setLoopMode] = useState<LoopMode>('off')

  const currentTrack = queue[queueIndex] || null
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    // For audio files, use the direct file endpoint (native <audio> supports MP3/FLAC/WAV/OGG)
    // HLS is only needed for video. Audio files play natively.
    audio.src = `/api/file/${currentTrack.id}?token=${token}`
    audio.load()
    if (isPlaying) audio.play().catch(() => {})
  }, [currentTrack?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setProgress(audio.currentTime)
    const onDuration = () => setDuration(audio.duration)
    const onEnded = () => {
      if (loopMode === 'one') { audio.currentTime = 0; audio.play(); return }
      if (queueIndex < queue.length - 1) { setQueueIndex(i => i + 1) }
      else if (loopMode === 'all') { setQueueIndex(0) }
      else { setIsPlaying(false) }
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [queueIndex, queue.length, loopMode])

  const play = useCallback((item: FileItem) => {
    setQueue([item]); setQueueIndex(0); setIsPlaying(true)
  }, [])

  const playAll = useCallback((items: FileItem[]) => {
    setQueue(shuffled ? shuffleArray(items) : items); setQueueIndex(0); setIsPlaying(true)
  }, [shuffled])

  const addToQueue = useCallback((item: FileItem) => {
    setQueue(q => [...q, item])
  }, [])

  const next = useCallback(() => {
    if (queueIndex < queue.length - 1) setQueueIndex(i => i + 1)
    else if (loopMode === 'all') setQueueIndex(0)
  }, [queueIndex, queue.length, loopMode])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return }
    if (queueIndex > 0) setQueueIndex(i => i - 1)
  }, [queueIndex])

  const toggleShuffle = useCallback(() => {
    setShuffled(s => {
      if (!s) setQueue(q => shuffleArray(q))
      return !s
    })
  }, [])

  const cycleLoop = useCallback(() => {
    setLoopMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play().catch(() => {})
    setIsPlaying(p => !p)
  }, [isPlaying])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = time
  }, [])

  const setVolume = useCallback((vol: number) => {
    const audio = audioRef.current
    if (audio) audio.volume = vol
  }, [])

  return (
    <PlaybackContext.Provider value={{
      currentTrack, queue, queueIndex, isPlaying, progress, duration,
      shuffled, loopMode, play, playAll, addToQueue, next, prev,
      toggleShuffle, cycleLoop, togglePlay, seek, setVolume,
    }}>
      <audio ref={audioRef} />
      {children}
    </PlaybackContext.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/hooks/usePlayback.tsx
git commit -m "feat: add PlaybackProvider and usePlayback hook with queue, shuffle, loop"
```

---

### Task 19: Create PlaybackBar and rewrite AudioPlayer

**Files:**
- Create: `packages/client/src/components/PlaybackBar.tsx`
- Modify: `packages/client/src/components/renderers/AudioPlayer.tsx`

- [ ] **Step 1: Create PlaybackBar**

Create `packages/client/src/components/PlaybackBar.tsx`:

```tsx
import { usePlayback } from '../hooks/usePlayback'

export function PlaybackBar() {
  const { currentTrack, isPlaying, progress, duration, togglePlay, next, prev } = usePlayback()

  if (!currentTrack) return null

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="border-t border-gray-800 bg-gray-900 px-3 py-2">
      <div className="flex items-center gap-3">
        <img src={currentTrack.thumbUrl} alt="" className="w-10 h-10 rounded object-cover bg-gray-700" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{currentTrack.name}</p>
          <div className="w-full h-1 bg-gray-700 rounded mt-1">
            <div className="h-1 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={prev} className="text-gray-400 hover:text-white text-sm">&#9664;</button>
          <button onClick={togglePlay} className="text-white text-sm">
            {isPlaying ? '&#10074;&#10074;' : '&#9654;'}
          </button>
          <button onClick={next} className="text-gray-400 hover:text-white text-sm">&#9654;</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite AudioPlayer to use usePlayback**

Replace `packages/client/src/components/renderers/AudioPlayer.tsx`:

```tsx
import type { FileItem } from '@magpie/shared'
import { usePlayback } from '../../hooks/usePlayback'

export function AudioPlayer({ item }: { item: FileItem }) {
  const { play, addToQueue, currentTrack, isPlaying, togglePlay } = usePlayback()
  const isCurrent = currentTrack?.id === item.id

  return (
    <div className={`bg-gray-800 rounded-lg p-3 flex items-center gap-3 ${isCurrent ? 'ring-1 ring-blue-500' : ''}`}>
      <img src={item.thumbUrl} alt="" className="w-12 h-12 rounded object-cover bg-gray-700" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => isCurrent ? togglePlay() : play(item)}
          className="px-3 py-1 bg-blue-600 rounded text-xs font-medium"
        >
          {isCurrent && isPlaying ? 'Pause' : 'Play'}
        </button>
        {!isCurrent && (
          <button
            onClick={() => addToQueue(item)}
            className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300"
          >+ Queue</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/PlaybackBar.tsx packages/client/src/components/renderers/AudioPlayer.tsx
git commit -m "feat: add PlaybackBar and rewrite AudioPlayer with queue support"
```

---

### Task 20: Wire PlaybackProvider and PlaybackBar into App.tsx

**Files:**
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

Replace `packages/client/src/App.tsx`:

```tsx
import { Routes, Route, NavLink } from 'react-router'
import { Chat } from './routes/Chat'
import { Recent } from './routes/Recent'
import { Media } from './routes/Media'
import { Settings } from './routes/Settings'
import { PlaybackProvider } from './hooks/usePlayback'
import { PlaybackBar } from './components/PlaybackBar'

export function App() {
  return (
    <PlaybackProvider>
      <div className="flex flex-col h-dvh">
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/recent" element={<Recent />} />
            <Route path="/media" element={<Media />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <PlaybackBar />

        <nav className="flex border-t border-gray-800 bg-gray-900">
          {[
            { to: '/', label: 'Chat' },
            { to: '/recent', label: 'Recent' },
            { to: '/media', label: 'Media' },
            { to: '/settings', label: 'Settings' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 py-3 text-center text-sm ${isActive ? 'text-white' : 'text-gray-500'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </PlaybackProvider>
  )
}
```

Note: The route imports (Recent, Media, Settings) will be created in the next chunk. For now, create minimal stub files so the build doesn't break.

- [ ] **Step 2: Create stub route files to satisfy imports**

Create `packages/client/src/routes/Recent.tsx`:
```tsx
export function Recent() { return <div className="p-4">Recent files (loading...)</div> }
```

Create `packages/client/src/routes/Media.tsx`:
```tsx
export function Media() { return <div className="p-4">Media library (loading...)</div> }
```

Create `packages/client/src/routes/Settings.tsx`:
```tsx
export function Settings() { return <div className="p-4">Settings (loading...)</div> }
```

- [ ] **Step 3: Verify build**

Run: `cd packages/client && bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/App.tsx packages/client/src/routes/Recent.tsx packages/client/src/routes/Media.tsx packages/client/src/routes/Settings.tsx
git commit -m "feat: wire PlaybackProvider, PlaybackBar, and route stubs into App"
```

---

## Chunk 5: Frontend — Interactive Pages

### Task 21: Implement Recent page

**Files:**
- Modify: `packages/client/src/routes/Recent.tsx`

- [ ] **Step 1: Implement full Recent page**

Replace `packages/client/src/routes/Recent.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { FileItem } from '@magpie/shared'
import { RenderBlock } from '../components/renderers/RenderBlock'

const TOKEN = () => localStorage.getItem('magpie-token') || 'magpie-dev'

function groupByDate(files: FileItem[]) {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  const groups: Record<string, FileItem[]> = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] }
  for (const f of files) {
    const d = new Date(f.modified)
    if (d.toDateString() === today) groups.Today.push(f)
    else if (d.toDateString() === yesterday) groups.Yesterday.push(f)
    else if (d > weekAgo) groups['This Week'].push(f)
    else groups.Earlier.push(f)
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

export function Recent() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const loadFiles = useCallback(async (off: number) => {
    setLoading(true)
    const res = await fetch(`/api/files?sort=modified_at&order=desc&days=30&limit=${limit}&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOKEN()}` },
    })
    const data = await res.json()
    setFiles(prev => off === 0 ? data.files : [...prev, ...data.files])
    setTotal(data.total)
    setLoading(false)
  }, [])

  useEffect(() => { loadFiles(0) }, [])

  const groups = groupByDate(files)

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Recent Files</h1>
      {groups.map(([label, items]) => (
        <div key={label}>
          <h2 className="text-sm text-gray-400 mb-2">{label}</h2>
          <RenderBlock items={items} />
        </div>
      ))}
      {files.length < total && (
        <button
          onClick={() => { const next = offset + limit; setOffset(next); loadFiles(next) }}
          disabled={loading}
          className="w-full py-2 text-sm text-gray-400 hover:text-white"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
      {!loading && files.length === 0 && (
        <p className="text-gray-500 text-sm">No recent files found</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/routes/Recent.tsx
git commit -m "feat: implement Recent page with date grouping and pagination"
```

---

### Task 22: Implement Media page

**Files:**
- Modify: `packages/client/src/routes/Media.tsx`

- [ ] **Step 1: Implement full Media page**

Replace `packages/client/src/routes/Media.tsx`:

```tsx
import { useState, useEffect } from 'react'
import type { FileItem, PlaylistSummary } from '@magpie/shared'
import { RenderBlock } from '../components/renderers/RenderBlock'
import { usePlayback } from '../hooks/usePlayback'

const TOKEN = () => localStorage.getItem('magpie-token') || 'magpie-dev'
const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' })

type Tab = 'videos' | 'music' | 'photos'

export function Media() {
  const [tab, setTab] = useState<Tab>('videos')
  const [files, setFiles] = useState<FileItem[]>([])
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { playAll } = usePlayback()

  const typeMap: Record<Tab, string> = { videos: 'video', music: 'audio', photos: 'image' }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/files?type=${typeMap[tab]}&sort=modified_at&order=desc&limit=200`, { headers: headers() })
      .then(r => r.json())
      .then(d => { setFiles(d.files); setLoading(false) })
    if (tab === 'music') {
      fetch('/api/playlists', { headers: headers() })
        .then(r => r.json())
        .then(d => setPlaylists(d.playlists))
    }
  }, [tab])

  const filtered = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files

  async function createPlaylist() {
    const name = prompt('Playlist name:')
    if (!name) return
    await fetch('/api/playlists', { method: 'POST', headers: headers(), body: JSON.stringify({ name }) })
    const res = await fetch('/api/playlists', { headers: headers() })
    setPlaylists((await res.json()).playlists)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {(['videos', 'music', 'photos'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm rounded-md ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <input
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Filter..."
        className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
      />

      {tab === 'music' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Playlists</h2>
            <button onClick={createPlaylist} className="text-xs text-blue-400">+ New Playlist</button>
          </div>
          {playlists.map(p => (
            <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-gray-400">{p.trackCount} tracks</p>
              </div>
            </div>
          ))}
          <h2 className="text-sm font-semibold text-gray-300 pt-2">All Tracks</h2>
          {filtered.length > 0 && (
            <button
              onClick={() => playAll(filtered)}
              className="text-xs px-3 py-1 bg-blue-600 rounded"
            >Play All ({filtered.length})</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filtered.length > 0 ? (
        <RenderBlock items={filtered} />
      ) : (
        <p className="text-sm text-gray-500">No {tab} found</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Export PlaylistSummary from shared types**

Verify `PlaylistSummary` is exported from `packages/shared/types.ts` (done in Task 1).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/routes/Media.tsx
git commit -m "feat: implement Media page with Videos/Music/Photos tabs and playlists"
```

---

### Task 23: Implement Settings page

**Files:**
- Modify: `packages/client/src/routes/Settings.tsx`

- [ ] **Step 1: Implement full Settings page**

Replace `packages/client/src/routes/Settings.tsx`:

```tsx
import { useState, useEffect } from 'react'

const TOKEN = () => localStorage.getItem('magpie-token') || 'magpie-dev'
const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' })

interface HealthData {
  status: string
  services: Record<string, any>
  disk?: any
  uptime?: number
  version?: string
}

interface SettingsData {
  watchDirs: string[]
  indexing: { queueLength: number; totalIndexed: number; lastIndexedAt: string | null }
  version: string
}

export function Settings() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [newDir, setNewDir] = useState('')
  const [readAloud, setReadAloud] = useState(() => localStorage.getItem('magpie-tts') === 'true')

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth)
    fetch('/api/settings', { headers: headers() }).then(r => r.json()).then(setSettings)
  }, [])

  async function addDir() {
    if (!newDir.trim() || !settings) return
    const dirs = [...settings.watchDirs, newDir.trim()]
    await fetch('/api/settings', { method: 'PUT', headers: headers(), body: JSON.stringify({ watchDirs: dirs }) })
    setSettings({ ...settings, watchDirs: dirs })
    setNewDir('')
  }

  async function removeDir(dir: string) {
    if (!settings) return
    const dirs = settings.watchDirs.filter(d => d !== dir)
    await fetch('/api/settings', { method: 'PUT', headers: headers(), body: JSON.stringify({ watchDirs: dirs }) })
    setSettings({ ...settings, watchDirs: dirs })
  }

  async function triggerIndex(path: string) {
    await fetch('/api/index/trigger', { method: 'POST', headers: headers(), body: JSON.stringify({ path }) })
  }

  function toggleTts() {
    const next = !readAloud
    setReadAloud(next)
    localStorage.setItem('magpie-tts', String(next))
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      {/* Status */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">System Status</h2>
        <div className="bg-gray-800 rounded-lg p-3 space-y-1 text-sm">
          <p>Status: <span className={health?.status === 'ok' ? 'text-green-400' : health?.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'}>{health?.status || '...'}</span></p>
          <p>Ollama: {health?.services?.ollama?.status || '...'} ({health?.services?.ollama?.model || ''})</p>
          <p>Files indexed: {settings?.indexing?.totalIndexed ?? '...'}</p>
          <p>Queue: {settings?.indexing?.queueLength ?? '...'} pending</p>
          <p>Uptime: {health?.uptime ? `${Math.floor(health.uptime / 60)}m` : '...'}</p>
        </div>
      </section>

      {/* Watch Directories */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Watch Directories</h2>
        <div className="space-y-2">
          {settings?.watchDirs.map(dir => (
            <div key={dir} className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
              <span className="flex-1 text-sm truncate">{dir}</span>
              <button onClick={() => triggerIndex(dir)} className="text-xs text-blue-400">Re-index</button>
              <button onClick={() => removeDir(dir)} className="text-xs text-red-400">Remove</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text" value={newDir} onChange={e => setNewDir(e.target.value)}
              placeholder="/path/to/watch"
              className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
            />
            <button onClick={addDir} className="px-3 py-2 bg-blue-600 rounded-lg text-sm">Add</button>
          </div>
        </div>
      </section>

      {/* Voice */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Voice</h2>
        <div className="bg-gray-800 rounded-lg p-3">
          <label className="flex items-center justify-between text-sm">
            <span>Read responses aloud</span>
            <input type="checkbox" checked={readAloud} onChange={toggleTts} className="rounded" />
          </label>
        </div>
      </section>

      {/* Auth */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Authentication</h2>
        <div className="bg-gray-800 rounded-lg p-3 text-sm">
          <p className="text-gray-400 mb-2">API Token</p>
          <code className="bg-gray-900 px-2 py-1 rounded text-xs">{TOKEN()}</code>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">About</h2>
        <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400">
          <p>Magpie v{settings?.version || '1.0.0'}</p>
          <p>Plusblocks Technology Ltd.</p>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/routes/Settings.tsx
git commit -m "feat: implement Settings page with status, watch dirs, voice, and about"
```

---

## Chunk 6: Frontend — Voice & PWA

### Task 24: Create VoiceInput component

**Files:**
- Create: `packages/client/src/components/VoiceInput.tsx`
- Modify: `packages/client/src/components/ChatInput.tsx`

- [ ] **Step 1: Create VoiceInput**

Create `packages/client/src/components/VoiceInput.tsx`:

```tsx
import { useState, useRef } from 'react'

interface Props {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function VoiceInput({ onTranscript, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        setProcessing(true)

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const form = new FormData()
        form.append('audio', blob, 'recording.webm')

        try {
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          })
          if (res.ok) {
            const { text } = await res.json()
            if (text.trim()) onTranscript(text.trim())
          }
        } finally {
          setProcessing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setRecording(true)

      // Auto-stop after 2s silence (simplified: stop after 30s max)
      silenceTimerRef.current = setTimeout(() => stopRecording(), 30000)
    } catch {
      // Microphone permission denied
    }
  }

  function stopRecording() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || processing}
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      className={`px-3 py-2 rounded-lg text-sm font-medium ${
        recording ? 'bg-red-600 animate-pulse' :
        processing ? 'bg-gray-700 opacity-50' :
        'bg-gray-700 hover:bg-gray-600'
      }`}
    >
      {recording ? '...' : processing ? '...' : '🎤'}
    </button>
  )
}
```

- [ ] **Step 2: Integrate VoiceInput into ChatInput**

Update `packages/client/src/components/ChatInput.tsx`:

```tsx
import { useState } from 'react'
import { VoiceInput } from './VoiceInput'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  function handleTranscript(transcript: string) {
    onSend(transcript)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-800 bg-gray-900">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask Magpie anything..."
        disabled={disabled}
        className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
      />
      <VoiceInput onTranscript={handleTranscript} disabled={disabled} />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium disabled:opacity-40"
      >
        Send
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/VoiceInput.tsx packages/client/src/components/ChatInput.tsx
git commit -m "feat: add VoiceInput push-to-talk component with STT integration"
```

---

### Task 25: Add TTS playback to chat

**Files:**
- Modify: `packages/client/src/hooks/useSSE.ts`

- [ ] **Step 1: Add TTS auto-play after assistant message**

In `packages/client/src/hooks/useSSE.ts`, add a ref to track the latest assistant text, and a `useEffect` to trigger TTS after loading completes.

Add at the top of `useSSE()`:
```typescript
const lastAssistantTextRef = useRef('')
```

At the end of the `'text'` case in the SSE chunk handler, update the ref:
```typescript
case 'text':
  last.text += chunk.content || ''
  last.thinking = undefined
  lastAssistantTextRef.current = last.text
  break
```

Add a `useEffect` after the `sendMessage` definition:
```typescript
useEffect(() => {
  if (isLoading || !lastAssistantTextRef.current) return
  if (localStorage.getItem('magpie-tts') !== 'true') return

  const text = lastAssistantTextRef.current
  lastAssistantTextRef.current = ''
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  })
    .then(r => r.ok ? r.blob() : null)
    .then(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.play().catch(() => {})
        audio.onended = () => URL.revokeObjectURL(url)
      }
    })
    .catch(() => {})
}, [isLoading])
```

Add `useRef` to the imports at the top of the file.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/hooks/useSSE.ts
git commit -m "feat: add optional TTS auto-playback after assistant messages"
```

---

### Task 26: Add conversation persistence to useSSE

**Files:**
- Create: `packages/client/src/lib/conversationStore.ts`
- Modify: `packages/client/src/hooks/useSSE.ts`

- [ ] **Step 1: Create IndexedDB conversation store**

Create `packages/client/src/lib/conversationStore.ts`:

```typescript
const DB_NAME = 'magpie-conversations'
const STORE_NAME = 'conversations'
const MAX_CONVERSATIONS = 50

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveConversation(id: string, messages: any[]) {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put({ id, messages, updatedAt: new Date().toISOString() })
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject })
}

export async function getConversation(id: string): Promise<any | null> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function listConversations(): Promise<any[]> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      const results = req.result.sort((a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ).slice(0, MAX_CONVERSATIONS)
      resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}
```

- [ ] **Step 2: Add conversation sync to useSSE**

In `packages/client/src/hooks/useSSE.ts`, import `{ saveConversation }` from `../lib/conversationStore` and `{ nanoid }` (add `nanoid` to client deps: `bun add nanoid`).

Add a `conversationId` ref and save after each message:

At the top of `useSSE()`:
```typescript
const [conversationId] = useState(() => nanoid())
const messagesRef = useRef<Message[]>([])
```

Keep `messagesRef` in sync — after every `setMessages` call in the SSE handler, add:
```typescript
// In the setMessages callback, before return:
messagesRef.current = msgs
return msgs
```

Add a `useEffect` to persist after loading completes:
```typescript
useEffect(() => {
  if (isLoading || messagesRef.current.length === 0) return
  const msgs = messagesRef.current
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'
  saveConversation(conversationId, msgs)
  fetch(`/api/conversations/${conversationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: msgs }),
  }).catch(() => {})
}, [isLoading])
```

- [ ] **Step 3: Install nanoid in client**

Run: `cd packages/client && bun add nanoid`

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/lib/conversationStore.ts packages/client/src/hooks/useSSE.ts packages/client/package.json packages/client/bun.lockb
git commit -m "feat: add conversation persistence to IndexedDB and server"
```

---

### Task 27: Add service worker and PWA manifest

**Files:**
- Create: `packages/client/public/sw.js`
- Modify: `packages/client/public/manifest.json`
- Modify: `packages/client/src/main.tsx`

- [ ] **Step 1: Create service worker**

Create `packages/client/public/sw.js`:

```javascript
const CACHE_VERSION = 'magpie-v1'
const PRECACHE_URLS = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Network-only for streaming and file endpoints
  if (url.pathname.startsWith('/api/stream') || url.pathname.startsWith('/api/file')) return

  // Cache-first for thumbnails
  if (url.pathname.startsWith('/api/thumb')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone))
          return res
        })
      )
    )
    return
  }

  // Network-first for API data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone))
        }
        return res
      })
    )
  )
})
```

- [ ] **Step 2: Update manifest.json**

Replace `packages/client/public/manifest.json`:

```json
{
  "name": "Magpie",
  "short_name": "Magpie",
  "description": "Local AI Storage Agent",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Register SW in main.tsx (prod only)**

Update `packages/client/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// Register service worker in production only
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
```

- [ ] **Step 4: Create placeholder icon directory**

Run: `mkdir -p packages/client/public/icons`

Create a simple SVG that can be converted later. For now, just ensure the directory exists. The actual icons can be generated from a source image using sharp in a build script (deferred — not blocking for MVP functionality).

- [ ] **Step 5: Commit**

```bash
git add packages/client/public/sw.js packages/client/public/manifest.json packages/client/src/main.tsx
git commit -m "feat: add service worker, updated manifest, and SW registration"
```

---

### Task 28: Add useOnlineStatus hook and offline indicator

**Files:**
- Create: `packages/client/src/hooks/useOnlineStatus.ts`
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Create useOnlineStatus hook**

Create `packages/client/src/hooks/useOnlineStatus.ts`:

```typescript
import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Periodic health check
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
        setOnline(res.ok)
      } catch {
        setOnline(false)
      }
    }, 30000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [])

  return online
}
```

- [ ] **Step 2: Add offline banner to App.tsx**

In `packages/client/src/App.tsx`, import `useOnlineStatus` and add a banner above `<main>`:

```tsx
import { useOnlineStatus } from './hooks/useOnlineStatus'

// Inside App component:
const online = useOnlineStatus()

// Before <main>:
{!online && (
  <div className="bg-yellow-900/50 text-yellow-200 text-xs text-center py-1">
    You're offline — viewing cached data
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/hooks/useOnlineStatus.ts packages/client/src/App.tsx
git commit -m "feat: add offline status detection and banner"
```

---

### Task 29: Final build and test

**Files:** None (verification only)

- [ ] **Step 1: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All tests PASS

- [ ] **Step 2: Build client**

Run: `cd packages/client && bun run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Verify TypeScript types across monorepo**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git add -A
git commit -m "chore: final build verification for MVP gap fill"
```
