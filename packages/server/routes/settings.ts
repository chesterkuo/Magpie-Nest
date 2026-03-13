import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

export function createSettingsRoute(db: MagpieDb, getWatchDirs: () => string[], setWatchDirs: (dirs: string[]) => void) {
  const route = new Hono()

  route.get('/settings', (c) => {
    const queueLength = (db.db.prepare("SELECT COUNT(*) as count FROM index_queue WHERE status = 'pending'").get() as { count: number }).count
    const totalIndexed = (db.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }).count
    const lastRow = db.db.prepare('SELECT indexed_at FROM files ORDER BY indexed_at DESC LIMIT 1').get() as { indexed_at: string } | null

    return c.json({
      watchDirs: getWatchDirs(),
      indexing: {
        queueLength,
        totalIndexed,
        lastIndexedAt: lastRow?.indexed_at ?? null,
      },
      version: '1.0.0',
    })
  })

  route.put('/settings', async (c) => {
    const body = await c.req.json<{ watchDirs?: string[] }>()
    if (body.watchDirs) {
      setWatchDirs(body.watchDirs)
    }
    // Return updated settings
    const queueLength = (db.db.prepare("SELECT COUNT(*) as count FROM index_queue WHERE status = 'pending'").get() as { count: number }).count
    const totalIndexed = (db.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }).count
    const lastRow = db.db.prepare('SELECT indexed_at FROM files ORDER BY indexed_at DESC LIMIT 1').get() as { indexed_at: string } | null

    return c.json({
      watchDirs: getWatchDirs(),
      indexing: {
        queueLength,
        totalIndexed,
        lastIndexedAt: lastRow?.indexed_at ?? null,
      },
      version: '1.0.0',
    })
  })

  route.post('/index/trigger', async (c) => {
    const { path } = await c.req.json<{ path: string }>()
    if (!path) return c.json({ error: 'Missing required field: path' }, 400)
    const resolved = resolve(path)
    if (!existsSync(resolved)) return c.json({ error: 'Path does not exist' }, 404)

    // Recursively find files and enqueue them
    let queued = 0
    function enqueueDir(dir: string) {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.')) enqueueDir(full)
        } else {
          db.enqueue(full, 'created')
          queued++
        }
      }
    }
    enqueueDir(resolved)
    return c.json({ queued })
  })

  return route
}
