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
})
