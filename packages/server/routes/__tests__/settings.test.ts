import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, type MagpieDb } from '../../services/db'
import { createSettingsRoute } from '../settings'
import { authMiddleware } from '../../middleware/auth'
import { mkdirSync, writeFileSync, rmSync } from 'fs'

const AUTH = { Authorization: 'Bearer magpie-dev' }

function jsonHeaders(extra: Record<string, string> = {}) {
  return { 'Content-Type': 'application/json', ...AUTH, ...extra }
}

describe('Settings API', () => {
  let db: MagpieDb
  let app: Hono
  let watchDirs: string[]

  beforeEach(() => {
    db = createDb(':memory:')
    watchDirs = ['/tmp/watch1']
    app = new Hono()
    app.use('*', authMiddleware())
    const mockProviderManager = {
      getLLMProvider: () => ({
        healthCheck: async () => ({ status: 'ok', model: 'test', loaded: true }),
        name: () => 'mock',
        modelName: () => 'test',
      }),
      getEmbeddingProvider: () => ({
        embedSingle: async () => [0, 1, 2],
        name: () => 'mock',
        modelName: () => 'test',
        dimensions: () => 768,
      }),
      reload: () => {},
    } as any
    app.route('/api', createSettingsRoute(
      db,
      () => watchDirs,
      (dirs: string[]) => { watchDirs = dirs },
      mockProviderManager,
    ))
  })

  afterEach(() => {
    db.close()
  })

  it('requires auth (returns 401 without token)', async () => {
    const res = await app.request('/api/settings')
    expect(res.status).toBe(401)
  })

  describe('GET /api/settings', () => {
    it('returns settings shape', async () => {
      const res = await app.request('/api/settings', { headers: AUTH })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.watchDirs).toBeDefined()
      expect(Array.isArray(data.watchDirs)).toBe(true)
      expect(data.indexing).toBeDefined()
      expect(data.indexing.queueLength).toBeDefined()
      expect(data.indexing.totalIndexed).toBeDefined()
      expect(data.llm).toBeDefined()
      expect(data.llm.provider).toBeDefined()
      expect(data.embedding).toBeDefined()
      expect(data.embedding.provider).toBeDefined()
      expect(data.version).toBe('1.0.0')
    })

    it('reflects current watch dirs', async () => {
      const res = await app.request('/api/settings', { headers: AUTH })
      const data = await res.json() as any
      expect(data.watchDirs).toEqual(['/tmp/watch1'])
    })
  })

  describe('PUT /api/settings', () => {
    it('updates watch dirs', async () => {
      const res = await app.request('/api/settings', {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ watchDirs: ['/tmp/new-watch'] }),
      })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.watchDirs).toEqual(['/tmp/new-watch'])
    })

    it('returns updated settings after change', async () => {
      await app.request('/api/settings', {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ watchDirs: ['/tmp/updated'] }),
      })
      // Verify with GET
      const res = await app.request('/api/settings', { headers: AUTH })
      const data = await res.json() as any
      expect(data.watchDirs).toEqual(['/tmp/updated'])
    })
  })

  describe('POST /api/index/trigger', () => {
    it('returns 400 when path is missing', async () => {
      const res = await app.request('/api/index/trigger', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const data = await res.json() as any
      expect(data.error).toContain('path')
    })

    it('returns 404 when path does not exist', async () => {
      const res = await app.request('/api/index/trigger', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ path: '/tmp/nonexistent-magpie-dir-xyz' }),
      })
      expect(res.status).toBe(404)
      const data = await res.json() as any
      expect(data.error).toContain('does not exist')
    })

    it('enqueues files from an existing directory', async () => {
      const testDir = '/tmp/magpie-index-test'
      try { rmSync(testDir, { recursive: true }) } catch {}
      mkdirSync(testDir, { recursive: true })
      writeFileSync(`${testDir}/file1.txt`, 'hello')
      writeFileSync(`${testDir}/file2.txt`, 'world')

      const res = await app.request('/api/index/trigger', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ path: testDir }),
      })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.queued).toBe(2)

      // Cleanup
      try { rmSync(testDir, { recursive: true }) } catch {}
    })
  })
})
