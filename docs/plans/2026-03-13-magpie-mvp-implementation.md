# Magpie MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Magpie MVP — a local AI storage agent with chat-driven file search, media streaming, and document preview, running natively on macOS with Bun.

**Architecture:** Single Bun + Hono process serving both API and React PWA static files. SQLite for file metadata, LanceDB for vector search, Ollama (Docker) for LLM and embeddings. Indexer runs as a Bun worker thread. FFmpeg child processes handle HLS and thumbnails.

**Tech Stack:** Bun, Hono, TypeScript, React 19, Vite, TailwindCSS v4, better-sqlite3, @lancedb/lancedb, Ollama, chokidar, FFmpeg, sharp, pdf-parse, mammoth, xlsx

**Design Doc:** `docs/plans/2026-03-13-magpie-mvp-design.md`

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/types.ts`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `.gitignore`

**Step 1: Create workspace root**

```json
// package.json
{
  "name": "magpie",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "dev:server": "bun run --filter server dev",
    "dev:client": "bun run --filter client dev",
    "build": "bun run --filter client build"
  }
}
```

**Step 2: Create base tsconfig**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 3: Create shared package with types**

```json
// packages/shared/package.json
{
  "name": "@magpie/shared",
  "version": "0.1.0",
  "private": true,
  "main": "types.ts",
  "types": "types.ts"
}
```

```typescript
// packages/shared/types.ts
export type RenderType =
  | 'video_card'
  | 'audio_player'
  | 'pdf_preview'
  | 'image_grid'
  | 'file_list'

export type FileType = 'video' | 'audio' | 'pdf' | 'image' | 'doc'

export interface FileItem {
  id: string
  name: string
  type: FileType
  size: number
  modified: string
  renderType: RenderType
  streamUrl: string
  thumbUrl: string
}

export interface AgentChunk {
  type: 'thinking' | 'text' | 'render' | 'error'
  content?: string
  tool?: string
  items?: FileItem[]
  message?: string
}
```

**Step 4: Create server package skeleton**

```json
// packages/server/package.json
{
  "name": "@magpie/server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun run --hot index.ts"
  },
  "dependencies": {
    "@magpie/shared": "workspace:*",
    "hono": "^4"
  }
}
```

```json
// packages/server/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "types": ["bun-types"]
  },
  "include": ["./**/*.ts"],
  "exclude": ["dist"]
}
```

```typescript
// packages/server/index.ts
import { Hono } from 'hono'

const app = new Hono()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default {
  port: 8000,
  fetch: app.fetch,
}
```

**Step 5: Create client package skeleton**

```json
// packages/client/package.json
{
  "name": "@magpie/client",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4",
    "vite": "^6",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    "typescript": "^5"
  }
}
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
data/
.env
*.log
```

**Step 7: Install dependencies and verify**

Run: `bun install`
Expected: Successful install, lockfile created.

Run: `bun run dev:server &` then `curl http://localhost:8000/api/health`
Expected: `{"status":"ok"}`

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with server, client, shared packages"
```

---

## Task 2: SQLite Database Service

**Files:**
- Create: `packages/server/services/db.ts`
- Create: `packages/server/services/__tests__/db.test.ts`

**Step 1: Install dependencies**

Run: `cd packages/server && bun add better-sqlite3 nanoid && bun add -d @types/better-sqlite3`

**Step 2: Write the failing test**

```typescript
// packages/server/services/__tests__/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createDb, type MagpieDb } from '../db'
import { unlinkSync } from 'fs'

const TEST_DB = '/tmp/magpie-test.db'

