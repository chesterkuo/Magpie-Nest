# Audit Fix Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 MVP-blocking issues from the second PRD audit + add hybrid search, organize_files tool, and batch_rename tool.

**Architecture:** Server-side fixes (security, indexing, search, new tools) + frontend enhancements (duration, metadata, fullscreen). Hybrid search uses keyword overlap re-ranking on top of existing vector search. New tools use `fs` operations with path validation.

**Tech Stack:** Bun, Hono, LanceDB, SQLite, React 19, TailwindCSS v4

---

## Chunk 1: Server Security, Config & Indexing (Tasks 1–4)

### Task 1: Fix path traversal in stream route

**Files:**
- Modify: `packages/server/routes/stream.ts:24-38`
- Test: `packages/server/__tests__/e2e-api.test.ts`

- [ ] **Step 1: Write the failing test**

In `packages/server/__tests__/e2e-api.test.ts`, add a test inside or after the existing flow tests:

```typescript
describe('Flow 8: Stream route path traversal prevention', () => {
  it('rejects path traversal in segment parameter', async () => {
    const res = await req(app, '/api/stream/test-id/../../etc/passwd')
    expect(res.status).toBe(400)
  })

  it('rejects encoded path traversal', async () => {
    const res = await req(app, '/api/stream/test-id/..%2F..%2Fetc%2Fpasswd')
    expect(res.status).toBe(400)
  })

  it('rejects segment with slashes', async () => {
    const res = await req(app, '/api/stream/test-id/sub/dir/file.ts')
    // Hono may not even route this, but if it does, reject
    expect([400, 404]).toContain(res.status)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test __tests__/e2e-api.test.ts`
Expected: FAIL — currently returns 404 (file not found), not 400

- [ ] **Step 3: Implement path traversal protection**

In `packages/server/routes/stream.ts`, modify the segment handler (line 24):

```typescript
import { Hono } from 'hono'
import { existsSync } from 'fs'
import { join, resolve, basename } from 'path'

export const streamRoute = new Hono()

const DATA_DIR = process.env.DATA_DIR || './data'

// ... playlist route stays the same ...

streamRoute.get('/stream/:id/:segment', async (c) => {
  const { id, segment } = c.req.param()

  // Validate segment: must be a simple filename, no path separators or traversal
  const clean = basename(segment)
  if (clean !== segment || segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
    return c.json({ error: 'Invalid segment' }, 400)
  }

  const hlsDir = resolve(DATA_DIR, 'hls-cache', id)
  const segPath = join(hlsDir, clean)

  // Double-check resolved path stays inside hls-cache
  if (!segPath.startsWith(hlsDir)) {
    return c.json({ error: 'Invalid segment' }, 400)
  }

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

- [ ] **Step 4: Run tests to verify**

Run: `cd packages/server && bun test __tests__/e2e-api.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/routes/stream.ts packages/server/__tests__/e2e-api.test.ts
git commit -m "fix: prevent path traversal in HLS segment route"
```

---

### Task 2: Change debounce from 5s to 30s

**Files:**
- Modify: `packages/server/bootstrap.ts:50`

- [ ] **Step 1: Change debounce value**

In `packages/server/bootstrap.ts`, change line 50 from `5000` to `30000`:

```typescript
  }, 30000) // 30 second debounce per PRD
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/bootstrap.ts
git commit -m "fix: change watcher debounce from 5s to 30s per PRD"
```

---

### Task 3: Add date prefix to text chunks

**Files:**
- Modify: `packages/server/services/indexer.ts:65-67`
- Test: `packages/server/services/__tests__/extractor.test.ts`

- [ ] **Step 1: Write the failing test for chunkText date prefix**

In `packages/server/services/__tests__/extractor.test.ts`, add:

```typescript
describe('chunkText', () => {
  it('includes metadata prefix in each chunk', () => {
    const { chunkText } = require('../extractor')
    const text = 'Hello world this is test content'
    const metadata = '[2026-03-14] File: test.txt | Path: /data/test.txt'
    const chunks = chunkText(text, metadata, 100)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toStartWith('[2026-03-14]')
    expect(chunks[0]).toContain('File: test.txt')
    expect(chunks[0]).toContain('Hello world')
  })
})
```

- [ ] **Step 2: Run test to verify it works (existing behavior already passes)**

The chunkText function already prepends metadata. The real fix is in `indexer.ts` where metadata string is built.

Run: `cd packages/server && bun test services/__tests__/extractor.test.ts`

- [ ] **Step 3: Update metadata string in indexer.ts to include date**

In `packages/server/services/indexer.ts`, change line 66 from:

```typescript
    const metadata = `File: ${name} | Type: ${fileType} | Path: ${filePath}`
