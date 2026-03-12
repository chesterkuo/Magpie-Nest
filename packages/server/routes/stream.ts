import { Hono } from 'hono'
import { existsSync } from 'fs'
import { join } from 'path'

export const streamRoute = new Hono()

const DATA_DIR = process.env.DATA_DIR || './data'

streamRoute.get('/stream/:id/playlist.m3u8', async (c) => {
  const { id } = c.req.param()
  const playlistPath = join(DATA_DIR, 'hls-cache', id, 'playlist.m3u8')

  if (!existsSync(playlistPath)) {
    return c.json({ error: 'Playlist not found' }, 404)
  }

  const content = await Bun.file(playlistPath).text()
  return c.text(content, 200, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-cache',
  })
})

streamRoute.get('/stream/:id/:segment', async (c) => {
  const { id, segment } = c.req.param()
  const segPath = join(DATA_DIR, 'hls-cache', id, segment)

  if (!existsSync(segPath)) {
    return c.json({ error: 'Segment not found' }, 404)
  }

  const file = Bun.file(segPath)
  return new Response(file, {
    headers: {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'max-age=86400',
    },
  })
})