describe('MagpieDb', () => {
  let db: MagpieDb

  beforeEach(() => {
    db = createDb(TEST_DB)
  })

  afterEach(() => {
    db.close()
    try { unlinkSync(TEST_DB) } catch {}
  })

  it('creates tables on init', () => {
    const tables = db.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)
    expect(names).toContain('files')
    expect(names).toContain('index_queue')
  })

  it('inserts and retrieves a file', () => {
    db.upsertFile({
      id: 'test-1',
      path: '/tmp/test.pdf',
      name: 'test.pdf',
      mime_type: 'application/pdf',
      size: 1024,
      modified_at: '2026-01-01T00:00:00Z',
      file_type: 'pdf',
      meta: '{}',
      hash: 'abc123',
    })
    const file = db.getFileById('test-1')
    expect(file).not.toBeNull()
    expect(file!.name).toBe('test.pdf')
  })

  it('retrieves a file by path', () => {
    db.upsertFile({
      id: 'test-2',
      path: '/tmp/test2.mp4',
      name: 'test2.mp4',
      mime_type: 'video/mp4',
      size: 999999,
      modified_at: '2026-01-01T00:00:00Z',
      file_type: 'video',
      meta: '{}',
      hash: 'def456',
    })
    const file = db.getFileByPath('/tmp/test2.mp4')
    expect(file).not.toBeNull()
    expect(file!.id).toBe('test-2')
  })

  it('lists recent files', () => {
    db.upsertFile({
      id: 'r1',
      path: '/tmp/r1.txt',
      name: 'r1.txt',
      mime_type: 'text/plain',
      size: 10,
      modified_at: '2026-03-10T00:00:00Z',
      file_type: 'doc',
      meta: '{}',
      hash: 'h1',
    })
    db.upsertFile({
      id: 'r2',
      path: '/tmp/r2.txt',
      name: 'r2.txt',
      mime_type: 'text/plain',
      size: 20,
      modified_at: '2026-03-12T00:00:00Z',
      file_type: 'doc',
      meta: '{}',
      hash: 'h2',
    })
    const recent = db.listRecent({ limit: 10 })
    expect(recent.length).toBe(2)
    expect(recent[0].id).toBe('r2') // more recent first
  })

  it('enqueues and dequeues index jobs', () => {
    db.enqueue('/tmp/new.pdf', 'created')
    const jobs = db.dequeuePending(5)
    expect(jobs.length).toBe(1)
    expect(jobs[0].file_path).toBe('/tmp/new.pdf')
    expect(jobs[0].status).toBe('processing')
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/db.test.ts`
Expected: FAIL — module `../db` not found.

**Step 4: Implement the database service**

```typescript
// packages/server/services/db.ts
import Database from 'better-sqlite3'

export interface FileRecord {
  id: string
  path: string
  name: string
  mime_type: string
  size: number
  modified_at: string
  indexed_at?: string
  file_type: string
  meta: string
  hash: string
}

interface QueueItem {
  id: number
  file_path: string
  event_type: string
  queued_at: string
  status: string
}

export interface MagpieDb {
  db: Database.Database
  upsertFile(file: FileRecord): void
  getFileById(id: string): FileRecord | null
  getFileByPath(path: string): FileRecord | null
  listRecent(opts: { limit?: number; file_type?: string; days?: number }): FileRecord[]
  deleteFileByPath(path: string): void
  enqueue(filePath: string, eventType: string): void
  dequeuePending(batchSize: number): QueueItem[]
  markQueueDone(id: number): void
  markQueueError(id: number): void
  close(): void
}

export function createDb(dbPath: string): MagpieDb {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id          TEXT PRIMARY KEY,
      path        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      size        INTEGER NOT NULL,
      modified_at TEXT NOT NULL,
      indexed_at  TEXT DEFAULT (datetime('now')),
      file_type   TEXT NOT NULL,
      meta        TEXT DEFAULT '{}',
      hash        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
    CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_at);
    CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type);

    CREATE TABLE IF NOT EXISTS index_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path   TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      queued_at   TEXT DEFAULT (datetime('now')),
      status      TEXT DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON index_queue(status);
  `)

  const stmts = {
    upsert: db.prepare(`
      INSERT INTO files (id, path, name, mime_type, size, modified_at, file_type, meta, hash)
      VALUES (@id, @path, @name, @mime_type, @size, @modified_at, @file_type, @meta, @hash)
      ON CONFLICT(path) DO UPDATE SET
        name=@name, mime_type=@mime_type, size=@size, modified_at=@modified_at,
        indexed_at=datetime('now'), file_type=@file_type, meta=@meta, hash=@hash
    `),
    getById: db.prepare('SELECT * FROM files WHERE id = ?'),
    getByPath: db.prepare('SELECT * FROM files WHERE path = ?'),
    deleteByPath: db.prepare('DELETE FROM files WHERE path = ?'),
    enqueue: db.prepare(
      'INSERT INTO index_queue (file_path, event_type) VALUES (?, ?)'
    ),
    dequeuePending: db.prepare(
      'SELECT * FROM index_queue WHERE status = ? ORDER BY id LIMIT ?'
    ),
    markStatus: db.prepare(
      'UPDATE index_queue SET status = ? WHERE id = ?'
    ),
  }

  return {
    db,

    upsertFile(file: FileRecord) {
      stmts.upsert.run(file)
    },

    getFileById(id: string) {
      return (stmts.getById.get(id) as FileRecord) ?? null
    },

    getFileByPath(path: string) {
      return (stmts.getByPath.get(path) as FileRecord) ?? null
    },

    listRecent({ limit = 20, file_type, days }) {
      let sql = 'SELECT * FROM files'
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
      if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ')
      }
      sql += ' ORDER BY modified_at DESC LIMIT ?'
      params.push(limit)

      return db.prepare(sql).all(...params) as FileRecord[]
    },

    deleteFileByPath(path: string) {
      stmts.deleteByPath.run(path)
    },

    enqueue(filePath: string, eventType: string) {
      stmts.enqueue.run(filePath, eventType)
    },

    dequeuePending(batchSize: number) {
      const items = stmts.dequeuePending.all('pending', batchSize) as QueueItem[]
      for (const item of items) {
        stmts.markStatus.run('processing', item.id)
      }
      return items.map((i) => ({ ...i, status: 'processing' }))
    },

    markQueueDone(id: number) {
      stmts.markStatus.run('done', id)
    },

    markQueueError(id: number) {
      stmts.markStatus.run('error', id)
    },

    close() {
      db.close()
    },
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/db.test.ts`
Expected: All 5 tests PASS.

**Step 6: Commit**

```bash
git add packages/server/services/db.ts packages/server/services/__tests__/db.test.ts packages/server/package.json
git commit -m "feat: add SQLite database service with file tracking and index queue"
```

---

## Task 3: LanceDB Vector Search Service

**Files:**
- Create: `packages/server/services/lancedb.ts`
- Create: `packages/server/services/embeddings.ts`
- Create: `packages/server/services/__tests__/lancedb.test.ts`

**Step 1: Install dependencies**

Run: `cd packages/server && bun add @lancedb/lancedb ollama`

**Step 2: Write the failing test**

```typescript
// packages/server/services/__tests__/lancedb.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createVectorDb, type VectorDb } from '../lancedb'
import { rmSync } from 'fs'

const TEST_DIR = '/tmp/magpie-lance-test'

describe('VectorDb', () => {
  let vdb: VectorDb

  beforeEach(async () => {
    vdb = await createVectorDb(TEST_DIR)
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }) } catch {}
  })

  it('adds chunks and searches by vector', async () => {
    // Use a fake 768-dim vector
    const fakeVector = new Array(768).fill(0).map((_, i) => i / 768)

    await vdb.addChunks([
      {
        id: 'chunk-1',
        file_id: 'file-1',
        text: 'contract agreement for 2025',
        vector: fakeVector,
        file_name: 'contract.pdf',
        file_type: 'pdf',
        file_path: '/docs/contract.pdf',
      },
    ])

    const results = await vdb.search(fakeVector, 5)
    expect(results.length).toBe(1)
    expect(results[0].file_id).toBe('file-1')
  })

  it('deletes chunks by file_id', async () => {
    const fakeVector = new Array(768).fill(0.5)

    await vdb.addChunks([
      {
        id: 'c1',
        file_id: 'f1',
        text: 'hello',
        vector: fakeVector,
        file_name: 'a.txt',
        file_type: 'doc',
        file_path: '/a.txt',
      },
      {
        id: 'c2',
        file_id: 'f2',
        text: 'world',
        vector: fakeVector,
        file_name: 'b.txt',
        file_type: 'doc',
        file_path: '/b.txt',
      },
    ])

    await vdb.deleteByFileId('f1')
    const results = await vdb.search(fakeVector, 10)
    expect(results.every((r) => r.file_id !== 'f1')).toBe(true)
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/lancedb.test.ts`
Expected: FAIL — module `../lancedb` not found.

**Step 4: Implement embeddings service**

```typescript
// packages/server/services/embeddings.ts
import { Ollama } from 'ollama'

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
})

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'

export async function embed(texts: string[]): Promise<number[][]> {
  const response = await ollama.embed({ model: EMBED_MODEL, input: texts })
  return response.embeddings
}

export async function embedSingle(text: string): Promise<number[]> {
  const [vector] = await embed([text])
  return vector
}
```

**Step 5: Implement LanceDB service**

```typescript
// packages/server/services/lancedb.ts
import * as lancedb from '@lancedb/lancedb'

export interface ChunkRecord {
  id: string
  file_id: string
  text: string
  vector: number[]
  file_name: string
  file_type: string
  file_path: string
}

export interface SearchResult {
  id: string
  file_id: string
  text: string
  file_name: string
  file_type: string
  file_path: string
  _distance: number
}

export interface VectorDb {
  addChunks(chunks: ChunkRecord[]): Promise<void>
  search(queryVector: number[], limit: number): Promise<SearchResult[]>
  deleteByFileId(fileId: string): Promise<void>
}

export async function createVectorDb(dbPath: string): Promise<VectorDb> {
  const db = await lancedb.connect(dbPath)

  async function getOrCreateTable() {
    const tableNames = await db.tableNames()
    if (tableNames.includes('file_chunks')) {
      return db.openTable('file_chunks')
    }
    return null
  }

  return {
    async addChunks(chunks: ChunkRecord[]) {
      const tableNames = await db.tableNames()
      if (tableNames.includes('file_chunks')) {
        const table = await db.openTable('file_chunks')
        await table.add(chunks)
      } else {
        await db.createTable('file_chunks', chunks)
      }
    },

    async search(queryVector: number[], limit: number) {
      const table = await getOrCreateTable()
      if (!table) return []

      const results = await table
        .vectorSearch(queryVector)
        .limit(limit)
        .toArray()

      return results.map((r) => ({
        id: r.id as string,
        file_id: r.file_id as string,
        text: r.text as string,
        file_name: r.file_name as string,
        file_type: r.file_type as string,
        file_path: r.file_path as string,
        _distance: r._distance as number,
      }))
    },

    async deleteByFileId(fileId: string) {
      const table = await getOrCreateTable()
      if (!table) return
      await table.delete(`file_id = '${fileId}'`)
    },
  }
}
```

**Step 6: Run tests to verify they pass**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/lancedb.test.ts`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add packages/server/services/lancedb.ts packages/server/services/embeddings.ts packages/server/services/__tests__/lancedb.test.ts
git commit -m "feat: add LanceDB vector search and Ollama embeddings services"
```

---

## Task 4: Document Text Extraction Service

**Files:**
- Create: `packages/server/services/extractor.ts`
- Create: `packages/server/services/__tests__/extractor.test.ts`

**Step 1: Install dependencies**

Run: `cd packages/server && bun add pdf-parse mammoth xlsx music-metadata`

**Step 2: Write the failing test**

```typescript
// packages/server/services/__tests__/extractor.test.ts
import { describe, it, expect } from 'bun:test'
import { extractText, detectFileType } from '../extractor'
import { writeFileSync, unlinkSync } from 'fs'

describe('detectFileType', () => {
  it('detects PDF', () => {
    expect(detectFileType('report.pdf', 'application/pdf')).toBe('pdf')
  })

  it('detects video', () => {
    expect(detectFileType('movie.mp4', 'video/mp4')).toBe('video')
  })

  it('detects audio', () => {
    expect(detectFileType('song.mp3', 'audio/mpeg')).toBe('audio')
  })

  it('detects image', () => {
    expect(detectFileType('photo.jpg', 'image/jpeg')).toBe('image')
  })

  it('detects doc', () => {
    expect(detectFileType('readme.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc')
  })
})

describe('extractText', () => {
  it('extracts text from a plain text file', async () => {
    const tmpPath = '/tmp/magpie-test-extract.txt'
    writeFileSync(tmpPath, 'Hello Magpie world')
    try {
      const text = await extractText(tmpPath, 'text/plain', 'doc')
      expect(text).toContain('Hello Magpie world')
    } finally {
      unlinkSync(tmpPath)
    }
  })

  it('returns empty string for video files', async () => {
    const text = await extractText('/tmp/nonexistent.mp4', 'video/mp4', 'video')
    expect(text).toBe('')
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/extractor.test.ts`
Expected: FAIL — module not found.

**Step 4: Implement extractor**

```typescript
// packages/server/services/extractor.ts
import { readFile } from 'fs/promises'
import type { FileType } from '@magpie/shared'

const MIME_MAP: Record<string, FileType> = {
  'application/pdf': 'pdf',
  'video/mp4': 'video',
  'video/x-matroska': 'video',
  'video/avi': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/gif': 'image',
}

const EXT_MAP: Record<string, FileType> = {
  '.pdf': 'pdf',
  '.mp4': 'video', '.mkv': 'video', '.avi': 'video', '.mov': 'video', '.webm': 'video',
  '.mp3': 'audio', '.flac': 'audio', '.aac': 'audio', '.wav': 'audio', '.ogg': 'audio',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.heic': 'image', '.gif': 'image',
  '.docx': 'doc', '.xlsx': 'doc', '.pptx': 'doc', '.txt': 'doc', '.md': 'doc', '.csv': 'doc',
}

export function detectFileType(filename: string, mimeType: string): FileType {
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType]
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return EXT_MAP[ext] || 'doc'
}

export async function extractText(
  filePath: string,
  mimeType: string,
  fileType: FileType
): Promise<string> {
  // Media files — no text extraction, metadata only
  if (fileType === 'video' || fileType === 'audio' || fileType === 'image') {
    return ''
  }

  try {
    if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default
      const buffer = await readFile(filePath)
      const data = await pdfParse(buffer)
      return data.text
    }

    if (mimeType.includes('wordprocessingml') || filePath.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value
    }

    if (mimeType.includes('spreadsheetml') || filePath.endsWith('.xlsx')) {
      const XLSX = await import('xlsx')
      const workbook = XLSX.readFile(filePath)
      const texts: string[] = []
      for (const name of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
        texts.push(`Sheet: ${name}\n${csv}`)
      }
      return texts.join('\n\n')
    }

    // Fallback: read as plain text
    if (mimeType.startsWith('text/') || ['.txt', '.md', '.csv'].some((e) => filePath.endsWith(e))) {
      const content = await readFile(filePath, 'utf-8')
      return content
    }

    return ''
  } catch {
    return ''
  }
}

export function chunkText(text: string, metadata: string, chunkSize = 800): string[] {
  if (!text.trim()) return []

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const chunk = text.slice(start, end)
    chunks.push(`${metadata}\n\n${chunk}`)
    start = end
  }

  return chunks
}
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/extractor.test.ts`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add packages/server/services/extractor.ts packages/server/services/__tests__/extractor.test.ts
git commit -m "feat: add document text extraction and file type detection"
```

---

## Task 5: File Watcher Service

**Files:**
- Create: `packages/server/services/watcher.ts`
- Create: `packages/server/services/__tests__/watcher.test.ts`

**Step 1: Install dependencies**

Run: `cd packages/server && bun add chokidar`

**Step 2: Write the failing test**

```typescript
// packages/server/services/__tests__/watcher.test.ts
import { describe, it, expect, afterEach } from 'bun:test'
import { createWatcher } from '../watcher'
import { mkdirSync, writeFileSync, rmSync } from 'fs'

const TEST_DIR = '/tmp/magpie-watcher-test'

describe('Watcher', () => {
  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }) } catch {}
  })

  it('detects new files', async () => {
    mkdirSync(TEST_DIR, { recursive: true })

    const events: { path: string; event: string }[] = []
    const watcher = createWatcher([TEST_DIR], (path, event) => {
      events.push({ path, event })
    })

    // Wait for watcher to be ready
    await new Promise((r) => setTimeout(r, 500))

    writeFileSync(`${TEST_DIR}/test.txt`, 'hello')

    // Wait for debounce + detection
    await new Promise((r) => setTimeout(r, 2000))

    watcher.close()

    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events.some((e) => e.path.includes('test.txt'))).toBe(true)
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/watcher.test.ts`
Expected: FAIL — module not found.

**Step 4: Implement watcher**

```typescript
// packages/server/services/watcher.ts
import chokidar from 'chokidar'

type WatchCallback = (filePath: string, eventType: 'created' | 'modified' | 'deleted') => void

export function createWatcher(
  directories: string[],
  onEvent: WatchCallback,
  debounceMs = 1000
) {
  const timers = new Map<string, Timer>()

  const watcher = chokidar.watch(directories, {
    ignored: /(^|[\/\\])\.|node_modules|\.DS_Store/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: debounceMs,
      pollInterval: 100,
    },
  })

  function debounced(filePath: string, eventType: 'created' | 'modified' | 'deleted') {
    const existing = timers.get(filePath)
    if (existing) clearTimeout(existing)

    timers.set(
      filePath,
      setTimeout(() => {
        timers.delete(filePath)
        onEvent(filePath, eventType)
      }, debounceMs)
    )
  }

  watcher
    .on('add', (path) => debounced(path, 'created'))
    .on('change', (path) => debounced(path, 'modified'))
    .on('unlink', (path) => debounced(path, 'deleted'))

  return {
    close() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      return watcher.close()
    },
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/watcher.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/server/services/watcher.ts packages/server/services/__tests__/watcher.test.ts
git commit -m "feat: add chokidar-based file watcher with debounce"
```

---

## Task 6: Thumbnail Generation Service

**Files:**
- Create: `packages/server/services/thumbnail.ts`
- Create: `packages/server/services/__tests__/thumbnail.test.ts`

**Step 1: Install dependencies**

Run: `cd packages/server && bun add sharp`

**Step 2: Write the failing test**

```typescript
// packages/server/services/__tests__/thumbnail.test.ts
import { describe, it, expect, afterEach } from 'bun:test'
import { generateImageThumb } from '../thumbnail'
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import sharp from 'sharp'

const THUMB_DIR = '/tmp/magpie-thumb-test'

describe('Thumbnail', () => {
  afterEach(() => {
    try {
      const { rmSync } = require('fs')
      rmSync(THUMB_DIR, { recursive: true })
    } catch {}
  })

  it('generates a webp thumbnail from an image', async () => {
    mkdirSync(THUMB_DIR, { recursive: true })

    // Create a test image
    const testImg = `${THUMB_DIR}/source.png`
    await sharp({ create: { width: 1000, height: 1000, channels: 3, background: 'red' } })
      .png()
      .toFile(testImg)

    const outPath = `${THUMB_DIR}/thumb.webp`
    await generateImageThumb(testImg, outPath)

    expect(existsSync(outPath)).toBe(true)

    const meta = await sharp(outPath).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(320)
  })
})
```

**Step 3: Run test to verify it fails**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/thumbnail.test.ts`
Expected: FAIL — module not found.

**Step 4: Implement thumbnail service**

```typescript
// packages/server/services/thumbnail.ts
import sharp from 'sharp'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const execAsync = promisify(exec)

function ensureDir(filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export async function generateImageThumb(
  inputPath: string,
  outputPath: string,
  width = 320
): Promise<void> {
  ensureDir(outputPath)
  await sharp(inputPath).resize(width).webp({ quality: 80 }).toFile(outputPath)
}

export async function generateVideoThumb(
  inputPath: string,
  outputPath: string,
  width = 320,
  seekSeconds = 10
): Promise<void> {
  ensureDir(outputPath)
  await execAsync(
    `ffmpeg -y -ss ${seekSeconds} -i "${inputPath}" -frames:v 1 -vf "scale=${width}:-1" "${outputPath}"`
  )
}

export async function generateThumb(
  inputPath: string,
  outputPath: string,
  fileType: string
): Promise<void> {
  switch (fileType) {
    case 'image':
      return generateImageThumb(inputPath, outputPath)
    case 'video':
      return generateVideoThumb(inputPath, outputPath)
    case 'audio':
      // Try to extract album art via music-metadata, fallback: no thumb
      try {
        const mm = await import('music-metadata')
        const metadata = await mm.parseFile(inputPath)
        const pic = metadata.common.picture?.[0]
        if (pic) {
          await sharp(pic.data).resize(320).webp({ quality: 80 }).toFile(outputPath)
        }
      } catch {}
      return
    default:
      // For PDF/docs, skip for now (can add pdf.js server render later)
      return
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/thumbnail.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/server/services/thumbnail.ts packages/server/services/__tests__/thumbnail.test.ts
git commit -m "feat: add thumbnail generation service (image, video, audio)"
```

---

## Task 7: HLS Streaming Service

**Files:**
- Create: `packages/server/services/hls.ts`
- Create: `packages/server/services/__tests__/hls.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/services/__tests__/hls.test.ts
import { describe, it, expect } from 'bun:test'
import { buildFfmpegArgs, getHlsCachePath } from '../hls'

describe('HLS', () => {
  it('builds transmux args for mp4', () => {
    const args = buildFfmpegArgs('/media/movie.mp4', '/cache/abc')
    expect(args).toContain('-c')
    expect(args).toContain('copy')
    expect(args).toContain('-hls_time')
  })

  it('builds transcode args for avi', () => {
    const args = buildFfmpegArgs('/media/movie.avi', '/cache/abc')
    expect(args).toContain('libx264')
  })

  it('returns correct cache path', () => {
    const path = getHlsCachePath('file-123', '/data')
    expect(path).toBe('/data/hls-cache/file-123')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/hls.test.ts`
Expected: FAIL.

**Step 3: Implement HLS service**

```typescript
// packages/server/services/hls.ts
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

const TRANSMUX_EXTENSIONS = new Set(['.mp4', '.mkv', '.mov', '.webm'])

export function getHlsCachePath(fileId: string, dataDir: string): string {
  return join(dataDir, 'hls-cache', fileId)
}

export function buildFfmpegArgs(inputPath: string, outputDir: string): string[] {
  const ext = '.' + inputPath.split('.').pop()?.toLowerCase()
  const playlistPath = join(outputDir, 'playlist.m3u8')
  const segmentPath = join(outputDir, 'seg_%03d.ts')

  const baseArgs = ['-y', '-i', inputPath]

  if (TRANSMUX_EXTENSIONS.has(ext)) {
    // Transmux: copy codecs, near-instant
    return [
      ...baseArgs,
      '-c', 'copy',
      '-hls_time', '10',
      '-hls_list_size', '0',
      '-hls_segment_filename', segmentPath,
      playlistPath,
    ]
  }

  // Transcode: re-encode
  return [
    ...baseArgs,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-c:a', 'aac',
    '-hls_time', '10',
    '-hls_list_size', '0',
    '-hls_segment_filename', segmentPath,
    playlistPath,
  ]
}

export async function ensureHls(
  fileId: string,
  inputPath: string,
  dataDir: string
): Promise<string> {
  const cacheDir = getHlsCachePath(fileId, dataDir)
  const playlistPath = join(cacheDir, 'playlist.m3u8')

  if (existsSync(playlistPath)) {
    return playlistPath
  }

  mkdirSync(cacheDir, { recursive: true })
  const args = buildFfmpegArgs(inputPath, cacheDir)
  await execAsync(`ffmpeg ${args.map((a) => `"${a}"`).join(' ')}`)
  return playlistPath
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/chester/Magpie && bun test packages/server/services/__tests__/hls.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/services/hls.ts packages/server/services/__tests__/hls.test.ts
git commit -m "feat: add HLS streaming service with transmux/transcode support"
```

---

## Task 8: Agent ReAct Loop & Tool Registry

**Files:**
- Create: `packages/server/agent/prompt.ts`
- Create: `packages/server/agent/loop.ts`
- Create: `packages/server/agent/tools/registry.ts`
- Create: `packages/server/agent/__tests__/loop.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/agent/__tests__/loop.test.ts
import { describe, it, expect } from 'bun:test'
import { buildToolDefinitions, executeTool } from '../tools/registry'

describe('Tool Registry', () => {
  it('has all MVP tools registered', () => {
    const tools = buildToolDefinitions()
    const names = tools.map((t: any) => t.function.name)
    expect(names).toContain('search_files')
    expect(names).toContain('play_media')
    expect(names).toContain('open_document')
    expect(names).toContain('list_recent')
    expect(names).toContain('get_file_info')
  })

  it('returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent', {})
    expect(result.error).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/chester/Magpie && bun test packages/server/agent/__tests__/loop.test.ts`
Expected: FAIL.

**Step 3: Implement system prompt**

```typescript
// packages/server/agent/prompt.ts
export const SYSTEM_PROMPT = `You are Magpie, a local AI storage assistant running on the user's personal device. You help users find, play, and manage their files stored locally.

Rules:
- Always use the provided tools to fulfill requests. Never guess file locations or names.
- Respond concisely and helpfully.
- Match the user's language (if they write in Chinese, respond in Chinese).
- When search results are returned, summarize what was found.
- If no results are found, suggest alternative search terms.`
```

**Step 4: Implement tool registry**

```typescript
// packages/server/agent/tools/registry.ts
import type { MagpieDb } from '../../services/db'
import type { VectorDb } from '../../services/lancedb'
import type { FileItem, FileType, RenderType } from '@magpie/shared'

interface ToolContext {
  db: MagpieDb
  vectorDb: VectorDb
  embedQuery: (text: string) => Promise<number[]>
  dataDir: string
}

let ctx: ToolContext

export function initToolContext(context: ToolContext) {
  ctx = context
}

function fileTypeToRenderType(type: FileType): RenderType {
  const map: Record<FileType, RenderType> = {
    video: 'video_card',
    audio: 'audio_player',
    pdf: 'pdf_preview',
    image: 'image_grid',
    doc: 'file_list',
  }
  return map[type] || 'file_list'
}

function toFileItem(record: any): FileItem {
  return {
    id: record.id,
    name: record.name || record.file_name,
    type: record.file_type as FileType,
    size: record.size || 0,
    modified: record.modified_at || record.modified || '',
    renderType: fileTypeToRenderType(record.file_type as FileType),
    streamUrl: `/api/stream/${record.id}`,
    thumbUrl: `/api/thumb/${record.id}`,
  }
}

const toolImplementations: Record<string, (args: any) => Promise<any>> = {
  async search_files(args: { query: string; file_type?: string; days_ago?: number; limit?: number }) {
    const vector = await ctx.embedQuery(args.query)
    const results = await ctx.vectorDb.search(vector, args.limit || 10)

    // Filter by file_type if specified
    let filtered = results
    if (args.file_type) {
      filtered = results.filter((r) => r.file_type === args.file_type)
    }

    // Deduplicate by file_id
    const seen = new Set<string>()
    const unique = filtered.filter((r) => {
      if (seen.has(r.file_id)) return false
      seen.add(r.file_id)
      return true
    })

    // Enrich from SQLite
    const files = unique
      .map((r) => ctx.db.getFileById(r.file_id))
      .filter(Boolean)
      .map(toFileItem)

    return { files }
  },

  async play_media(args: { file_id: string }) {
    const file = ctx.db.getFileById(args.file_id)
    if (!file) return { error: 'File not found' }

    return {
      files: [toFileItem(file)],
    }
  },

  async open_document(args: { file_id: string }) {
    const file = ctx.db.getFileById(args.file_id)
    if (!file) return { error: 'File not found' }

    return {
      files: [toFileItem(file)],
    }
  },

  async list_recent(args: { days?: number; file_type?: string; limit?: number }) {
    const records = ctx.db.listRecent({
      days: args.days || 7,
      file_type: args.file_type,
      limit: args.limit || 20,
    })
    return { files: records.map(toFileItem) }
  },

  async get_file_info(args: { file_id: string }) {
    const file = ctx.db.getFileById(args.file_id)
    if (!file) return { error: 'File not found' }

    return {
      files: [toFileItem(file)],
      metadata: JSON.parse(file.meta),
    }
  },
}

export function buildToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'search_files',
        description: 'Search for files using natural language. Uses semantic vector search across all indexed files.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural language search query' },
            file_type: { type: 'string', enum: ['video', 'audio', 'pdf', 'image', 'doc'], description: 'Filter by file type' },
            days_ago: { type: 'number', description: 'Only search files modified within this many days' },
            limit: { type: 'number', description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'play_media',
        description: 'Play a video or audio file. Returns streaming URL for playback.',
        parameters: {
          type: 'object',
          properties: {
            file_id: { type: 'string', description: 'The file ID to play' },
          },
          required: ['file_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_document',
        description: 'Open a document (PDF, DOCX, etc.) for preview.',
        parameters: {
          type: 'object',
          properties: {
            file_id: { type: 'string', description: 'The file ID to open' },
          },
          required: ['file_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_recent',
        description: 'List recently added or modified files.',
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Number of days to look back (default 7)' },
            file_type: { type: 'string', enum: ['video', 'audio', 'pdf', 'image', 'doc'], description: 'Filter by type' },
            limit: { type: 'number', description: 'Max results (default 20)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_file_info',
        description: 'Get detailed information and metadata about a specific file.',
        parameters: {
          type: 'object',
          properties: {
            file_id: { type: 'string', description: 'The file ID' },
          },
          required: ['file_id'],
        },
      },
    },
  ]
}

export async function executeTool(name: string, args: any): Promise<any> {
  const fn = toolImplementations[name]
  if (!fn) return { error: `Unknown tool: ${name}` }
  return fn(args)
}
```

**Step 5: Implement the ReAct loop**

```typescript
// packages/server/agent/loop.ts
import { Ollama } from 'ollama'
import { SYSTEM_PROMPT } from './prompt'
import { buildToolDefinitions, executeTool } from './tools/registry'
import type { AgentChunk } from '@magpie/shared'

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
})
const MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b'
const MAX_ITERATIONS = 5

export async function* runAgent(userMessage: string): AsyncGenerator<AgentChunk> {
  const tools = buildToolDefinitions()
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await ollama.chat({
      model: MODEL,
      messages,
      tools,
      stream: false,
    })

    if (response.message.tool_calls?.length) {
      for (const toolCall of response.message.tool_calls) {
        yield { type: 'thinking', tool: toolCall.function.name }

        const result = await executeTool(
          toolCall.function.name,
          toolCall.function.arguments
        )

        messages.push(response.message)
        messages.push({ role: 'tool', content: JSON.stringify(result) })

        if (result.files?.length) {
          yield { type: 'render', items: result.files }
        }
      }
      continue
    }

    // Final response — stream it
    const finalStream = await ollama.chat({
      model: MODEL,
      messages,
      stream: true,
    })

    for await (const chunk of finalStream) {
      if (chunk.message.content) {
        yield { type: 'text', content: chunk.message.content }
      }
    }
    break
  }
}
```

**Step 6: Run tests to verify they pass**

Run: `cd /home/chester/Magpie && bun test packages/server/agent/__tests__/loop.test.ts`
Expected: PASS.

**Step 7: Commit**

```bash
git add packages/server/agent/
git commit -m "feat: add Agent ReAct loop, tool registry, and system prompt"
```

---

## Task 9: API Routes (Hono)

**Files:**
- Create: `packages/server/middleware/auth.ts`
- Create: `packages/server/routes/chat.ts`
- Create: `packages/server/routes/stream.ts`
- Create: `packages/server/routes/thumb.ts`
- Create: `packages/server/routes/file.ts`
- Create: `packages/server/routes/health.ts`
- Modify: `packages/server/index.ts`

**Step 1: Implement auth middleware**

```typescript
// packages/server/middleware/auth.ts
import type { MiddlewareHandler } from 'hono'

export function authMiddleware(): MiddlewareHandler {
  const token = process.env.API_SECRET || 'magpie-dev'

  return async (c, next) => {
    // Skip auth for health check
    if (c.req.path === '/api/health') return next()

    const auth = c.req.header('Authorization')
    if (auth === `Bearer ${token}`) return next()

    // Also accept token as query param (for HLS player URLs)
    const queryToken = c.req.query('token')
    if (queryToken === token) return next()

    return c.json({ error: 'Unauthorized' }, 401)
  }
}
```

**Step 2: Implement route files**

```typescript
// packages/server/routes/health.ts
import { Hono } from 'hono'

export const healthRoute = new Hono()

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    services: {
      api: true,
      // TODO: check Ollama, LanceDB, disk space
    },
  })
})
```

```typescript
// packages/server/routes/chat.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { runAgent } from '../agent/loop'

export const chatRoute = new Hono()

chatRoute.post('/chat', async (c) => {
  const { message } = await c.req.json<{ message: string }>()

  if (!message?.trim()) {
    return c.json({ error: 'Message is required' }, 400)
  }

  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of runAgent(message)) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
          event: 'chunk',
        })
      }
    } catch (err: any) {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', message: err.message }),
        event: 'chunk',
      })
    }
  })
})
```

```typescript
// packages/server/routes/stream.ts
import { Hono } from 'hono'
import { createReadStream, existsSync, statSync } from 'fs'
import { join } from 'path'

export const streamRoute = new Hono()

const DATA_DIR = process.env.DATA_DIR || './data'

// Serve HLS playlist
streamRoute.get('/stream/:id/playlist.m3u8', async (c) => {
  const { id } = c.req.param()
  const playlistPath = join(DATA_DIR, 'hls-cache', id, 'playlist.m3u8')

  if (!existsSync(playlistPath)) {
    return c.json({ error: 'Playlist not found' }, 404)
  }

  const content = await Bun.file(playlistPath).text()
  return c.text(content, 200, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-cache',
  })
})

// Serve HLS segments
streamRoute.get('/stream/:id/:segment', async (c) => {
  const { id, segment } = c.req.param()
  const segPath = join(DATA_DIR, 'hls-cache', id, segment)

  if (!existsSync(segPath)) {
    return c.json({ error: 'Segment not found' }, 404)
  }

  const file = Bun.file(segPath)
  return new Response(file, {
    headers: {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'max-age=86400',
    },
  })
})
```

```typescript
// packages/server/routes/thumb.ts
import { Hono } from 'hono'
import { existsSync } from 'fs'
import { join } from 'path'

export const thumbRoute = new Hono()

const DATA_DIR = process.env.DATA_DIR || './data'

thumbRoute.get('/thumb/:id', async (c) => {
  const { id } = c.req.param()
  const thumbPath = join(DATA_DIR, 'thumbs', `${id}.webp`)

  if (!existsSync(thumbPath)) {
    return c.json({ error: 'Thumbnail not found' }, 404)
  }

  const file = Bun.file(thumbPath)
  return new Response(file, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'max-age=86400',
    },
  })
})
```

```typescript
// packages/server/routes/file.ts
import { Hono } from 'hono'
import { existsSync } from 'fs'

export const fileRoute = new Hono()

// Serves the original file for download or preview
fileRoute.get('/file/:id', async (c) => {
  // TODO: look up file path from SQLite by id, serve the file
  const { id } = c.req.param()
  return c.json({ error: 'Not yet implemented', id }, 501)
})
```

**Step 3: Wire up index.ts**

```typescript
// packages/server/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { healthRoute } from './routes/health'
import { chatRoute } from './routes/chat'
import { streamRoute } from './routes/stream'
import { thumbRoute } from './routes/thumb'
import { fileRoute } from './routes/file'

const app = new Hono()

app.use('*', cors())
app.use('/api/*', authMiddleware())

const api = app.basePath('/api')
api.route('/', healthRoute)
api.route('/', chatRoute)
api.route('/', streamRoute)
api.route('/', thumbRoute)
api.route('/', fileRoute)

// Serve React PWA static files (after build)
app.get('*', async (c) => {
  const path = c.req.path === '/' ? '/index.html' : c.req.path
  const file = Bun.file(`./packages/client/dist${path}`)
  if (await file.exists()) {
    return new Response(file)
  }
  // SPA fallback
  return new Response(Bun.file('./packages/client/dist/index.html'))
})

export default {
  port: Number(process.env.PORT) || 8000,
  fetch: app.fetch,
}
```

**Step 4: Verify server starts**

Run: `cd /home/chester/Magpie && bun run packages/server/index.ts &` then `curl http://localhost:8000/api/health`
Expected: `{"status":"ok","services":{"api":true}}`

**Step 5: Commit**

```bash
git add packages/server/middleware/ packages/server/routes/ packages/server/index.ts
git commit -m "feat: add API routes (chat, stream, thumb, file, health) with auth middleware"
```

---

## Task 10: React PWA — Project Setup & Layout

**Files:**
- Create: `packages/client/index.html`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`
- Create: `packages/client/src/index.css`
- Create: `packages/client/public/manifest.json`
- Create: `packages/client/tsconfig.json`

**Step 1: Install client dependencies**

Run: `cd packages/client && bun add react react-dom react-router && bun add -d @vitejs/plugin-react vite tailwindcss @tailwindcss/vite typescript @types/react @types/react-dom`

**Step 2: Create vite config**

```typescript
// packages/client/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

**Step 3: Create index.html**

```html
<!-- packages/client/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#111827" />
    <link rel="manifest" href="/manifest.json" />
    <title>Magpie</title>
  </head>
  <body class="bg-gray-950 text-gray-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 4: Create CSS entry**

```css
/* packages/client/src/index.css */
@import "tailwindcss";
```

**Step 5: Create main.tsx and App.tsx**

```tsx
// packages/client/src/main.tsx
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
```

```tsx
// packages/client/src/App.tsx
import { Routes, Route, NavLink } from 'react-router'

function Chat() {
  return <div className="p-4">Chat (coming next)</div>
}
function Recent() {
  return <div className="p-4">Recent files</div>
}
function Media() {
  return <div className="p-4">Media library</div>
}
function Settings() {
  return <div className="p-4">Settings</div>
}

export function App() {
  return (
    <div className="flex flex-col h-dvh">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/recent" element={<Recent />} />
          <Route path="/media" element={<Media />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <nav className="flex border-t border-gray-800 bg-gray-900 safe-bottom">
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
  )
}
```

**Step 6: Create PWA manifest**

```json
// packages/client/public/manifest.json
{
  "name": "Magpie",
  "short_name": "Magpie",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827",
  "icons": []
}
```

**Step 7: Create tsconfig**

```json
// packages/client/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["DOM", "DOM.Iterable", "ESNext"]
  },
  "include": ["src"],
  "exclude": ["dist"]
}
```

**Step 8: Verify client starts**

Run: `cd /home/chester/Magpie && bun run dev:client`
Expected: Vite dev server starts on port 3000, shows Magpie app with tab navigation.

**Step 9: Commit**

```bash
git add packages/client/
git commit -m "feat: scaffold React PWA with routing and bottom tab navigation"
```

---

## Task 11: Chat UI — useSSE Hook + Chat Interface

**Files:**
- Create: `packages/client/src/hooks/useSSE.ts`
- Create: `packages/client/src/routes/Chat.tsx`
- Create: `packages/client/src/components/ChatInput.tsx`
- Create: `packages/client/src/components/MessageList.tsx`
- Create: `packages/client/src/components/ThinkingIndicator.tsx`

**Step 1: Implement useSSE hook**

```typescript
// packages/client/src/hooks/useSSE.ts
import { useState, useCallback } from 'react'
import type { AgentChunk, FileItem } from '@magpie/shared'