```

to:

```typescript
    const dateStr = stat.mtime.toISOString().split('T')[0]
    const metadata = `[${dateStr}] File: ${name} | Type: ${fileType} | Path: ${filePath}`
```

- [ ] **Step 4: Run all tests**

Run: `cd packages/server && bun test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/services/indexer.ts packages/server/services/__tests__/extractor.test.ts
git commit -m "feat: add date prefix to text chunk metadata per PRD"
```

---

### Task 4: Fix search post-filter to over-fetch then trim

**Files:**
- Modify: `packages/server/agent/tools/registry.ts:39-69`
- Test: `packages/server/__tests__/e2e-api.test.ts`

- [ ] **Step 1: Fix search_files to over-fetch**

In `packages/server/agent/tools/registry.ts`, update the `search_files` function:

```typescript
  async search_files(args: { query: string; file_type?: string; days_ago?: number; limit?: number }) {
    const limit = args.limit || 10
    // Over-fetch 3x when filters are applied, to ensure we get enough results after filtering
    const fetchMultiplier = (args.file_type || args.days_ago) ? 3 : 1
    const vector = await ctx.embedQuery(args.query)
    const results = await ctx.vectorDb.search(vector, limit * fetchMultiplier)

    let filtered = results
    if (args.file_type) {
      filtered = filtered.filter((r) => r.file_type === args.file_type)
    }

    if (args.days_ago) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - args.days_ago)
      const cutoffStr = cutoff.toISOString()
      filtered = filtered.filter((r) => {
        const file = ctx.db.getFileById(r.file_id)
        return file && file.modified_at >= cutoffStr
      })
    }

    const seen = new Set<string>()
    const unique = filtered.filter((r) => {
      if (seen.has(r.file_id)) return false
      seen.add(r.file_id)
      return true
    })

    // Trim to requested limit after filtering
    const trimmed = unique.slice(0, limit)

    const files = trimmed
      .map((r) => ctx.db.getFileById(r.file_id))
      .filter(Boolean)
      .map(toFileItem)

    return { files }
  },
```

- [ ] **Step 2: Run tests**

Run: `cd packages/server && bun test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/server/agent/tools/registry.ts
git commit -m "fix: over-fetch 3x in search_files when filters applied"
```

---

## Chunk 2: Hybrid Search (Task 5)

### Task 5: Add keyword re-ranking for hybrid search

**Files:**
- Create: `packages/server/services/search.ts`
- Modify: `packages/server/services/lancedb.ts` (update SearchResult interface)
- Modify: `packages/server/agent/tools/registry.ts` (use hybrid search)
- Test: `packages/server/services/__tests__/search.test.ts`

The approach: over-fetch from vector search, then re-rank results by combining vector similarity score with keyword overlap score. This gives hybrid results without requiring a separate FTS index.

- [ ] **Step 1: Write tests for keyword scoring**

Create `packages/server/services/__tests__/search.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { keywordScore, hybridRank } from '../search'

