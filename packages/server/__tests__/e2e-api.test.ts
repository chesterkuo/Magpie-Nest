// Set DATA_DIR before importing stream route (it reads env at module load)
process.env.DATA_DIR = '/tmp/magpie-e2e-api-test'

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Hono } from 'hono'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { authMiddleware } from '../middleware/auth'
import { createDb, type MagpieDb } from '../services/db'
import { createVectorDb, type VectorDb } from '../services/lancedb'
import { createHealthRoute } from '../routes/health'
import { createFileRoute } from '../routes/file'
import { createFilesRoute } from '../routes/files'
import { createPlaylistsRoute } from '../routes/playlists'
import { createConversationsRoute } from '../routes/conversations'
import { createSettingsRoute } from '../routes/settings'
import { createChatRoute } from '../routes/chat'
import { createStreamRoute } from '../routes/stream'

const TEST_DIR = '/tmp/magpie-e2e-api-test'
const AUTH = { Authorization: 'Bearer magpie-dev' }
const JSON_AUTH = { ...AUTH, 'Content-Type': 'application/json' }

function req(app: Hono, path: string, init?: RequestInit) {
  return app.request(`http://localhost${path}`, init)
}

describe('E2E API Integration', () => {
  let app: Hono
  let db: MagpieDb
  let vectorDb: VectorDb
  let watchDirs: string[] = []

  beforeAll(async () => {
    try { rmSync(TEST_DIR, { recursive: true }) } catch {}
    mkdirSync(`${TEST_DIR}/sqlite`, { recursive: true })
    mkdirSync(`${TEST_DIR}/lancedb`, { recursive: true })
    mkdirSync(`${TEST_DIR}/thumbs`, { recursive: true })
    mkdirSync(`${TEST_DIR}/hls-cache`, { recursive: true })
    mkdirSync(`${TEST_DIR}/files`, { recursive: true })

    db = createDb(`${TEST_DIR}/sqlite/test.db`)
    vectorDb = await createVectorDb(`${TEST_DIR}/lancedb`)

    const getWatchDirs = () => watchDirs
    const setWatchDirs = (dirs: string[]) => { watchDirs = dirs }

    app = new Hono()
    app.use('/api/*', authMiddleware())

    const api = app.basePath('/api')
    api.route('/', createHealthRoute(db, vectorDb, () => []))
    api.route('/', createFileRoute(db))
    api.route('/', createFilesRoute(db))
    api.route('/', createPlaylistsRoute(db))
    api.route('/', createConversationsRoute(db))
    api.route('/', createSettingsRoute(db, getWatchDirs, setWatchDirs))
    api.route('/', createChatRoute(() => ({ chat: async () => ({ content: 'mock' }), chatStream: async function*() {}, name: () => 'mock', modelName: () => 'test', healthCheck: async () => ({ status: 'ok', model: 'test', loaded: true }) } as any)))
    api.route('/', createStreamRoute(db))
  })

  afterAll(() => {
    db.close()
    try { rmSync(TEST_DIR, { recursive: true }) } catch {}
  })

  // ---------- Flow 1: File Lifecycle ----------

  describe('Flow 1: File Lifecycle', () => {
    beforeAll(() => {
      // Create a real temp file for file serving tests
      writeFileSync(`${TEST_DIR}/files/sample.mp4`, 'fake-video-content-here-1234567890')
      writeFileSync(`${TEST_DIR}/files/song.mp3`, 'fake-audio-data')
      writeFileSync(`${TEST_DIR}/files/report.pdf`, 'fake-pdf-bytes')
      writeFileSync(`${TEST_DIR}/files/photo.jpg`, 'fake-image-data')
      writeFileSync(`${TEST_DIR}/files/notes.docx`, 'fake-doc-data')

      // Seed files into DB
      const now = new Date().toISOString()
      const files = [
        { id: 'f-video-1', path: `${TEST_DIR}/files/sample.mp4`, name: 'sample.mp4', mime_type: 'video/mp4', size: 1000000, file_type: 'video' },
        { id: 'f-audio-1', path: `${TEST_DIR}/files/song.mp3`, name: 'song.mp3', mime_type: 'audio/mpeg', size: 500000, file_type: 'audio' },
        { id: 'f-pdf-1', path: `${TEST_DIR}/files/report.pdf`, name: 'report.pdf', mime_type: 'application/pdf', size: 200000, file_type: 'pdf' },
        { id: 'f-image-1', path: `${TEST_DIR}/files/photo.jpg`, name: 'photo.jpg', mime_type: 'image/jpeg', size: 300000, file_type: 'image' },
        { id: 'f-doc-1', path: `${TEST_DIR}/files/notes.docx`, name: 'notes.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100000, file_type: 'doc' },
      ]
      for (const f of files) {
        db.upsertFile({ ...f, modified_at: now, meta: '{}', hash: `hash-${f.id}` })
      }
    })

    it('GET /api/files returns all seeded files', async () => {
      const res = await req(app, '/api/files', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.files).toHaveLength(5)
      expect(body.total).toBe(5)
      // Verify shape of first file
      const file = body.files[0]
      expect(file).toHaveProperty('id')
      expect(file).toHaveProperty('name')
      expect(file).toHaveProperty('type')
      expect(file).toHaveProperty('size')
      expect(file).toHaveProperty('modified')
      expect(file).toHaveProperty('renderType')
      expect(file).toHaveProperty('streamUrl')
      expect(file).toHaveProperty('thumbUrl')
    })

    it('GET /api/files?type=video filters by type', async () => {
      const res = await req(app, '/api/files?type=video', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.files).toHaveLength(1)
      expect(body.total).toBe(1)
      expect(body.files[0].type).toBe('video')
      expect(body.files[0].renderType).toBe('video_card')
    })

    it('GET /api/files?sort=name&order=asc sorts correctly', async () => {
      const res = await req(app, '/api/files?sort=name&order=asc', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      const names = body.files.map((f: any) => f.name)
      const sorted = [...names].sort()
      expect(names).toEqual(sorted)
    })

    it('GET /api/files?limit=2&offset=0 paginates', async () => {
      const res = await req(app, '/api/files?limit=2&offset=0', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.files).toHaveLength(2)
      expect(body.total).toBe(5)
      expect(body.limit).toBe(2)
      expect(body.offset).toBe(0)
    })

    it('GET /api/files?limit=2&offset=2 returns next page', async () => {
      const res = await req(app, '/api/files?limit=2&offset=2', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.files).toHaveLength(2)
      expect(body.offset).toBe(2)
    })

    it('GET /api/file/:id serves file content', async () => {
      const res = await req(app, '/api/file/f-video-1', { headers: AUTH })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('video/mp4')
      expect(res.headers.get('Accept-Ranges')).toBe('bytes')
      expect(res.headers.get('Content-Disposition')).toContain('sample.mp4')
      const text = await res.text()
      expect(text).toBe('fake-video-content-here-1234567890')
    })

    it('GET /api/file/:id with Range header returns 206', async () => {
      const res = await req(app, '/api/file/f-video-1', {
        headers: { ...AUTH, Range: 'bytes=0-9' },
      })
      expect(res.status).toBe(206)
      expect(res.headers.get('Content-Range')).toMatch(/^bytes 0-9\//)
      expect(res.headers.get('Content-Length')).toBe('10')
      const text = await res.text()
      expect(text).toBe('fake-video')
    })

    it('GET /api/file/:id returns 404 for unknown id', async () => {
      const res = await req(app, '/api/file/nonexistent', { headers: AUTH })
      expect(res.status).toBe(404)
    })
  })

  // ---------- Flow 2: Playlist Management ----------

  describe('Flow 2: Playlist Management', () => {
    let playlistId: string

    it('POST /api/playlists creates a playlist', async () => {
      const res = await req(app, '/api/playlists', {
        method: 'POST',
        headers: JSON_AUTH,
        body: JSON.stringify({ name: 'My Playlist' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.name).toBe('My Playlist')
      expect(body.trackCount).toBe(0)
      expect(body.id).toBeDefined()
      playlistId = body.id
    })

    it('GET /api/playlists lists the created playlist', async () => {
      const res = await req(app, '/api/playlists', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.playlists).toHaveLength(1)
      expect(body.playlists[0].name).toBe('My Playlist')
      expect(body.playlists[0].id).toBe(playlistId)
      expect(body.playlists[0]).toHaveProperty('trackCount')
      expect(body.playlists[0]).toHaveProperty('createdAt')
      expect(body.playlists[0]).toHaveProperty('updatedAt')
    })

    it('POST /api/playlists/:id/items adds files to playlist', async () => {
      const res1 = await req(app, `/api/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: JSON_AUTH,
        body: JSON.stringify({ fileId: 'f-audio-1', position: 0 }),
      })
      expect(res1.status).toBe(201)

      const res2 = await req(app, `/api/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: JSON_AUTH,
        body: JSON.stringify({ fileId: 'f-video-1', position: 1 }),
      })
      expect(res2.status).toBe(201)
    })

    it('GET /api/playlists/:id lists playlist items', async () => {
      const res = await req(app, `/api/playlists/${playlistId}`, { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.name).toBe('My Playlist')
      expect(body.items).toHaveLength(2)
      expect(body.items[0]).toHaveProperty('id')
      expect(body.items[0]).toHaveProperty('name')
      expect(body.items[0]).toHaveProperty('streamUrl')
      expect(body.trackCount).toBe(2)
    })

    it('DELETE /api/playlists/:id/items/:fileId removes a file', async () => {
      const res = await req(app, `/api/playlists/${playlistId}/items/f-video-1`, {
        method: 'DELETE',
        headers: AUTH,
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.ok).toBe(true)
    })

    it('GET /api/playlists/:id shows item removed', async () => {
      const res = await req(app, `/api/playlists/${playlistId}`, { headers: AUTH })
      const body = await res.json() as any
      expect(body.items).toHaveLength(1)
      expect(body.items[0].id).toBe('f-audio-1')
      expect(body.trackCount).toBe(1)
    })

    it('PUT /api/playlists/:id renames playlist', async () => {
      const res = await req(app, `/api/playlists/${playlistId}`, {
        method: 'PUT',
        headers: JSON_AUTH,
        body: JSON.stringify({ name: 'Renamed Playlist' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.name).toBe('Renamed Playlist')
    })

    it('GET /api/playlists shows renamed playlist', async () => {
      const res = await req(app, '/api/playlists', { headers: AUTH })
      const body = await res.json() as any
      expect(body.playlists[0].name).toBe('Renamed Playlist')
    })

    it('DELETE /api/playlists/:id deletes the playlist', async () => {
      const res = await req(app, `/api/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: AUTH,
      })
      expect(res.status).toBe(200)
    })

    it('GET /api/playlists is empty after deletion', async () => {
      const res = await req(app, '/api/playlists', { headers: AUTH })
      const body = await res.json() as any
      expect(body.playlists).toHaveLength(0)
    })

    it('POST /api/playlists returns 400 without name', async () => {
      const res = await req(app, '/api/playlists', {
        method: 'POST',
        headers: JSON_AUTH,
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })
  })

  // ---------- Flow 3: Conversation Persistence ----------

  describe('Flow 3: Conversation Persistence', () => {
    const messages1 = [
      { role: 'user', text: 'Show me recent videos' },
      { role: 'assistant', content: 'Here are your recent videos...' },
    ]

    it('PUT /api/conversations/conv-1 saves a conversation', async () => {
      const res = await req(app, '/api/conversations/conv-1', {
        method: 'PUT',
        headers: JSON_AUTH,
        body: JSON.stringify({ messages: messages1 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.id).toBe('conv-1')
    })

    it('GET /api/conversations/conv-1 retrieves the conversation', async () => {
      const res = await req(app, '/api/conversations/conv-1', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.id).toBe('conv-1')
      expect(body.messages).toEqual(messages1)
      expect(body).toHaveProperty('createdAt')
      expect(body).toHaveProperty('updatedAt')
    })

    it('PUT /api/conversations/conv-1 updates with more messages', async () => {
      const updatedMessages = [
        ...messages1,
        { role: 'user', text: 'Play the first one' },
        { role: 'assistant', content: 'Playing now...' },
      ]
      const res = await req(app, '/api/conversations/conv-1', {
        method: 'PUT',
        headers: JSON_AUTH,
        body: JSON.stringify({ messages: updatedMessages }),
      })
      expect(res.status).toBe(200)
    })

    it('GET /api/conversations/conv-1 returns updated messages', async () => {
      const res = await req(app, '/api/conversations/conv-1', { headers: AUTH })
      const body = await res.json() as any
      expect(body.messages).toHaveLength(4)
      expect(body.messages[2].text).toBe('Play the first one')
    })

    it('PUT /api/conversations/conv-2 saves a second conversation', async () => {
      const messages2 = [
        { role: 'user', text: 'What PDFs do I have?' },
        { role: 'assistant', content: 'You have one PDF: report.pdf' },
      ]
      const res = await req(app, '/api/conversations/conv-2', {
        method: 'PUT',
        headers: JSON_AUTH,
        body: JSON.stringify({ messages: messages2 }),
      })
      expect(res.status).toBe(200)
    })

    it('GET /api/conversations lists both conversations', async () => {
      const res = await req(app, '/api/conversations', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.conversations).toHaveLength(2)
      // Both should be present (order may vary if timestamps are the same second)
      const ids = body.conversations.map((c: any) => c.id).sort()
      expect(ids).toEqual(['conv-1', 'conv-2'])
      // Verify shape on each entry
      for (const conv of body.conversations) {
        expect(conv).toHaveProperty('preview')
        expect(conv).toHaveProperty('messageCount')
        expect(conv).toHaveProperty('updatedAt')
      }
      const conv1 = body.conversations.find((c: any) => c.id === 'conv-1')
      const conv2 = body.conversations.find((c: any) => c.id === 'conv-2')
      expect(conv1.messageCount).toBe(4)
      expect(conv1.preview).toBe('Show me recent videos')
      expect(conv2.messageCount).toBe(2)
      expect(conv2.preview).toBe('What PDFs do I have?')
    })

    it('GET /api/conversations/nonexistent returns 404', async () => {
      const res = await req(app, '/api/conversations/nonexistent', { headers: AUTH })
      expect(res.status).toBe(404)
    })

    it('GET /api/conversations?limit=1 returns only 1 conversation', async () => {
      const res = await req(app, '/api/conversations?limit=1', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.conversations).toHaveLength(1)
    })
  })

  // ---------- Flow 4: Settings & Health ----------

  describe('Flow 4: Settings & Health', () => {
    it('GET /api/health returns expected shape', async () => {
      const res = await req(app, '/api/health')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body).toHaveProperty('status')
      expect(body).toHaveProperty('services')
      expect(body).toHaveProperty('uptime')
      expect(body).toHaveProperty('version')
      expect(body.services).toHaveProperty('sqlite')
      expect(body.services).toHaveProperty('lancedb')
      expect(body.services.sqlite.status).toBe('ok')
      expect(typeof body.services.sqlite.totalFiles).toBe('number')
    })

    it('GET /api/settings returns expected shape', async () => {
      const res = await req(app, '/api/settings', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body).toHaveProperty('watchDirs')
      expect(body).toHaveProperty('indexing')
      expect(body).toHaveProperty('version')
      expect(body.indexing).toHaveProperty('queueLength')
      expect(body.indexing).toHaveProperty('totalIndexed')
      expect(body.indexing).toHaveProperty('lastIndexedAt')
      expect(Array.isArray(body.watchDirs)).toBe(true)
    })

    it('PUT /api/settings updates watchDirs', async () => {
      const res = await req(app, '/api/settings', {
        method: 'PUT',
        headers: JSON_AUTH,
        body: JSON.stringify({ watchDirs: ['/media/videos', '/media/music'] }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.watchDirs).toEqual(['/media/videos', '/media/music'])
    })

    it('GET /api/settings reflects updated watchDirs', async () => {
      const res = await req(app, '/api/settings', { headers: AUTH })
      const body = await res.json() as any
      expect(body.watchDirs).toEqual(['/media/videos', '/media/music'])
    })

    it('GET /api/settings indexing.totalIndexed reflects seeded data', async () => {
      const res = await req(app, '/api/settings', { headers: AUTH })
      const body = await res.json() as any
      expect(body.indexing.totalIndexed).toBe(5)
    })
  })

  // ---------- Flow 6: File Metadata in Responses ----------

  describe('Flow 6: File Metadata in Responses', () => {
    beforeAll(() => {
      const now = new Date().toISOString()
      db.upsertFile({
        id: 'f-meta-audio', path: '/tmp/meta-song.mp3', name: 'meta-song.mp3',
        mime_type: 'audio/mpeg', size: 4000000, file_type: 'audio', modified_at: now,
        meta: JSON.stringify({ duration: 120, artist: 'Test Artist', album: 'Test Album' }),
        hash: 'hash-meta-audio',
      })
      db.upsertFile({
        id: 'f-meta-video', path: '/tmp/meta-movie.mp4', name: 'meta-movie.mp4',
        mime_type: 'video/mp4', size: 800000000, file_type: 'video', modified_at: now,
        meta: JSON.stringify({ duration: 3600, width: 1920, height: 1080 }),
        hash: 'hash-meta-video',
      })
      db.upsertFile({
        id: 'f-meta-image', path: '/tmp/meta-photo.jpg', name: 'meta-photo.jpg',
        mime_type: 'image/jpeg', size: 6000000, file_type: 'image', modified_at: now,
        meta: JSON.stringify({ width: 4000, height: 3000 }),
        hash: 'hash-meta-image',
      })
    })

    it('audio file response has duration, artist, album', async () => {
      const res = await req(app, '/api/files?type=audio', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      const audio = body.files.find((f: any) => f.id === 'f-meta-audio')
      expect(audio).toBeDefined()
      expect(audio.duration).toBe(120)
      expect(audio.artist).toBe('Test Artist')
      expect(audio.album).toBe('Test Album')
    })

    it('video file response has duration, width, height', async () => {
      const res = await req(app, '/api/files?type=video', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      const video = body.files.find((f: any) => f.id === 'f-meta-video')
      expect(video).toBeDefined()
      expect(video.duration).toBe(3600)
      expect(video.width).toBe(1920)
      expect(video.height).toBe(1080)
    })

    it('image file response has width, height', async () => {
      const res = await req(app, '/api/files?type=image', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      const image = body.files.find((f: any) => f.id === 'f-meta-image')
      expect(image).toBeDefined()
      expect(image.width).toBe(4000)
      expect(image.height).toBe(3000)
    })

    it('files with empty meta have no metadata fields', async () => {
      const res = await req(app, '/api/files', { headers: AUTH })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      // f-pdf-1 was seeded with meta: '{}'
      const pdf = body.files.find((f: any) => f.id === 'f-pdf-1')
      expect(pdf).toBeDefined()
      expect(pdf.duration).toBeUndefined()
      expect(pdf.artist).toBeUndefined()
      expect(pdf.album).toBeUndefined()
      expect(pdf.width).toBeUndefined()
      expect(pdf.height).toBeUndefined()
    })
  })

  // ---------- Flow 7: Chat Accepts History ----------

  describe('Flow 7: Chat Accepts History', () => {
    it('POST /api/chat with history returns 200 SSE stream', async () => {
      const res = await req(app, '/api/chat', {
        method: 'POST',
        headers: JSON_AUTH,
        body: JSON.stringify({
          message: 'hello',
          history: [
            { role: 'user', content: 'previous message' },
            { role: 'assistant', content: 'previous response' },
          ],
        }),
      })
      // Should not reject — 200 or streaming response
      expect(res.status).toBe(200)
    })
  })

  // ---------- Flow 5: Auth Enforcement ----------

  describe('Flow 5: Auth Enforcement', () => {
    it('GET /api/files without auth returns 401', async () => {
      const res = await req(app, '/api/files')
      expect(res.status).toBe(401)
      const body = await res.json() as any
      expect(body.error).toBe('Unauthorized')
    })

    it('POST /api/playlists without auth returns 401', async () => {
      const res = await req(app, '/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sneaky Playlist' }),
      })
      expect(res.status).toBe(401)
    })

    it('GET /api/health without auth returns 200 (exempt)', async () => {
      const res = await req(app, '/api/health')
      expect(res.status).toBe(200)
    })

    it('GET /api/files with query token returns 200', async () => {
      const res = await req(app, '/api/files?token=magpie-dev')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.files.length).toBeGreaterThan(0)
    })

    it('GET /api/files with wrong token returns 401', async () => {
      const res = await req(app, '/api/files?token=wrong-token')
      expect(res.status).toBe(401)
    })

    it('GET /api/conversations without auth returns 401', async () => {
      const res = await req(app, '/api/conversations')
      expect(res.status).toBe(401)
    })

    it('GET /api/settings without auth returns 401', async () => {
      const res = await req(app, '/api/settings')
      expect(res.status).toBe(401)
    })
  })

  // ---------- Flow 8: Stream route path traversal prevention ----------

  describe('Flow 8: Stream route path traversal prevention', () => {
    beforeAll(() => {
      // Create a valid HLS segment for baseline test
      mkdirSync(`${TEST_DIR}/hls-cache/valid-id`, { recursive: true })
      writeFileSync(`${TEST_DIR}/hls-cache/valid-id/segment0.ts`, 'fake-ts-data')
      writeFileSync(`${TEST_DIR}/hls-cache/valid-id/playlist.m3u8`, '#EXTM3U\n#EXT-X-TARGETDURATION:10\nfake')
    })

    it('GET /api/stream/valid-id/segment0.ts returns 200 for valid segment', async () => {
      const res = await req(app, '/api/stream/valid-id/segment0.ts', { headers: AUTH })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('video/mp2t')
    })

    it('GET /api/stream/valid-id/playlist.m3u8 returns 200 for valid playlist', async () => {
      const res = await req(app, '/api/stream/valid-id/playlist.m3u8', { headers: AUTH })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/vnd.apple.mpegurl')
    })

    it('segment with ../ traversal returns 400', async () => {
      const res = await req(app, '/api/stream/valid-id/..%2F..%2Fetc%2Fpasswd', { headers: AUTH })
      expect(res.status).toBe(400)
    })

    it('segment with backslash traversal returns 400', async () => {
      const res = await req(app, '/api/stream/valid-id/..%5C..%5Cetc%5Cpasswd', { headers: AUTH })
      expect(res.status).toBe(400)
    })

    it('id with ../ traversal returns 400', async () => {
      const res = await req(app, '/api/stream/..%2F..%2Fetc/segment0.ts', { headers: AUTH })
      expect(res.status).toBe(400)
    })

    it('id with traversal in playlist route returns 400', async () => {
      const res = await req(app, '/api/stream/..%2F..%2Fetc/playlist.m3u8', { headers: AUTH })
      expect(res.status).toBe(400)
    })

    it('nonexistent valid segment returns 404', async () => {
      const res = await req(app, '/api/stream/valid-id/nonexistent.ts', { headers: AUTH })
      expect(res.status).toBe(404)
    })
  })
})