interface Message {
  role: 'user' | 'assistant'
  text: string
  items?: FileItem[]
  thinking?: string
}

export function useSSE() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }])
    setIsLoading(true)

    const assistantMsg: Message = { role: 'assistant', text: '', items: [] }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const token = localStorage.getItem('magpie-token') || 'magpie-dev'
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (!data) continue

          try {
            const chunk: AgentChunk = JSON.parse(data)

            setMessages((prev) => {
              const msgs = [...prev]
              const last = { ...msgs[msgs.length - 1] }

              switch (chunk.type) {
                case 'thinking':
                  last.thinking = chunk.tool
                  break
                case 'text':
                  last.text += chunk.content || ''
                  last.thinking = undefined
                  break
                case 'render':
                  last.items = [...(last.items || []), ...(chunk.items || [])]
                  last.thinking = undefined
                  break
                case 'error':
                  last.text += `\n\nError: ${chunk.message}`
                  break
              }

              msgs[msgs.length - 1] = last
              return msgs
            })
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          text: `Error: ${err.message}`,
        }
        return msgs
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { messages, isLoading, sendMessage }
}
```

**Step 2: Implement components**

```tsx
// packages/client/src/components/ChatInput.tsx
import { useState } from 'react'

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

```tsx
// packages/client/src/components/ThinkingIndicator.tsx
export function ThinkingIndicator({ tool }: { tool: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
      <span className="animate-pulse">Calling {tool}...</span>
    </div>
  )
}
```

