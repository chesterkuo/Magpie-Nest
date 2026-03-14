import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, type MagpieDb } from '../../services/db'
import { createHealthRoute } from '../health'
import { authMiddleware } from '../../middleware/auth'
import { unlinkSync } from 'fs'

const TEST_DB = '/tmp/magpie-route-health.db'

describe('GET /api/health', () => {
  let db: MagpieDb
  let app: Hono

  beforeEach(() => {
    db = createDb(TEST_DB)
    const mockVectorDb = { count: async () => 0 } as any
    app = new Hono()
    app.use('*', authMiddleware())
    app.route('/api', createHealthRoute(db, mockVectorDb, () => []))
  })

  afterEach(() => {
    db.close()
    try { unlinkSync(TEST_DB) } catch {}
  })

  it('returns 200 with status object', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toBeDefined()
  })

  it('contains required top-level fields', async () => {
    const res = await app.request('/api/health')
    const data = await res.json() as any
    expect(data.status).toBeDefined()
    expect(data.services).toBeDefined()
    expect(data.disk).toBeDefined()
    expect(data.uptime).toBeDefined()
    expect(data.version).toBeDefined()
  })

  it('contains all service statuses', async () => {
    const res = await app.request('/api/health')
    const data = await res.json() as any
    expect(data.services.ollama).toBeDefined()
    expect(data.services.lancedb).toBeDefined()
    expect(data.services.sqlite).toBeDefined()
    expect(data.services.whisper).toBeDefined()
    expect(data.services.kokoro).toBeDefined()
  })

  it('reports sqlite as ok when db is working', async () => {
    const res = await app.request('/api/health')
    const data = await res.json() as any
    expect(data.services.sqlite.status).toBe('ok')
    expect(data.services.sqlite.totalFiles).toBe(0)
  })

  it('reports degraded or error status when Ollama is not running', async () => {
    const res = await app.request('/api/health')
    const data = await res.json() as any
    // In test env, Ollama is not running so status should not be 'ok'
    expect(['error', 'degraded']).toContain(data.status)
  })

  it('does NOT require auth', async () => {
    // No Authorization header
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
  })

  it('returns version 1.0.0', async () => {
    const res = await app.request('/api/health')
    const data = await res.json() as any
    expect(data.version).toBe('1.0.0')
  })

  it('returns uptime as a number', async () => {
    const res = await app.request('/api/health')
    const data = await res.json() as any
    expect(typeof data.uptime).toBe('number')
    expect(data.uptime).toBeGreaterThanOrEqual(0)
  })
})
