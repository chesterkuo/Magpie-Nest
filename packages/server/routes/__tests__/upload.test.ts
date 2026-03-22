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
    const form1 = new FormData()
    form1.append('files', new File(['first'], 'dup.txt', { type: 'text/plain' }))
    await app.request('/api/upload', { method: 'POST', headers: AUTH, body: form1 })

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