```tsx
// packages/client/src/components/MessageList.tsx
import type { FileItem } from '@magpie/shared'
import { ThinkingIndicator } from './ThinkingIndicator'

interface Message {
  role: 'user' | 'assistant'
  text: string
  items?: FileItem[]
  thinking?: string
}

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`max-w-[85%] ${msg.role === 'user' ? 'self-end bg-blue-600 rounded-2xl rounded-br-sm px-4 py-2' : ''}`}
        >
          {msg.role === 'user' ? (
            <p className="text-sm">{msg.text}</p>
          ) : (
            <div className="space-y-2">
              {msg.thinking && <ThinkingIndicator tool={msg.thinking} />}
              {msg.items && msg.items.length > 0 && (
                <div className="space-y-2">
                  {msg.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-gray-800 rounded-lg p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.type} &middot; {formatSize(item.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {msg.text && <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.text}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
```

**Step 3: Implement Chat route**

```tsx
// packages/client/src/routes/Chat.tsx
import { useRef, useEffect } from 'react'
import { useSSE } from '../hooks/useSSE'
import { ChatInput } from '../components/ChatInput'
import { MessageList } from '../components/MessageList'

export function Chat() {
  const { messages, isLoading, sendMessage } = useSSE()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-lg">Ask Magpie to find your files</p>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
```

