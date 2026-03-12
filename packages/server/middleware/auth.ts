import type { MiddlewareHandler } from 'hono'

export function authMiddleware(): MiddlewareHandler {
  const token = process.env.API_SECRET || 'magpie-dev'

  return async (c, next) => {
    if (c.req.path === '/api/health') return next()

    const auth = c.req.header('Authorization')
    if (auth === `Bearer ${token}`) return next()

    const queryToken = c.req.query('token')
    if (queryToken === token) return next()

    return c.json({ error: 'Unauthorized' }, 401)
  }
}
