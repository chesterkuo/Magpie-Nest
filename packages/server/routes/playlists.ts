import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import type { MagpieDb } from '../services/db'
import { fileTypeToRenderType, type FileType } from '@magpie/shared'

export function createPlaylistsRoute(db: MagpieDb) {
  const route = new Hono()

  route.get('/playlists', (c) => {
    const playlists = db.listPlaylists()
    return c.json({
      playlists: playlists.map(p => ({
        id: p.id, name: p.name, trackCount: p.trackCount,
        createdAt: p.created_at, updatedAt: p.updated_at,
      })),
    })
  })

  route.post('/playlists', async (c) => {
    const { name } = await c.req.json<{ name: string }>()
    if (!name) return c.json({ error: 'Missing required field: name' }, 400)
    const id = nanoid()
    db.createPlaylist(id, name)
    return c.json({ id, name, trackCount: 0 }, 201)
  })

  route.get('/playlists/:id', (c) => {
    const { id } = c.req.param()
    const playlists = db.listPlaylists()
    const playlist = playlists.find(p => p.id === id)
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404)
    const items = db.getPlaylistItems(id).map(r => ({
      id: r.id, name: r.name, type: r.file_type as FileType,
      size: r.size, modified: r.modified_at,
      renderType: fileTypeToRenderType(r.file_type),
      streamUrl: `/api/stream/${r.id}`, thumbUrl: `/api/thumb/${r.id}`,
    }))
    return c.json({
      id: playlist.id, name: playlist.name, trackCount: playlist.trackCount,
      createdAt: playlist.created_at, updatedAt: playlist.updated_at, items,
    })
  })

  route.put('/playlists/:id', async (c) => {
    const { id } = c.req.param()
    const body = await c.req.json<{ name?: string }>()
    if (body.name) {
      db.db.prepare('UPDATE playlists SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(body.name, id)
    }
    return c.json({ id, name: body.name })
  })

  route.delete('/playlists/:id', (c) => {
    const { id } = c.req.param()
    db.deletePlaylist(id)
    return c.json({ ok: true })
  })

  route.post('/playlists/:id/items', async (c) => {
    const { id } = c.req.param()
    const { fileId, position } = await c.req.json<{ fileId: string; position: number }>()
    if (!fileId) return c.json({ error: 'Missing required field: fileId' }, 400)
    db.addToPlaylist(id, fileId, position ?? 0)
    db.db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(id)
    return c.json({ ok: true }, 201)
  })

  route.delete('/playlists/:id/items/:fileId', (c) => {
    const { id, fileId } = c.req.param()
    db.removeFromPlaylist(id, fileId)
    db.db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(id)
    return c.json({ ok: true })
  })

  return route
}
