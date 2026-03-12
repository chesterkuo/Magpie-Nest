import { Hono } from 'hono'

const app = new Hono()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default {
  port: 8000,
  fetch: app.fetch,
}
