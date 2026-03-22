# File Upload & AirDrop Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow file uploads from any device via browser and AirDrop control via chat commands.

**Architecture:** A multipart upload endpoint saves files to the first watch directory and enqueues them for indexing. A new Upload page provides drag-and-drop with progress. An `airdrop_control` agent tool runs macOS `defaults` commands to toggle AirDrop discoverability.

**Tech Stack:** Hono (multipart), Bun (file I/O), React 19, Tailwind CSS 4, Heroicons

**Spec:** `docs/superpowers/specs/2026-03-22-file-upload-and-airdrop-design.md`

---

### Task 1: Create upload route with tests

**Files:**
- Create: `packages/server/routes/upload.ts`
- Create: `packages/server/routes/__tests__/upload.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/routes/__tests__/upload.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, type MagpieDb } from '../../services/db'
import { createUploadRoute } from '../upload'
import { authMiddleware } from '../../middleware/auth'
import { existsSync, unlinkSync, mkdirSync } from 'fs'

const AUTH = { Authorization: 'Bearer magpie-dev' }
const UPLOAD_DIR = '/tmp/magpie-upload-test'

describe('POST /api/upload', () => {
  let db: MagpieDb
  let app: Hono

  beforeEach(() => {
    db = createDb(':memory:')
    mkdirSync(UPLOAD_DIR, { recursive: true })
    app = new Hono()
    app.use('*', authMiddleware())
    app.route('/api', createUploadRoute(db, () => [UPLOAD_DIR]))
  })

  afterEach(() => {
    db.close()
    // Clean up uploaded files
    try {
      const { readdirSync } = require('fs')
      for (const f of readdirSync(UPLOAD_DIR)) unlinkSync(`${UPLOAD_DIR}/${f}`)
    } catch {}
  })

  it('rejects request without auth', async () => {
    const form = new FormData()
    form.append('files', new File(['hello'], 'test.txt', { type: 'text/plain' }))
    const res = await app.request('/api/upload', { method: 'POST', body: form })
    expect(res.status).toBe(401)
  })

  it('uploads a single file', async () => {
    const form = new FormData()
    form.append('files', new File(['hello world'], 'test.txt', { type: 'text/plain' }))
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers: AUTH,
      body: form,
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.uploaded).toHaveLength(1)
    expect(json.uploaded[0].name).toBe('test.txt')
    expect(json.uploaded[0].status).toBe('ok')
    expect(existsSync(`${UPLOAD_DIR}/test.txt`)).toBe(true)
  })

  it('uploads multiple files', async () => {
    const form = new FormData()
    form.append('files', new File(['aaa'], 'a.txt', { type: 'text/plain' }))
    form.append('files', new File(['bbb'], 'b.txt', { type: 'text/plain' }))
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers: AUTH,
      body: form,
    })
    const json = await res.json()
    expect(json.uploaded).toHaveLength(2)
    expect(existsSync(`${UPLOAD_DIR}/a.txt`)).toBe(true)
    expect(existsSync(`${UPLOAD_DIR}/b.txt`)).toBe(true)
  })

  it('handles filename conflicts by appending suffix', async () => {
    // Upload first file
    const form1 = new FormData()
    form1.append('files', new File(['first'], 'dup.txt', { type: 'text/plain' }))
    await app.request('/api/upload', { method: 'POST', headers: AUTH, body: form1 })

    // Upload duplicate
    const form2 = new FormData()
    form2.append('files', new File(['second'], 'dup.txt', { type: 'text/plain' }))
    const res = await app.request('/api/upload', { method: 'POST', headers: AUTH, body: form2 })
    const json = await res.json()
    expect(json.uploaded[0].name).toBe('dup (1).txt')
    expect(existsSync(`${UPLOAD_DIR}/dup (1).txt`)).toBe(true)
  })

  it('enqueues uploaded files for indexing', async () => {
    const form = new FormData()
    form.append('files', new File(['data'], 'index-me.txt', { type: 'text/plain' }))
    await app.request('/api/upload', { method: 'POST', headers: AUTH, body: form })

    const pending = db.dequeuePending(10)
    expect(pending.length).toBeGreaterThanOrEqual(1)
    expect(pending.some((p: any) => p.file_path.includes('index-me.txt'))).toBe(true)
  })

  it('returns 400 when no files provided', async () => {
    const form = new FormData()
    const res = await app.request('/api/upload', { method: 'POST', headers: AUTH, body: form })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test routes/__tests__/upload.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement upload route**

Create `packages/server/routes/upload.ts`:
```typescript
import { Hono } from 'hono'
import { join, extname, basename } from 'path'
import { existsSync } from 'fs'
import type { MagpieDb } from '../services/db'