**Step 4: Update App.tsx to use Chat component**

Replace the inline `Chat` function in `App.tsx` with:

```tsx
import { Chat } from './routes/Chat'
```

And update the route: `<Route path="/" element={<Chat />} />`

**Step 5: Verify the chat UI renders**

Run: `cd /home/chester/Magpie && bun run dev:client`
Expected: Chat page shows with input field, empty state message, bottom nav.

**Step 6: Commit**

```bash
git add packages/client/src/
git commit -m "feat: add chat UI with SSE streaming, message list, and input"
```

---

## Task 12: Render Components (VideoCard, AudioPlayer, PDFViewer, ImageGrid, FileList)

**Files:**
- Create: `packages/client/src/components/renderers/RenderBlock.tsx`
- Create: `packages/client/src/components/renderers/VideoCard.tsx`
- Create: `packages/client/src/components/renderers/AudioPlayer.tsx`
- Create: `packages/client/src/components/renderers/PDFViewer.tsx`
- Create: `packages/client/src/components/renderers/ImageGrid.tsx`
- Create: `packages/client/src/components/renderers/FileList.tsx`

**Step 1: Install HLS.js**

Run: `cd packages/client && bun add hls.js`

**Step 2: Implement render components**

```tsx
// packages/client/src/components/renderers/VideoCard.tsx
import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'
import type { FileItem } from '@magpie/shared'

export function VideoCard({ item }: { item: FileItem }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  function handlePlay() {
    const video = videoRef.current!
    if (!playing) {
      if (Hls.isSupported()) {
        const hls = new Hls()
        hls.loadSource(item.streamUrl + '/playlist.m3u8')
        hls.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = item.streamUrl + '/playlist.m3u8'
      }
      video.play()
      setPlaying(true)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {!playing ? (
        <button onClick={handlePlay} className="w-full text-left p-3 flex items-center gap-3">
          <img src={item.thumbUrl} alt="" className="w-24 h-16 object-cover rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
          </div>
          <span className="text-2xl">&#9654;</span>
        </button>
      ) : (
        <video ref={videoRef} controls className="w-full" />
      )}
    </div>
  )
}
```

