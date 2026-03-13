import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, type MagpieDb } from '../../services/db'
import { createFilesRoute } from '../files'
import { authMiddleware } from '../../middleware/auth'
import { unlinkSync } from 'fs'

const TEST_DB = '/tmp/magpie-route-files.db'
const AUTH = { Authorization: 'Bearer magpie-dev' }

function seedFile(db: MagpieDb, overrides: Partial<any> = {}) {
  const defaults = {
    id: 'test-1',
    path: '/tmp/test-file.txt',
    name: 'test-file.txt',
    mime_type: 'text/plain',
    size: 100,
    modified_at: '2026-03-10T00:00:00Z',
    file_type: 'doc',
    meta: '{}',
    hash: 'abc123',
  }
  db.upsertFile({ ...defaults, ...overrides })
}

describe('GET /api/files', () => {
  let db: MagpieDb
  let app: Hono

  beforeEach(() => {
    db = createDb(TEST_DB)
    app = new Hono()
    app.use('*', authMiddleware())
    app.route('/api', createFilesRoute(db))
  })

  afterEach(() => {
    db.close()
    try { unlinkSync(TEST_DB) } catch {}
  })

  it('requires auth (returns 401 without token)', async () => {
    const res = await app.request('/api/files')
    expect(res.status).toBe(401)
  })

  it('returns empty files list', async () => {
    const res = await app.request('/api/files', { headers: AUTH })
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.files).toEqual([])
    expect(data.total).toBe(0)
    expect(data.limit).toBe(50)
    expect(data.offset).toBe(0)
  })

  it('returns paginated files with correct shape', async () => {
    seedFile(db, { id: 'f1', path: '/tmp/f1.txt', name: 'f1.txt' })
    seedFile(db, { id: 'f2', path: '/tmp/f2.txt', name: 'f2.txt' })

    const res = await app.request('/api/files', { headers: AUTH })
    const data = await res.json() as any
    expect(data.files.length).toBe(2)
    expect(data.total).toBe(2)
    // Check file shape
    const file = data.files[0]
    expect(file.id).toBeDefined()
    expect(file.name).toBeDefined()
    expect(file.type).toBeDefined()
    expect(file.size).toBeDefined()
    expect(file.modified).toBeDefined()
    expect(file.renderType).toBeDefined()
    expect(file.streamUrl).toBeDefined()
    expect(file.thumbUrl).toBeDefined()
  })

  it('filters by type query param', async () => {
    seedFile(db, { id: 'v1', path: '/tmp/v1.mp4', name: 'v1.mp4', file_type: 'video', mime_type: 'video/mp4' })
    seedFile(db, { id: 'd1', path: '/tmp/d1.txt', name: 'd1.txt', file_type: 'doc', mime_type: 'text/plain' })

    const res = await app.request('/api/files?type=video', { headers: AUTH })
    const data = await res.json() as any
    expect(data.files.length).toBe(1)
    expect(data.files[0].type).toBe('video')
    expect(data.total).toBe(1)
  })

  it('sorts by name ascending', async () => {
    seedFile(db, { id: 'z1', path: '/tmp/z.txt', name: 'z.txt' })
    seedFile(db, { id: 'a1', path: '/tmp/a.txt', name: 'a.txt' })

    const res = await app.request('/api/files?sort=name&order=asc', { headers: AUTH })
    const data = await res.json() as any
    expect(data.files[0].name).toBe('a.txt')
    expect(data.files[1].name).toBe('z.txt')
  })

  it('sorts by size descending', async () => {
    seedFile(db, { id: 's1', path: '/tmp/s1.txt', name: 'small.txt', size: 10 })
    seedFile(db, { id: 's2', path: '/tmp/s2.txt', name: 'big.txt', size: 9999 })

    const res = await app.request('/api/files?sort=size&order=desc', { headers: AUTH })
    const data = await res.json() as any
    expect(data.files[0].name).toBe('big.txt')
  })

  it('respects limit and offset for pagination', async () => {
    seedFile(db, { id: 'p1', path: '/tmp/p1.txt', name: 'p1.txt', modified_at: '2026-03-01T00:00:00Z' })
    seedFile(db, { id: 'p2', path: '/tmp/p2.txt', name: 'p2.txt', modified_at: '2026-03-02T00:00:00Z' })
    seedFile(db, { id: 'p3', path: '/tmp/p3.txt', name: 'p3.txt', modified_at: '2026-03-03T00:00:00Z' })

    const res = await app.request('/api/files?limit=1&offset=1&sort=modified_at&order=asc', { headers: AUTH })
    const data = await res.json() as any
    expect(data.files.length).toBe(1)
    expect(data.files[0].name).toBe('p2.txt')
    expect(data.total).toBe(3)
    expect(data.limit).toBe(1)
    expect(data.offset).toBe(1)
  })

  it('maps file_type to correct renderType', async () => {
    seedFile(db, { id: 'rt1', path: '/tmp/rt1.mp4', name: 'rt1.mp4', file_type: 'video', mime_type: 'video/mp4' })
    seedFile(db, { id: 'rt2', path: '/tmp/rt2.mp3', name: 'rt2.mp3', file_type: 'audio', mime_type: 'audio/mpeg' })

    const res = await app.request('/api/files?sort=name&order=asc', { headers: AUTH })
    const data = await res.json() as any
    const video = data.files.find((f: any) => f.type === 'video')
    const audio = data.files.find((f: any) => f.type === 'audio')
    expect(video.renderType).toBe('video_card')
    expect(audio.renderType).toBe('audio_player')
  })
})