export function createUploadRoute(db: MagpieDb, getWatchDirs: () => string[]) {
  const route = new Hono()

  route.post('/upload', async (c) => {
    const body = await c.req.parseBody({ all: true })
    const rawFiles = body['files']
    if (!rawFiles) return c.json({ error: 'No files provided' }, 400)

    const files = Array.isArray(rawFiles) ? rawFiles : [rawFiles]
    const uploadFiles = files.filter((f): f is File => f instanceof File)
    if (uploadFiles.length === 0) return c.json({ error: 'No files provided' }, 400)

    const destDir = getWatchDirs()[0]
    if (!destDir) return c.json({ error: 'No watch directory configured' }, 500)

    const results: Array<{ name: string; path: string; size: number; status: string; error?: string }> = []

    for (const file of uploadFiles) {
      try {
        const destPath = resolveUniquePath(destDir, file.name)
        const buffer = await file.arrayBuffer()
        await Bun.write(destPath, buffer)

        db.enqueue(destPath, 'created')

        results.push({
          name: basename(destPath),
          path: destPath,
          size: file.size,
          status: 'ok',
        })
      } catch (err: any) {
        results.push({
          name: file.name,
          path: '',
          size: file.size,
          status: 'error',
          error: err.message,
        })
      }
    }

    return c.json({ uploaded: results })
  })

  return route
}

