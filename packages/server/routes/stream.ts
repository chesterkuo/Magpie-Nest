import { Hono } from 'hono'
import { existsSync } from 'fs'
import { join, resolve, basename } from 'path'
import { ensureHls } from '../services/hls'
import type { MagpieDb } from '../services/db'

function getDataDir(): string {
  return process.env.DATA_DIR || './data'
}

/** Return true if the value is a safe path segment (no traversal). */
function isSafeSegment(value: string): boolean {
  if (!value || value !== basename(value)) return false
  if (value.includes('..') || value.includes('/') || value.includes('\\')) return false
  return true
}

export function createStreamRoute(db: MagpieDb) {
  const route = new Hono()

route.get('/stream/:id/playlist.m3u8', async (c) => {
  const { id } = c.req.param()

  if (!isSafeSegment(id)) {
    return c.json({ error: 'Invalid stream id' }, 400)
  }

  const hlsCacheDir = resolve(getDataDir(), 'hls-cache')
  const playlistPath = join(hlsCacheDir, id, 'playlist.m3u8')
  const resolved = resolve(playlistPath)

  // If not cached, transcode on demand
  if (!existsSync(resolved)) {
    const file = db.getFileById(id)
    if (!file) return c.json({ error: 'File not found' }, 404)
    try {
      await ensureHls(id, file.path, getDataDir())
    } catch (err: any) {
      console.error(`[stream] HLS transcode failed for ${id}:`, err.message)
      return c.json({ error: 'Transcode failed' }, 500)
    }
  }

  if (!existsSync(resolved)) {
    return c.json({ error: 'Playlist not found' }, 404)
  }

  const content = await Bun.file(resolved).text()
  return c.text(content, 200, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-cache',
  })
})

route.get('/stream/:id/:segment', async (c) => {
  const { id, segment } = c.req.param()

  if (!isSafeSegment(id)) {
    return c.json({ error: 'Invalid stream id' }, 400)
  }

  if (!isSafeSegment(segment)) {
    return c.json({ error: 'Invalid segment name' }, 400)
  }

  const hlsCacheDir = resolve(getDataDir(), 'hls-cache')
  const segPath = join(hlsCacheDir, id, segment)
  const resolved = resolve(segPath)

  if (!resolved.startsWith(hlsCacheDir)) {
    return c.json({ error: 'Invalid segment path' }, 400)
  }

  if (!existsSync(resolved)) {
    return c.json({ error: 'Segment not found' }, 404)
  }

  const file = Bun.file(resolved)
  return new Response(file, {
    headers: {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'max-age=86400',
    },
  })
})

  return route
}
