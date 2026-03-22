import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, type MagpieDb } from '../../services/db'
import { createFileRoute } from '../file'
import { authMiddleware } from '../../middleware/auth'
import { unlinkSync, writeFileSync, rmSync } from 'fs'

const TEST_FILE_PATH = '/tmp/magpie-test-serve-file.txt'
const TEST_PDF_PATH = '/tmp/magpie-test-serve-file.pdf'
const AUTH = { Authorization: 'Bearer magpie-dev' }

function seedFile(db: MagpieDb, overrides: Partial<any> = {}) {
  const defaults = {
    id: 'test-1',
    path: TEST_FILE_PATH,
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

describe('File API', () => {
  let db: MagpieDb
  let app: Hono

  beforeEach(() => {
    db = createDb(':memory:')
    app = new Hono()
    app.use('*', authMiddleware())
    app.route('/api', createFileRoute(db))

    // Create actual test files on disk
    writeFileSync(TEST_FILE_PATH, 'Hello, this is test file content for serving.')
    writeFileSync(TEST_PDF_PATH, '%PDF-1.4 fake pdf content for testing')
  })

  afterEach(() => {
    db.close()
    try { unlinkSync(TEST_FILE_PATH) } catch {}
    try { unlinkSync(TEST_PDF_PATH) } catch {}
  })

  it('requires auth (returns 401 without token)', async () => {
    const res = await app.request('/api/file/test-1')
    expect(res.status).toBe(401)
  })

  describe('GET /api/file/:id', () => {
    it('serves file content', async () => {
      seedFile(db)
      const res = await app.request('/api/file/test-1', { headers: AUTH })
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('Hello, this is test file content for serving.')
      expect(res.headers.get('Content-Type')).toBe('text/plain')
      expect(res.headers.get('Accept-Ranges')).toBe('bytes')
      expect(res.headers.get('Content-Disposition')).toContain('test-file.txt')
    })

    it('returns 404 for unknown ID', async () => {
      const res = await app.request('/api/file/nonexistent', { headers: AUTH })
      expect(res.status).toBe(404)
      const data = await res.json() as any
      expect(data.error).toContain('not found')
    })

    it('returns 404 when file is missing from disk', async () => {
      seedFile(db, { id: 'missing', path: '/tmp/magpie-no-such-file.txt', name: 'missing.txt' })
      const res = await app.request('/api/file/missing', { headers: AUTH })
      expect(res.status).toBe(404)
      const data = await res.json() as any
      expect(data.error).toContain('missing')
    })

    it('returns 206 partial content with Range header', async () => {
      seedFile(db)
      const res = await app.request('/api/file/test-1', {
        headers: { ...AUTH, Range: 'bytes=0-4' },
      })
      expect(res.status).toBe(206)
      const text = await res.text()
      expect(text).toBe('Hello')
      expect(res.headers.get('Content-Range')).toMatch(/^bytes 0-4\//)
      expect(res.headers.get('Content-Length')).toBe('5')
    })

    it('handles Range header for middle of file', async () => {
      seedFile(db)
      const res = await app.request('/api/file/test-1', {
        headers: { ...AUTH, Range: 'bytes=7-10' },
      })
      expect(res.status).toBe(206)
      const text = await res.text()
      expect(text).toBe('this')
    })
  })

  describe('GET /api/file/:id/preview', () => {
    it('redirects for PDF files', async () => {
      seedFile(db, {
        id: 'pdf-1',
        path: TEST_PDF_PATH,
        name: 'test.pdf',
        mime_type: 'application/pdf',
        file_type: 'pdf',
      })
      const res = await app.request('/api/file/pdf-1/preview', {
        headers: AUTH,
        redirect: 'manual',
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/api/file/pdf-1')
    })

    it('returns 404 for unsupported file type', async () => {
      seedFile(db, { id: 'img-1', path: TEST_FILE_PATH, name: 'photo.jpg', file_type: 'image', mime_type: 'image/jpeg' })
      const res = await app.request('/api/file/img-1/preview', { headers: AUTH })
      expect(res.status).toBe(404)
      const data = await res.json() as any
      expect(data.error).toContain('not supported')
    })

    it('returns 404 for nonexistent file', async () => {
      const res = await app.request('/api/file/nonexistent/preview', { headers: AUTH })
      expect(res.status).toBe(404)
    })
  })
})
