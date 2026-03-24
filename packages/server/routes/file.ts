import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const execAsync = promisify(exec)
const HEIC_EXTENSIONS = new Set(['.heic', '.heif'])

function isHeic(filePath: string): boolean {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase()
  return HEIC_EXTENSIONS.has(ext)
}

export function createFileRoute(db: MagpieDb) {
  const route = new Hono()

  route.get('/file/:id', async (c) => {
    const { id } = c.req.param()
    const record = db.getFileById(id)
    if (!record) return c.json({ error: 'File not found' }, 404)
    if (!existsSync(record.path)) return c.json({ error: 'File missing from disk' }, 404)

    // Convert HEIC to JPEG for browser compatibility
    if (isHeic(record.path)) {
      const dataDir = process.env.DATA_DIR || './data'
      const jpegPath = `${dataDir}/thumbs/${id}.converted.jpg`
      if (!existsSync(jpegPath)) {
        await execAsync(`sips -s format jpeg "${record.path}" --out "${jpegPath}"`)
      }
      const jpegFile = Bun.file(jpegPath)
      return new Response(jpegFile, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(jpegFile.size),
          'Cache-Control': 'max-age=86400',
        },
      })
    }

    const file = Bun.file(record.path)
    const fileSize = file.size
    const range = c.req.header('Range')
    const safeName = record.name.replace(/["\r\n\\]/g, '_')

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1])
        const end = match[2] ? parseInt(match[2]) : fileSize - 1
        const chunk = file.slice(start, end + 1)
        return new Response(chunk, {
          status: 206,
          headers: {
            'Content-Type': record.mime_type,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
            'Content-Disposition': `inline; filename="${safeName}"`,
          },
        })
      }
    }

    return new Response(file, {
      headers: {
        'Content-Type': record.mime_type,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${safeName}"`,
      },
    })
  })

  route.get('/file/:id/preview', async (c) => {
    const { id } = c.req.param()
    const record = db.getFileById(id)
    if (!record) return c.json({ error: 'File not found' }, 404)
    if (!existsSync(record.path)) return c.json({ error: 'File missing from disk' }, 404)

    if (record.file_type === 'pdf') {
      return c.redirect(`/api/file/${id}`)
    }

    if (record.mime_type.includes('wordprocessingml') || record.path.endsWith('.docx')) {
      const buffer = await Bun.file(record.path).arrayBuffer()
      const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#e5e7eb;background:#111827}img{max-width:100%}</style></head><body>${result.value}</body></html>`
      return c.html(html)
    }

    if (record.mime_type.includes('spreadsheetml') || record.path.endsWith('.xlsx')) {
      const buffer = await Bun.file(record.path).arrayBuffer()
      const workbook = XLSX.read(buffer)
      let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;color:#e5e7eb;background:#111827;padding:1rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #374151;padding:4px 8px;text-align:left}th{background:#1f2937}</style></head><body>'
      for (const name of workbook.SheetNames) {
        html += `<h2>${name}</h2>` + XLSX.utils.sheet_to_html(workbook.Sheets[name])
      }
      html += '</body></html>'
      return c.html(html)
    }

    return c.json({ error: 'Preview not supported for this file type' }, 404)
  })

  return route
}
