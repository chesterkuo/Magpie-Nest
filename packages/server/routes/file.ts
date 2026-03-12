import { Hono } from 'hono'

export const fileRoute = new Hono()

fileRoute.get('/file/:id', async (c) => {
  const { id } = c.req.param()
  return c.json({ error: 'Not yet implemented', id }, 501)
})
