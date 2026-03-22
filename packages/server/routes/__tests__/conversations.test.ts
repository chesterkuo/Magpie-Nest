import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb, type MagpieDb } from '../../services/db'
import { createConversationsRoute } from '../conversations'
import { authMiddleware } from '../../middleware/auth'
const AUTH = { Authorization: 'Bearer magpie-dev' }

function jsonHeaders(extra: Record<string, string> = {}) {
  return { 'Content-Type': 'application/json', ...AUTH, ...extra }
}

describe('Conversations API', () => {
  let db: MagpieDb
  let app: Hono

  beforeEach(() => {
    db = createDb(':memory:')
    app = new Hono()
    app.use('*', authMiddleware())
    app.route('/api', createConversationsRoute(db))
  })

  afterEach(() => {
    db.close()
  })

  it('requires auth (returns 401 without token)', async () => {
    const res = await app.request('/api/conversations')
    expect(res.status).toBe(401)
  })

  describe('PUT /api/conversations/:id', () => {
    it('saves a conversation', async () => {
      const messages = [{ role: 'user', text: 'Hello' }, { role: 'assistant', text: 'Hi there' }]
      const res = await app.request('/api/conversations/conv-1', {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ messages }),
      })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.id).toBe('conv-1')
    })

    it('returns 400 when messages is missing', async () => {
      const res = await app.request('/api/conversations/conv-bad', {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const data = await res.json() as any
      expect(data.error).toContain('messages')
    })
  })

  describe('GET /api/conversations/:id', () => {
    it('retrieves a saved conversation', async () => {
      const messages = [{ role: 'user', text: 'Find my photos' }]
      db.saveConversation('conv-get', JSON.stringify(messages))

      const res = await app.request('/api/conversations/conv-get', { headers: AUTH })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.id).toBe('conv-get')
      expect(data.messages).toEqual(messages)
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
    })

    it('returns 404 for nonexistent conversation', async () => {
      const res = await app.request('/api/conversations/nonexistent', { headers: AUTH })
      expect(res.status).toBe(404)
      const data = await res.json() as any
      expect(data.error).toContain('not found')
    })
  })

  describe('GET /api/conversations', () => {
    it('lists conversations', async () => {
      db.saveConversation('conv-list-1', JSON.stringify([{ role: 'user', text: 'First conversation' }]))
      db.saveConversation('conv-list-2', JSON.stringify([{ role: 'user', text: 'Second conversation' }]))

      const res = await app.request('/api/conversations', { headers: AUTH })
      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.conversations.length).toBe(2)
      expect(data.conversations[0].id).toBeDefined()
      expect(data.conversations[0].preview).toBeDefined()
      expect(data.conversations[0].messageCount).toBeDefined()
      expect(data.conversations[0].updatedAt).toBeDefined()
    })

    it('returns empty list when no conversations exist', async () => {
      const res = await app.request('/api/conversations', { headers: AUTH })
      const data = await res.json() as any
      expect(data.conversations).toEqual([])
    })

    it('respects limit query param', async () => {
      db.saveConversation('c-a', JSON.stringify([{ role: 'user', text: 'a' }]))
      db.saveConversation('c-b', JSON.stringify([{ role: 'user', text: 'b' }]))
      db.saveConversation('c-c', JSON.stringify([{ role: 'user', text: 'c' }]))

      const res = await app.request('/api/conversations?limit=2', { headers: AUTH })
      const data = await res.json() as any
      expect(data.conversations.length).toBe(2)
    })
  })
})