```tsx
// packages/client/src/components/renderers/AudioPlayer.tsx
import type { FileItem } from '@magpie/shared'

export function AudioPlayer({ item }: { item: FileItem }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
      <img src={item.thumbUrl} alt="" className="w-12 h-12 rounded object-cover bg-gray-700" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <audio controls src={item.streamUrl} className="w-full mt-1 h-8" />
      </div>
    </div>
  )
}
```

```tsx
// packages/client/src/components/renderers/PDFViewer.tsx
import type { FileItem } from '@magpie/shared'

export function PDFViewer({ item }: { item: FileItem }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-sm font-medium truncate mb-2">{item.name}</p>
      <a
        href={`/api/file/${item.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-400 hover:underline"
      >
        Open PDF
      </a>
    </div>
  )
}
```

```tsx
// packages/client/src/components/renderers/ImageGrid.tsx
import type { FileItem } from '@magpie/shared'

export function ImageGrid({ items }: { items: FileItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
      {items.map((item) => (
        <img
          key={item.id}
          src={item.thumbUrl}
          alt={item.name}
          className="w-full aspect-square object-cover cursor-pointer"
        />
      ))}
    </div>
  )
}
```

```tsx
// packages/client/src/components/renderers/FileList.tsx
import type { FileItem } from '@magpie/shared'

