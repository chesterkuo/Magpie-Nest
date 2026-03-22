import type { MiddlewareHandler } from 'hono'

export function authMiddleware(): MiddlewareHandler {
  const token = process.env.API_SECRET || 'magpie-dev'

  return async (c, next) => {
    // Public routes: health, media streams, thumbnails (protected by unpredictable IDs)
    if (c.req.path === '/api/health') return next()
    if (c.req.path.startsWith('/api/stream/')) return next()
    if (c.req.path.startsWith('/api/thumb/')) return next()

    const auth = c.req.header('Authorization')
    if (auth === `Bearer ${token}`) return next()

    const queryToken = c.req.query('token')
    if (queryToken === token) return next()

    return c.json({ error: 'Unauthorized' }, 401)
  }
}
