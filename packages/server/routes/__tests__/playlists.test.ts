import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, type MagpieDb } from '../../services/db'
import { createPlaylistsRoute } from '../playlists'
import { authMiddleware } from '../../middleware/auth'
import { unlinkSync } from 'fs'

const TEST_DB = '/tmp/magpie-route-playlists.db'
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

function jsonHeaders(extra: Record<string, string> = {}) {
  return { 'Content-Type': 'application/json', ...AUTH, ...extra }
}

describe('Playlists API', () => {
  let db: MagpieDb
  let app: Hono

  beforeEach(() => {
    db = createDb(TEST_DB)
    app = new Hono()
    app.use('*', authMiddleware())
    app.route('/api', createPlaylistsRoute(db))
  })

  afterEach(() => {
    db.close()
    try { unlinkSync(TEST_DB) } catch {}
  })

  it('requires auth (returns 401 without token)', async () => {
    const res = await app.request('/api/playlists')
    expect(res.status).toBe(401)
  })

  describe('GET /api/playlists', () => {
    it('returns empty list initially', async () => {
      const res = await app.request('/api/playlists', { headers: AUTH })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.playlists).toEqual([])
    })

    it('returns playlists after creation', async () => {
      db.createPlaylist('pl-1', 'My Playlist')
      const res = await app.request('/api/playlists', { headers: AUTH })
      const data = await res.json() as any
      expect(data.playlists.length).toBe(1)
      expect(data.playlists[0].name).toBe('My Playlist')
      expect(data.playlists[0].trackCount).toBe(0)
    })
  })

  describe('POST /api/playlists', () => {
    it('creates a playlist and returns 201', async () => {
      const res = await app.request('/api/playlists', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ name: 'New Playlist' }),
      })
      expect(res.status).toBe(201)
      const data = await res.json() as any
      expect(data.id).toBeDefined()
      expect(data.name).toBe('New Playlist')
      expect(data.trackCount).toBe(0)
    })

    it('returns 400 when name is missing', async () => {
      const res = await app.request('/api/playlists', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const data = await res.json() as any
      expect(data.error).toContain('name')
    })
  })

  describe('GET /api/playlists/:id', () => {
    it('returns playlist with items', async () => {
      db.createPlaylist('pl-get', 'Fetch Me')
      seedFile(db, { id: 'song-1', path: '/tmp/s1.mp3', name: 's1.mp3', file_type: 'audio', mime_type: 'audio/mpeg' })
      db.addToPlaylist('pl-get', 'song-1', 0)

      const res = await app.request('/api/playlists/pl-get', { headers: AUTH })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.id).toBe('pl-get')
      expect(data.name).toBe('Fetch Me')
      expect(data.items.length).toBe(1)
      expect(data.items[0].name).toBe('s1.mp3')
    })

    it('returns 404 for nonexistent playlist', async () => {
      const res = await app.request('/api/playlists/nonexistent', { headers: AUTH })
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/playlists/:id', () => {
    it('renames a playlist', async () => {
      db.createPlaylist('pl-rename', 'Old Name')
      const res = await app.request('/api/playlists/pl-rename', {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ name: 'New Name' }),
      })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.name).toBe('New Name')
    })
  })

  describe('DELETE /api/playlists/:id', () => {
    it('deletes a playlist', async () => {
      db.createPlaylist('pl-del', 'To Delete')
      const res = await app.request('/api/playlists/pl-del', {
        method: 'DELETE',
        headers: AUTH,
      })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.ok).toBe(true)

      // Verify it's gone
      const list = await app.request('/api/playlists', { headers: AUTH })
      const listData = await list.json() as any
      expect(listData.playlists.find((p: any) => p.id === 'pl-del')).toBeUndefined()
    })
  })

  describe('POST /api/playlists/:id/items', () => {
    it('adds a file to playlist', async () => {
      db.createPlaylist('pl-add', 'Add Items')
      seedFile(db, { id: 'file-add', path: '/tmp/add.mp3', name: 'add.mp3', file_type: 'audio' })

      const res = await app.request('/api/playlists/pl-add/items', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ fileId: 'file-add', position: 0 }),
      })
      expect(res.status).toBe(201)
      const data = await res.json() as any
      expect(data.ok).toBe(true)

      // Verify item was added
      const getRes = await app.request('/api/playlists/pl-add', { headers: AUTH })
      const getData = await getRes.json() as any
      expect(getData.items.length).toBe(1)
    })

    it('returns 400 when fileId is missing', async () => {
      db.createPlaylist('pl-noid', 'No ID')
      const res = await app.request('/api/playlists/pl-noid/items', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/playlists/:id/items/:fileId', () => {
    it('removes a file from playlist', async () => {
      db.createPlaylist('pl-rm', 'Remove Items')
      seedFile(db, { id: 'file-rm', path: '/tmp/rm.mp3', name: 'rm.mp3', file_type: 'audio' })
      db.addToPlaylist('pl-rm', 'file-rm', 0)

      const res = await app.request('/api/playlists/pl-rm/items/file-rm', {
        method: 'DELETE',
        headers: AUTH,
      })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.ok).toBe(true)

      // Verify item was removed
      const getRes = await app.request('/api/playlists/pl-rm', { headers: AUTH })
      const getData = await getRes.json() as any
      expect(getData.items.length).toBe(0)
    })
  })
})