export function FileList({ items }: { items: FileItem[] }) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-gray-400">
              {item.type} &middot; {formatSize(item.size)} &middot; {item.modified}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
```

```tsx
// packages/client/src/components/renderers/RenderBlock.tsx
import type { FileItem } from '@magpie/shared'
import { VideoCard } from './VideoCard'
import { AudioPlayer } from './AudioPlayer'
import { PDFViewer } from './PDFViewer'
import { ImageGrid } from './ImageGrid'
import { FileList } from './FileList'

export function RenderBlock({ items }: { items: FileItem[] }) {
  // Group images together, render others individually
  const images = items.filter((i) => i.renderType === 'image_grid')
  const others = items.filter((i) => i.renderType !== 'image_grid')

  return (
    <div className="space-y-2">
      {others.map((item) => {
        switch (item.renderType) {
          case 'video_card':
            return <VideoCard key={item.id} item={item} />
          case 'audio_player':
            return <AudioPlayer key={item.id} item={item} />
          case 'pdf_preview':
            return <PDFViewer key={item.id} item={item} />
          default:
            return <FileList key={item.id} items={[item]} />
        }
      })}
      {images.length > 0 && <ImageGrid items={images} />}
    </div>
  )
}
```

**Step 3: Update MessageList to use RenderBlock**

Replace the inline item rendering in `MessageList.tsx` with:

```tsx
import { RenderBlock } from './renderers/RenderBlock'

// Replace the items rendering block with:
{msg.items && msg.items.length > 0 && <RenderBlock items={msg.items} />}
```

**Step 4: Verify renderers display correctly**

Run: `cd /home/chester/Magpie && bun run dev:client`
Expected: Chat UI renders. Components ready for when agent returns results.

**Step 5: Commit**

```bash
git add packages/client/src/components/renderers/ packages/client/src/components/MessageList.tsx
git commit -m "feat: add dynamic render components (VideoCard, AudioPlayer, PDFViewer, ImageGrid, FileList)"
```

---

## Task 13: Docker Compose for Ollama

**Files:**
- Create: `docker/compose.yml`
- Create: `.env.example`

**Step 1: Create Docker Compose**

```yaml
# docker/compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: magpie-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped

volumes:
  ollama-data:
```

**Step 2: Create .env.example**

```bash
# .env.example
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_EMBED_MODEL=nomic-embed-text
DATA_DIR=./data
API_SECRET=magpie-dev
PORT=8000
```

**Step 3: Start Ollama and pull models**

Run: `cd /home/chester/Magpie && docker compose -f docker/compose.yml up -d`
Run: `docker exec magpie-ollama ollama pull qwen3:8b`
Run: `docker exec magpie-ollama ollama pull nomic-embed-text`

**Step 4: Verify Ollama responds**

Run: `curl http://localhost:11434/api/tags`
Expected: JSON with model list including qwen3:8b and nomic-embed-text.

**Step 5: Commit**

```bash
git add docker/ .env.example
git commit -m "feat: add Docker Compose for Ollama and .env.example"
```

---

## Task 14: Server Bootstrap — Wire Everything Together

**Files:**
- Modify: `packages/server/index.ts`
- Create: `packages/server/bootstrap.ts`

**Step 1: Create bootstrap module**

```typescript
// packages/server/bootstrap.ts
import { createDb, type MagpieDb } from './services/db'
import { createVectorDb, type VectorDb } from './services/lancedb'
import { embedSingle } from './services/embeddings'
import { initToolContext } from './agent/tools/registry'
import { createWatcher } from './services/watcher'
import { existsSync, mkdirSync } from 'fs'

const DATA_DIR = process.env.DATA_DIR || './data'
const SQLITE_PATH = `${DATA_DIR}/sqlite/magpie.db`
const LANCEDB_PATH = `${DATA_DIR}/lancedb`
const WATCH_DIRS = (process.env.WATCH_DIRS || '').split(',').filter(Boolean)

export interface AppContext {
  db: MagpieDb
  vectorDb: VectorDb
}

export async function bootstrap(): Promise<AppContext> {
  // Ensure data directories exist
  for (const dir of ['sqlite', 'lancedb', 'thumbs', 'hls-cache']) {
    const path = `${DATA_DIR}/${dir}`
    if (!existsSync(path)) mkdirSync(path, { recursive: true })
  }

  const db = createDb(SQLITE_PATH)
  const vectorDb = await createVectorDb(LANCEDB_PATH)

  // Init tool context
  initToolContext({
    db,
    vectorDb,
    embedQuery: embedSingle,
    dataDir: DATA_DIR,
  })

  // Start file watcher if directories configured
  if (WATCH_DIRS.length > 0) {
    createWatcher(WATCH_DIRS, (filePath, eventType) => {
      console.log(`[watcher] ${eventType}: ${filePath}`)
      if (eventType === 'deleted') {
        db.deleteFileByPath(filePath)
      } else {
        db.enqueue(filePath, eventType)
      }
    })
    console.log(`[watcher] Watching: ${WATCH_DIRS.join(', ')}`)
  }

  console.log('[magpie] Server bootstrapped')
  return { db, vectorDb }
}
```

**Step 2: Update index.ts to call bootstrap**

Add at the top of `packages/server/index.ts`, before the route setup:

```typescript
import { bootstrap } from './bootstrap'

await bootstrap()
```

**Step 3: Verify full server starts**

Run: `cd /home/chester/Magpie && DATA_DIR=./data bun run packages/server/index.ts`
Expected: `[magpie] Server bootstrapped` printed, server listening on port 8000.

**Step 4: Commit**

```bash
git add packages/server/bootstrap.ts packages/server/index.ts
git commit -m "feat: add server bootstrap wiring DB, LanceDB, tools, and file watcher"
```

---

## Task 15: Indexer Worker Thread

**Files:**
- Create: `packages/server/workers/indexer.worker.ts`
- Create: `packages/server/services/indexer.ts`

**Step 1: Implement indexer service (coordinator)**

