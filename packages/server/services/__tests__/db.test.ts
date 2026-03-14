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

  it('dequeuePending does not return same items twice (atomicity)', () => {
    db.enqueue('/tmp/atomic1.pdf', 'created')
    db.enqueue('/tmp/atomic2.pdf', 'created')
    const first = db.dequeuePending(5)
    const second = db.dequeuePending(5)
    expect(first.length).toBe(2)
    // Second call should return nothing — items are already 'processing'
    expect(second.length).toBe(0)
  })

  it('dequeuePending returns empty when no pending items exist', () => {
    const jobs = db.dequeuePending(5)
    expect(jobs.length).toBe(0)
  })

  describe('playlists', () => {
    it('creates and lists playlists', () => {
      db.createPlaylist('pl-1', 'My Playlist')
      const playlists = db.listPlaylists()
      expect(playlists.length).toBe(1)
      expect(playlists[0].name).toBe('My Playlist')
    })

    it('adds items to playlist and retrieves them', () => {
      db.upsertFile({ id: 'f1', path: '/tmp/song.mp3', name: 'song.mp3', mime_type: 'audio/mpeg', size: 5000, modified_at: '2026-01-01T00:00:00Z', file_type: 'audio', meta: '{}', hash: 'a1' })
      db.createPlaylist('pl-2', 'Jazz')
      db.addToPlaylist('pl-2', 'f1', 0)
      const items = db.getPlaylistItems('pl-2')
      expect(items.length).toBe(1)
      expect(items[0].name).toBe('song.mp3')
    })

    it('removes items from playlist', () => {
      db.upsertFile({ id: 'f2', path: '/tmp/song2.mp3', name: 'song2.mp3', mime_type: 'audio/mpeg', size: 5000, modified_at: '2026-01-01T00:00:00Z', file_type: 'audio', meta: '{}', hash: 'a2' })
      db.createPlaylist('pl-3', 'Rock')
      db.addToPlaylist('pl-3', 'f2', 0)
      db.removeFromPlaylist('pl-3', 'f2')
      expect(db.getPlaylistItems('pl-3').length).toBe(0)
    })

    it('deletes playlist cascades items', () => {
      db.upsertFile({ id: 'f3', path: '/tmp/song3.mp3', name: 'song3.mp3', mime_type: 'audio/mpeg', size: 5000, modified_at: '2026-01-01T00:00:00Z', file_type: 'audio', meta: '{}', hash: 'a3' })
      db.createPlaylist('pl-4', 'Temp')
      db.addToPlaylist('pl-4', 'f3', 0)
      db.deletePlaylist('pl-4')
      expect(db.listPlaylists().filter(p => p.id === 'pl-4').length).toBe(0)
    })
  })

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
      const c3 = list.find(c => c.id === 'c-3')
      expect(c3).toBeDefined()
      expect(c3!.messageCount).toBe(2)
    })
  })

  describe('listFiles', () => {
    beforeEach(() => {
      db.upsertFile({ id: 'lf-1', path: '/tmp/a.mp4', name: 'a.mp4', mime_type: 'video/mp4', size: 1000, modified_at: '2026-03-10T00:00:00Z', file_type: 'video', meta: '{}', hash: 'x1' })
      db.upsertFile({ id: 'lf-2', path: '/tmp/b.pdf', name: 'b.pdf', mime_type: 'application/pdf', size: 500, modified_at: '2026-03-12T00:00:00Z', file_type: 'pdf', meta: '{}', hash: 'x2' })
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
})
