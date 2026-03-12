import { Hono } from 'hono'
import { existsSync } from 'fs'
import { join } from 'path'

export const thumbRoute = new Hono()

const DATA_DIR = process.env.DATA_DIR || './data'

thumbRoute.get('/thumb/:id', async (c) => {
  const { id } = c.req.param()
  const thumbPath = join(DATA_DIR, 'thumbs', `${id}.webp`)

  if (!existsSync(thumbPath)) {
    return c.json({ error: 'Thumbnail not found' }, 404)
  }

  const file = Bun.file(thumbPath)
  return new Response(file, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'max-age=86400',
    },
  })
})