```typescript
// packages/server/services/indexer.ts
import { createDb, type MagpieDb } from './db'
import { createVectorDb, type VectorDb } from './lancedb'
import { embed } from './embeddings'
import { extractText, chunkText, detectFileType } from './extractor'
import { generateThumb } from './thumbnail'
import { nanoid } from 'nanoid'
import { statSync } from 'fs'
import { basename } from 'path'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

const DATA_DIR = process.env.DATA_DIR || './data'

export async function processFile(
  filePath: string,
  db: MagpieDb,
  vectorDb: VectorDb
): Promise<void> {
  const stat = statSync(filePath)
  const name = basename(filePath)

  // Quick hash of first 64KB for change detection
  const buf = await readFile(filePath)
  const hash = createHash('md5').update(buf.subarray(0, 65536)).digest('hex')

  // Check if already indexed with same hash
  const existing = db.getFileByPath(filePath)
  if (existing && existing.hash === hash) return

  const fileId = existing?.id || nanoid()
  const mime = detectMime(name)
  const fileType = detectFileType(name, mime)

  // Extract text
  const text = await extractText(filePath, mime, fileType)

  // Upsert file record
  db.upsertFile({
    id: fileId,
    path: filePath,
    name,
    mime_type: mime,
    size: stat.size,
    modified_at: stat.mtime.toISOString(),
    file_type: fileType,
    meta: '{}',
    hash,
  })

  // Generate thumbnail
  try {
    await generateThumb(filePath, `${DATA_DIR}/thumbs/${fileId}.webp`, fileType)
  } catch {}

  // Chunk and embed text content
  if (text.trim()) {
    const metadata = `File: ${name} | Type: ${fileType} | Path: ${filePath}`
    const chunks = chunkText(text, metadata)

    if (chunks.length > 0) {
      // Delete old chunks
      await vectorDb.deleteByFileId(fileId)

      // Embed in batches of 10
      for (let i = 0; i < chunks.length; i += 10) {
        const batch = chunks.slice(i, i + 10)
        const vectors = await embed(batch)

        const records = batch.map((chunkText, j) => ({
          id: `${fileId}_${i + j}`,
          file_id: fileId,
          text: chunkText,
          vector: vectors[j],
          file_name: name,
          file_type: fileType,
          file_path: filePath,
        }))

        await vectorDb.addChunks(records)
      }
    }
  }
}

function detectMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    mp4: 'video/mp4', mkv: 'video/x-matroska', avi: 'video/avi', mov: 'video/quicktime', webm: 'video/webm',
    mp3: 'audio/mpeg', flac: 'audio/flac', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', gif: 'image/gif',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv',
  }
  return map[ext] || 'application/octet-stream'
}
```

**Step 2: Implement worker thread**

```typescript
// packages/server/workers/indexer.worker.ts
import { createDb } from '../services/db'
import { createVectorDb } from '../services/lancedb'
import { processFile } from '../services/indexer'

const DATA_DIR = process.env.DATA_DIR || './data'
const POLL_INTERVAL = 5000 // 5 seconds
const BATCH_SIZE = 10

async function main() {
  const db = createDb(`${DATA_DIR}/sqlite/magpie.db`)
  const vectorDb = await createVectorDb(`${DATA_DIR}/lancedb`)

  console.log('[indexer] Worker started')

  while (true) {
    const jobs = db.dequeuePending(BATCH_SIZE)

    for (const job of jobs) {
      try {
        console.log(`[indexer] Processing: ${job.file_path}`)
        await processFile(job.file_path, db, vectorDb)
        db.markQueueDone(job.id)
      } catch (err: any) {
        console.error(`[indexer] Error: ${job.file_path}: ${err.message}`)
        db.markQueueError(job.id)
      }
    }

    await Bun.sleep(POLL_INTERVAL)
  }
}

main()
```

**Step 3: Verify indexer processes a test file**

Run: `mkdir -p ./data/sqlite ./data/lancedb && echo "test content" > /tmp/magpie-index-test.txt`

Manual test: Insert a queue item, run the worker, check SQLite.

**Step 4: Commit**

```bash
git add packages/server/services/indexer.ts packages/server/workers/indexer.worker.ts
git commit -m "feat: add file indexer service and worker thread"
```

---

## Task 16: End-to-End Integration Test

**Files:**
- Create: `packages/server/__tests__/e2e.test.ts`

**Step 1: Write integration test**

```typescript
// packages/server/__tests__/e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { createDb } from '../services/db'
import { createVectorDb } from '../services/lancedb'
import { initToolContext } from '../agent/tools/registry'
import { executeTool } from '../agent/tools/registry'
import { rmSync, mkdirSync } from 'fs'

const TEST_DIR = '/tmp/magpie-e2e'

describe('E2E: Tool execution', () => {
  beforeAll(async () => {
    mkdirSync(`${TEST_DIR}/sqlite`, { recursive: true })
    mkdirSync(`${TEST_DIR}/lancedb`, { recursive: true })

    const db = createDb(`${TEST_DIR}/sqlite/test.db`)
    const vectorDb = await createVectorDb(`${TEST_DIR}/lancedb`)

    // Seed test data
    db.upsertFile({
      id: 'e2e-1',
      path: '/media/test-movie.mp4',
      name: 'test-movie.mp4',
      mime_type: 'video/mp4',
      size: 1_000_000,
      modified_at: new Date().toISOString(),
      file_type: 'video',
      meta: '{}',
      hash: 'test-hash',
    })

    const fakeEmbed = async (text: string) => new Array(768).fill(0.1)

    initToolContext({ db, vectorDb, embedQuery: fakeEmbed, dataDir: TEST_DIR })
  })

  afterAll(() => {
    try { rmSync(TEST_DIR, { recursive: true }) } catch {}
  })

  it('list_recent returns seeded files', async () => {
    const result = await executeTool('list_recent', { days: 30 })
    expect(result.files.length).toBe(1)
    expect(result.files[0].name).toBe('test-movie.mp4')
    expect(result.files[0].renderType).toBe('video_card')
  })

  it('get_file_info returns file details', async () => {
    const result = await executeTool('get_file_info', { file_id: 'e2e-1' })
    expect(result.files[0].id).toBe('e2e-1')
  })

  it('play_media returns stream URL', async () => {
    const result = await executeTool('play_media', { file_id: 'e2e-1' })
    expect(result.files[0].streamUrl).toContain('/api/stream/e2e-1')
  })

  it('returns error for unknown file', async () => {
    const result = await executeTool('get_file_info', { file_id: 'nonexistent' })
    expect(result.error).toBeDefined()
  })
})
```

**Step 2: Run tests**

Run: `cd /home/chester/Magpie && bun test packages/server/__tests__/e2e.test.ts`
Expected: All 4 tests PASS.

**Step 3: Run full test suite**

Run: `cd /home/chester/Magpie && bun test`
Expected: All tests pass across all test files.

**Step 4: Commit**

```bash
git add packages/server/__tests__/e2e.test.ts
git commit -m "test: add end-to-end integration tests for tool execution"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Monorepo scaffolding | package.json, tsconfig, shared types |
| 2 | SQLite database service | services/db.ts |
| 3 | LanceDB vector search | services/lancedb.ts, embeddings.ts |
| 4 | Document text extraction | services/extractor.ts |
| 5 | File watcher (chokidar) | services/watcher.ts |
| 6 | Thumbnail generation | services/thumbnail.ts |
| 7 | HLS streaming | services/hls.ts |
| 8 | Agent ReAct loop + tools | agent/loop.ts, tools/registry.ts |
| 9 | API routes (Hono) | routes/chat.ts, stream.ts, etc. |
| 10 | React PWA setup + layout | client/src/App.tsx, main.tsx |
| 11 | Chat UI + useSSE hook | hooks/useSSE.ts, routes/Chat.tsx |
| 12 | Render components | renderers/VideoCard.tsx, etc. |
| 13 | Docker Compose (Ollama) | docker/compose.yml |
| 14 | Server bootstrap wiring | bootstrap.ts |
| 15 | Indexer worker thread | workers/indexer.worker.ts |
| 16 | E2E integration tests | __tests__/e2e.test.ts |