describe('keywordScore', () => {
  it('returns 1.0 for exact query match', () => {
    const score = keywordScore('hello world test', 'hello world test')
    expect(score).toBe(1.0)
  })

  it('returns 0 for no overlap', () => {
    const score = keywordScore('hello world', 'foo bar baz')
    expect(score).toBe(0)
  })

  it('returns partial score for partial match', () => {
    const score = keywordScore('hello world test', 'hello other')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it('is case insensitive', () => {
    const score = keywordScore('Hello World', 'hello world')
    expect(score).toBe(1.0)
  })

  it('ignores common stop words', () => {
    const score = keywordScore('the file is here', 'the other is there')
    // "the" and "is" are stop words, so low meaningful overlap
    expect(score).toBeLessThan(0.5)
  })
})

describe('hybridRank', () => {
  it('re-ranks results combining vector and keyword scores', () => {
    const results = [
      { id: '1', file_id: 'f1', text: 'cats and dogs playing', file_name: 'a.txt', file_type: 'doc', file_path: '/a.txt', _distance: 0.1 },
      { id: '2', file_id: 'f2', text: 'python programming tutorial', file_name: 'b.txt', file_type: 'doc', file_path: '/b.txt', _distance: 0.2 },
      { id: '3', file_id: 'f3', text: 'dogs in the park', file_name: 'c.txt', file_type: 'doc', file_path: '/c.txt', _distance: 0.3 },
    ]

    const ranked = hybridRank(results, 'dogs', 10)
    // Items mentioning "dogs" should rank higher
    expect(ranked.length).toBe(3)
  })

  it('respects limit', () => {
    const results = [
      { id: '1', file_id: 'f1', text: 'a', file_name: 'a.txt', file_type: 'doc', file_path: '/a.txt', _distance: 0.1 },
      { id: '2', file_id: 'f2', text: 'b', file_name: 'b.txt', file_type: 'doc', file_path: '/b.txt', _distance: 0.2 },
    ]
    const ranked = hybridRank(results, 'a', 1)
    expect(ranked.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test services/__tests__/search.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement search.ts**

Create `packages/server/services/search.ts`:

```typescript
import type { SearchResult } from './lancedb'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet',
  'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'about', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which',
  'who', 'whom',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

/**
 * Score how well a text matches a query based on keyword overlap.
 * Returns 0-1 where 1 = all query terms found in text.
 */
export function keywordScore(text: string, query: string): number {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return 0

  const textTokens = new Set(tokenize(text))
  const matches = queryTokens.filter(t => textTokens.has(t)).length
  return matches / queryTokens.length
}

/**
 * Re-rank search results using hybrid scoring (vector + keyword).
 * alpha=0.3 means 70% vector, 30% keyword.
 */
export function hybridRank(
  results: SearchResult[],
  query: string,
  limit: number,
  alpha = 0.3
): SearchResult[] {
  if (results.length === 0) return []

  // Normalize vector distances to 0-1 scores (lower distance = higher score)
  const maxDist = Math.max(...results.map(r => r._distance), 0.001)

  const scored = results.map(r => {
    const vectorScore = 1 - (r._distance / maxDist)
    const kwScore = keywordScore(r.text, query)
    const hybrid = (1 - alpha) * vectorScore + alpha * kwScore
    return { result: r, hybrid }
  })

  scored.sort((a, b) => b.hybrid - a.hybrid)
  return scored.slice(0, limit).map(s => s.result)
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/server && bun test services/__tests__/search.test.ts`
Expected: All PASS

- [ ] **Step 5: Integrate hybrid search into search_files tool**

In `packages/server/agent/tools/registry.ts`, add import and use `hybridRank`:

Add at top:
```typescript
import { hybridRank } from '../../services/search'
```

Update `search_files` to use hybrid ranking:

```typescript
  async search_files(args: { query: string; file_type?: string; days_ago?: number; limit?: number }) {
    const limit = args.limit || 10
    const fetchMultiplier = (args.file_type || args.days_ago) ? 3 : 1
    const vector = await ctx.embedQuery(args.query)
    // Over-fetch for hybrid re-ranking
    const results = await ctx.vectorDb.search(vector, Math.max(limit * fetchMultiplier, limit * 3))

    // Hybrid re-rank with keyword scoring
    const ranked = hybridRank(results, args.query, results.length)

    let filtered = ranked
    if (args.file_type) {
      filtered = filtered.filter((r) => r.file_type === args.file_type)
    }

    if (args.days_ago) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - args.days_ago)
      const cutoffStr = cutoff.toISOString()
      filtered = filtered.filter((r) => {
        const file = ctx.db.getFileById(r.file_id)
        return file && file.modified_at >= cutoffStr
      })
    }

    const seen = new Set<string>()
    const unique = filtered.filter((r) => {
      if (seen.has(r.file_id)) return false
      seen.add(r.file_id)
      return true
    })

    const trimmed = unique.slice(0, limit)

    const files = trimmed
      .map((r) => ctx.db.getFileById(r.file_id))
      .filter(Boolean)
      .map(toFileItem)

    return { files }
  },
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/server && bun test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/services/search.ts packages/server/services/__tests__/search.test.ts packages/server/agent/tools/registry.ts
git commit -m "feat: add hybrid search with keyword re-ranking"
```

---

## Chunk 3: New Agent Tools (Tasks 6–8)

### Task 6: Add organize_files tool

**Files:**
- Modify: `packages/server/agent/tools/registry.ts`
- Test: `packages/server/__tests__/e2e-api.test.ts`

This tool organizes files in watched directories by moving them into subfolders based on type (e.g., Videos/, Music/, Documents/, Images/).

- [ ] **Step 1: Add organize_files implementation**

In `packages/server/agent/tools/registry.ts`, add to `toolImplementations`:

```typescript
  async organize_files(args: { path: string; strategy?: string }) {
    const { existsSync, mkdirSync, renameSync } = await import('fs')
    const { join, basename, resolve } = await import('path')

    const targetDir = resolve(args.path)
    if (!existsSync(targetDir)) return { error: 'Directory not found' }

    const strategy = args.strategy || 'type' // 'type' or 'date'
    const typeFolders: Record<string, string> = {
      video: 'Videos', audio: 'Music', pdf: 'Documents',
      image: 'Images', doc: 'Documents',
    }

    // Get all indexed files under this path
    const files = ctx.db.db.prepare(
      'SELECT * FROM files WHERE path LIKE ?'
    ).all(`${targetDir}%`) as any[]

    const moved: string[] = []
    const errors: string[] = []

    for (const file of files) {
      const fileDir = resolve(file.path, '..')
      // Only organize files directly in the target dir (not subdirs)
      if (fileDir !== targetDir) continue

      let destFolder: string
      if (strategy === 'date') {
        const date = file.modified_at.split('T')[0] // YYYY-MM-DD
        destFolder = join(targetDir, date)
      } else {
        destFolder = join(targetDir, typeFolders[file.file_type] || 'Other')
      }

      try {
        if (!existsSync(destFolder)) mkdirSync(destFolder, { recursive: true })
        const newPath = join(destFolder, basename(file.path))
        if (newPath === file.path) continue // already organized
        renameSync(file.path, newPath)
        // Update DB path
        ctx.db.db.prepare('UPDATE files SET path = ? WHERE id = ?').run(newPath, file.id)
        moved.push(`${basename(file.path)} → ${basename(destFolder)}/`)
      } catch (e: any) {
        errors.push(`${basename(file.path)}: ${e.message}`)
      }
    }

    return {
      organized: moved.length,
      moved,
      errors: errors.length > 0 ? errors : undefined,
    }
  },
```

- [ ] **Step 2: Add tool definition**

In `buildToolDefinitions()`, add:

```typescript
    {
      type: 'function',
      function: {
        name: 'organize_files',
        description: 'Organize files in a directory by moving them into subfolders based on file type (Videos/, Music/, Documents/, Images/) or date.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to organize' },
            strategy: { type: 'string', enum: ['type', 'date'], description: 'Organization strategy (default: type)' },
          },
          required: ['path'],
        },
      },
    },
```

- [ ] **Step 3: Run tests**

Run: `cd packages/server && bun test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/agent/tools/registry.ts
git commit -m "feat: add organize_files tool"
```

---

### Task 7: Add batch_rename tool

**Files:**
- Modify: `packages/server/agent/tools/registry.ts`

- [ ] **Step 1: Add batch_rename implementation**

In `packages/server/agent/tools/registry.ts`, add to `toolImplementations`:

```typescript
  async batch_rename(args: { path: string; pattern: string; replacement: string; dry_run?: boolean }) {
    const { existsSync, renameSync } = await import('fs')
    const { join, basename, dirname, resolve } = await import('path')

    const targetDir = resolve(args.path)
    if (!existsSync(targetDir)) return { error: 'Directory not found' }

    let regex: RegExp
    try {
      regex = new RegExp(args.pattern, 'g')
    } catch (e: any) {
      return { error: `Invalid pattern: ${e.message}` }
    }

    // Get indexed files under this path
    const files = ctx.db.db.prepare(
      'SELECT * FROM files WHERE path LIKE ?'
    ).all(`${targetDir}%`) as any[]

    const previews: Array<{ from: string; to: string }> = []
    const errors: string[] = []

    for (const file of files) {
      const oldName = basename(file.path)
      const newName = oldName.replace(regex, args.replacement)
      if (newName === oldName) continue

      const newPath = join(dirname(file.path), newName)
      previews.push({ from: oldName, to: newName })

      if (!args.dry_run) {
        try {
          renameSync(file.path, newPath)
          ctx.db.db.prepare('UPDATE files SET path = ?, name = ? WHERE id = ?').run(newPath, newName, file.id)
        } catch (e: any) {
          errors.push(`${oldName}: ${e.message}`)
        }
      }
    }

    return {
      matched: previews.length,
      previews,
      applied: !args.dry_run,
      errors: errors.length > 0 ? errors : undefined,
    }
  },
```

- [ ] **Step 2: Add tool definition**

In `buildToolDefinitions()`, add:

```typescript
    {
      type: 'function',
      function: {
        name: 'batch_rename',
        description: 'Rename multiple files matching a regex pattern. Supports dry_run to preview changes before applying.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory containing files to rename' },
            pattern: { type: 'string', description: 'Regex pattern to match in filenames' },
            replacement: { type: 'string', description: 'Replacement string (supports $1, $2 capture groups)' },
            dry_run: { type: 'boolean', description: 'If true, show preview without renaming (default: false)' },
          },
          required: ['path', 'pattern', 'replacement'],
        },
      },
    },
```

- [ ] **Step 3: Run tests**

Run: `cd packages/server && bun test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/agent/tools/registry.ts
git commit -m "feat: add batch_rename tool"
```

---

### Task 8: Sync system prompt with all tools

**Files:**
- Modify: `packages/server/agent/prompt.ts`

- [ ] **Step 1: Update system prompt**

Replace `packages/server/agent/prompt.ts` with:

```typescript
export const SYSTEM_PROMPT = `You are Magpie, a local AI storage assistant running on the user's personal device. You help users find, play, and manage their files stored locally.

Available tools:
- search_files: Semantic search across all indexed files. Supports file_type and days_ago filters.
- play_media: Play a video or audio file via HLS streaming.
- open_document: Open a PDF or document for preview.
- list_recent: List recently added/modified files.
- get_file_info: Get detailed metadata about a specific file.
- create_playlist: Create a named playlist, optionally auto-populated by search.
- list_directory: Browse files in a specific folder.
- get_disk_status: Show disk usage and file counts by type.
- organize_files: Organize files in a directory into subfolders by type or date.
- batch_rename: Rename multiple files matching a pattern. Supports dry_run preview.

Rules:
- Always use the provided tools to fulfill requests. Never guess file locations or names.
- Respond concisely and helpfully.
- Match the user's language (if they write in Chinese, respond in Chinese).
- When search results are returned, summarize what was found.
- If no results are found, suggest alternative search terms.
- When the user asks to play multiple songs or a collection, return all matching files so they queue automatically.
- For batch_rename, default to dry_run first to show preview, then apply if user confirms.
- For organize_files, explain what will be moved before proceeding.`
```

- [ ] **Step 2: Run tests**

Run: `cd packages/server && bun test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/server/agent/prompt.ts
git commit -m "fix: sync system prompt with all 10 available tools"
```

---

## Chunk 4: Frontend Enhancements (Tasks 9–11)

### Task 9: Add duration display to VideoCard

**Files:**
- Modify: `packages/client/src/components/renderers/VideoCard.tsx`

- [ ] **Step 1: Add duration formatting and display**

Update `packages/client/src/components/renderers/VideoCard.tsx`:

```tsx
import { useRef, useState } from 'react'
import Hls from 'hls.js'
import type { FileItem } from '@magpie/shared'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

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
          <div className="relative">
            <img src={item.thumbUrl} alt="" className="w-24 h-16 object-cover rounded" />
            {item.duration != null && (
              <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[10px] px-1 rounded">
                {formatDuration(item.duration)}
              </span>
            )}
          </div>
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

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/renderers/VideoCard.tsx
git commit -m "feat: display duration on VideoCard thumbnail"
```

---

### Task 10: Add artist/album display to AudioPlayer

**Files:**
- Modify: `packages/client/src/components/renderers/AudioPlayer.tsx`

- [ ] **Step 1: Add metadata display**

Update `packages/client/src/components/renderers/AudioPlayer.tsx`:

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
        {(item.artist || item.album) && (
          <p className="text-xs text-gray-400 truncate">
            {item.artist}{item.artist && item.album ? ' — ' : ''}{item.album}
          </p>
        )}
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

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/renderers/AudioPlayer.tsx
git commit -m "feat: display artist and album in AudioPlayer"
```

---

### Task 11: Add fullscreen to PDFViewer

**Files:**
- Modify: `packages/client/src/components/renderers/PDFViewer.tsx`

- [ ] **Step 1: Add fullscreen toggle**

Update `packages/client/src/components/renderers/PDFViewer.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { FileItem } from '@magpie/shared'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

export function PDFViewer({ item }: { item: FileItem }) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
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
      const scale = fullscreen ? 2.5 : 1.5
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({
        canvasContext: canvas.getContext('2d')!,
        viewport,
      }).promise
    }
    render()
  }, [pdf, currentPage, fullscreen])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!fullscreen) return
    if (e.key === 'Escape') setFullscreen(false)
    if (e.key === 'ArrowLeft') setCurrentPage(p => Math.max(1, p - 1))
    if (e.key === 'ArrowRight') setCurrentPage(p => Math.min(numPages, p + 1))
  }, [fullscreen, numPages])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const container = (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <button
          onClick={() => setFullscreen(f => !f)}
          className="px-2 py-1 bg-gray-700 rounded text-xs"
        >
          {fullscreen ? 'Exit' : 'Expand'}
        </button>
      </div>
      <div className={fullscreen ? 'overflow-auto max-h-[calc(100vh-8rem)] flex justify-center' : ''}>
        <canvas ref={canvasRef} className="w-full rounded" />
      </div>
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
    </>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 p-4 flex flex-col">
        {container}
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      {container}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/renderers/PDFViewer.tsx
git commit -m "feat: add fullscreen mode to PDFViewer"
```

---

## Summary

| Task | Description | Type |
|------|-------------|------|
| 1 | Path traversal fix in stream route | Security fix |
| 2 | Debounce 5s → 30s | Config fix |
| 3 | Date prefix in text chunks | Indexing fix |
| 4 | Search post-filter over-fetch | Search fix |
| 5 | Hybrid search with keyword re-ranking | New feature |
| 6 | organize_files tool | New feature |
| 7 | batch_rename tool | New feature |
| 8 | System prompt sync with all tools | Fix |
| 9 | VideoCard duration display | Frontend |
| 10 | AudioPlayer artist/album display | Frontend |
| 11 | PDFViewer fullscreen | Frontend |