function resolveUniquePath(dir: string, fileName: string): string {
  let destPath = join(dir, fileName)
  if (!existsSync(destPath)) return destPath

  const ext = extname(fileName)
  const base = basename(fileName, ext)
  let counter = 1
  while (existsSync(destPath)) {
    destPath = join(dir, `${base} (${counter})${ext}`)
    counter++
  }
  return destPath
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/server && bun test routes/__tests__/upload.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/routes/upload.ts packages/server/routes/__tests__/upload.test.ts
git commit -m "feat: add file upload endpoint with tests"
```

---

### Task 2: Wire upload route into server

**Files:**
- Modify: `packages/server/index.ts`

- [ ] **Step 1: Add upload route import and wiring**

In `packages/server/index.ts`, add after the `createSettingsRoute` import (line 12):
```typescript
import { createUploadRoute } from './routes/upload'
```

Add after the settings route line (line 33):
```typescript
api.route('/', createUploadRoute(appContext.db, appContext.getWatchDirs))
```

- [ ] **Step 2: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/server/index.ts
git commit -m "feat: wire upload route into server"
```

---

### Task 3: Add airdrop_control agent tool

**Files:**
- Modify: `packages/server/agent/tools/registry.ts`

- [ ] **Step 1: Add airdrop_control tool implementation**

In `packages/server/agent/tools/registry.ts`, add to the `toolImplementations` object (after the `get_disk_status` implementation, before the closing `}`):

```typescript
  async airdrop_control(args: { action: 'status' | 'everyone' | 'contacts' | 'off' }) {
    const modeMap: Record<string, string> = {
      everyone: 'Everyone',
      contacts: 'Contacts Only',
      off: 'Off',
    }

    if (args.action === 'status') {
      try {
        const proc = Bun.spawnSync(['defaults', 'read', 'com.apple.sharingd', 'DiscoverableMode'])
        const mode = new TextDecoder().decode(proc.stdout).trim()
        return { mode: mode || 'Unknown', message: `AirDrop is currently set to: ${mode || 'Unknown'}` }
      } catch {
        return { mode: 'Unknown', message: 'Could not read AirDrop status.' }
      }
    }

    const mode = modeMap[args.action]
    if (!mode) return { error: 'Invalid action' }

    try {
      Bun.spawnSync(['defaults', 'write', 'com.apple.sharingd', 'DiscoverableMode', '-string', mode])
      Bun.spawnSync(['killall', '-HUP', 'sharingd'])
      const msg = args.action === 'off'
        ? 'AirDrop has been turned off.'
        : `AirDrop is now set to "${mode}". Files received via AirDrop will appear in ~/Downloads and be auto-indexed. Remember to turn it off when done.`
      return { mode, message: msg }
    } catch (err: any) {
      return { error: `Failed to set AirDrop: ${err.message}` }
    }
  },
```

- [ ] **Step 2: Add airdrop_control tool definition**

In the `buildToolDefinitions()` return array, add after the `batch_rename` definition:

```typescript
    {
      type: 'function',
      function: {
        name: 'airdrop_control',
        description: 'Control AirDrop discoverability on this Mac. Can enable (everyone/contacts only), disable, or check current status. When enabling for everyone, remind the user to turn it off when done.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['status', 'everyone', 'contacts', 'off'],
              description: 'Get current status or set AirDrop mode',
            },
          },
          required: ['action'],
        },
      },
    },
```

- [ ] **Step 3: Run existing tool tests**

Run: `cd packages/server && bun test agent/__tests__/loop.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/agent/tools/registry.ts
git commit -m "feat: add airdrop_control agent tool"
```

---

### Task 4: Create Upload page component

**Files:**
- Create: `packages/client/src/routes/Upload.tsx`

- [ ] **Step 1: Create Upload page**

Create `packages/client/src/routes/Upload.tsx`:
```tsx
import { useState, useRef, useCallback } from 'react'
import { ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface UploadFile {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function Upload() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = Array.from(fileList).map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }))
    setFiles(prev => [...prev, ...newFiles])
    uploadFiles(newFiles)
  }, [])

  function uploadFiles(uploadFiles: UploadFile[]) {
    const form = new FormData()
    for (const uf of uploadFiles) form.append('files', uf.file)

    const xhr = new XMLHttpRequest()
    const token = localStorage.getItem('magpie-token') || 'magpie-dev'

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      const pct = Math.round((e.loaded / e.total) * 100)
      setFiles(prev => prev.map(f =>
        uploadFiles.some(uf => uf.file === f.file)
          ? { ...f, progress: pct, status: 'uploading' }
          : f
      ))
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        setFiles(prev => prev.map(f =>
          uploadFiles.some(uf => uf.file === f.file)
            ? { ...f, progress: 100, status: 'done' }
            : f
        ))
        // Auto-remove completed files after 3s
        setTimeout(() => {
          setFiles(prev => prev.filter(f => f.status !== 'done'))
        }, 3000)
      } else {
        setFiles(prev => prev.map(f =>
          uploadFiles.some(uf => uf.file === f.file)
            ? { ...f, status: 'error', error: 'Upload failed' }
            : f
        ))
      }
    }

    xhr.onerror = () => {
      setFiles(prev => prev.map(f =>
        uploadFiles.some(uf => uf.file === f.file)
          ? { ...f, status: 'error', error: 'Network error' }
          : f
      ))
    }

    xhr.open('POST', '/api/upload')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(form)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col h-full md:p-6 p-4">
      <h1 className="text-lg font-semibold text-white mb-4">Upload Files</h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex-1 flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <ArrowUpTrayIcon className="w-12 h-12 text-gray-500" />
        <div className="text-center">
          <p className="text-sm text-gray-300">Drop files here or click to browse</p>
          <p className="text-xs text-gray-500 mt-1">Any file type, no size limit</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={`${f.file.name}-${i}`} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{f.file.name}</p>
                <p className="text-xs text-gray-500">{formatSize(f.file.size)}</p>
                {(f.status === 'uploading' || f.status === 'pending') && (
                  <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {f.status === 'done' && <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />}
              {f.status === 'error' && <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" />}
              {f.status === 'uploading' && <span className="text-xs text-gray-400">{f.progress}%</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/routes/Upload.tsx
git commit -m "feat: create Upload page with drag-and-drop and progress"
```

---

### Task 5: Add Upload to navigation and routing

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/client/src/components/Sidebar.tsx`
- Modify: `packages/client/src/components/BottomNav.tsx`

- [ ] **Step 1: Add Upload route to App.tsx**

In `packages/client/src/App.tsx`, add import after the Settings import (line 5):
```typescript
import { Upload } from './routes/Upload'
```

Add route after the `/media` route (line 34):
```tsx
              <Route path="/upload" element={<Upload />} />
```

- [ ] **Step 2: Add Upload link to Sidebar**

In `packages/client/src/components/Sidebar.tsx`, add to the Heroicons import:
```typescript
  ArrowUpTrayIcon,
```

Add to the `links` array between Media and Settings:
```typescript
  { to: '/upload', icon: ArrowUpTrayIcon, label: 'Upload' },
```

- [ ] **Step 3: Add Upload link to BottomNav**

In `packages/client/src/components/BottomNav.tsx`, add to the Heroicons import:
```typescript
  ArrowUpTrayIcon,
```

Add to the `links` array between Media and Settings:
```typescript
  { to: '/upload', icon: ArrowUpTrayIcon, label: 'Upload' },
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/App.tsx packages/client/src/components/Sidebar.tsx packages/client/src/components/BottomNav.tsx
git commit -m "feat: add Upload to navigation and routing"
```

---

### Task 6: Update e2e tests for new navigation

**Files:**
- Modify: `e2e/navigation.spec.ts`

- [ ] **Step 1: Update navigation test for 6 tabs**

In `e2e/navigation.spec.ts`, update the test "renders sidebar navigation with 5 tabs":
- Change `toHaveCount(5)` to `toHaveCount(6)`
- Add assertion for the Upload link: `await expect(links.nth(5)).toContainText('Upload')` (adjust position — Upload is between Media and Settings, so index 4)
- Shift Settings from index 4 to index 5

Update the "navigates to each tab" test to include Upload:
```typescript
    // Navigate to Upload
    await page.locator('aside nav a', { hasText: 'Upload' }).click()
    await expect(page).toHaveURL(/\/upload/)
    await expect(page.locator('h1')).toHaveText('Upload Files')
```

- [ ] **Step 2: Run e2e tests**

Run: `cd /Users/chester/Magpie-Nest && bunx playwright test e2e/navigation.spec.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add e2e/navigation.spec.ts
git commit -m "test: update e2e navigation tests for Upload tab"
```

---

### Task 7: Run full test suite and verify

- [ ] **Step 1: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All tests pass

- [ ] **Step 2: Run all e2e tests**

Run: `bunx playwright test`
Expected: All tests pass

- [ ] **Step 3: Manual verification**

1. Open http://localhost:5173/upload
2. Drag a file onto the drop zone — verify it uploads and shows progress
3. Check ~/Downloads for the uploaded file
4. In Chat, ask "enable airdrop" — verify response mentions AirDrop enabled
5. Ask "is airdrop on?" — verify it returns current status
6. Ask "turn off airdrop" — verify response

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "feat: file upload and AirDrop control complete"
```
