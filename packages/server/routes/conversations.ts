import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'

export function createConversationsRoute(db: MagpieDb) {
  const route = new Hono()

  route.put('/conversations/:id', async (c) => {
    const { id } = c.req.param()
    const { messages } = await c.req.json<{ messages: any[] }>()
    if (!messages) return c.json({ error: 'Missing required field: messages' }, 400)
    db.saveConversation(id, JSON.stringify(messages))
    return c.json({ id })
  })

  route.get('/conversations', (c) => {
    const limit = Number(c.req.query('limit') || '50')
    const conversations = db.listConversations(limit)
    return c.json({ conversations })
  })

  route.get('/conversations/:id', (c) => {
    const { id } = c.req.param()
    const conv = db.getConversation(id)
    if (!conv) return c.json({ error: 'Conversation not found' }, 404)
    return c.json({
      id: conv.id,
      messages: JSON.parse(conv.messages),
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    })
  })

  route.delete('/conversations/:id', (c) => {
    const { id } = c.req.param()
    const deleted = db.deleteConversation(id)
    if (!deleted) return c.json({ error: 'Conversation not found' }, 404)
    return c.json({ ok: true })
  })

  route.delete('/conversations', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>()
    if (!ids?.length) return c.json({ error: 'ids array is required' }, 400)
    const deleted = db.deleteConversations(ids)
    return c.json({ deleted })
  })

  return route
}
