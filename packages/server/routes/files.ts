import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import type { FileType, RenderType } from '@magpie/shared'

function fileTypeToRenderType(type: string): RenderType {
  const map: Record<string, RenderType> = {
    video: 'video_card', audio: 'audio_player', pdf: 'pdf_preview',
    image: 'image_grid', doc: 'file_list',
  }
  return map[type] || 'file_list'
}

export function createFilesRoute(db: MagpieDb) {
  const route = new Hono()

  route.get('/files', (c) => {
    const sort = (c.req.query('sort') || 'modified_at') as 'modified_at' | 'name' | 'size'
    const order = (c.req.query('order') || 'desc') as 'asc' | 'desc'
    const file_type = c.req.query('type')
    const days = c.req.query('days') ? Number(c.req.query('days')) : undefined
    const limit = Number(c.req.query('limit') || '50')
    const offset = Number(c.req.query('offset') || '0')

    const result = db.listFiles({ limit, offset, sort, order, file_type, days })
    const files = result.files.map(r => ({
      id: r.id, name: r.name, type: r.file_type as FileType,
      size: r.size, modified: r.modified_at,
      renderType: fileTypeToRenderType(r.file_type),
      streamUrl: `/api/stream/${r.id}`, thumbUrl: `/api/thumb/${r.id}`,
    }))

    return c.json({ files, total: result.total, limit, offset })
  })

  return route
}
