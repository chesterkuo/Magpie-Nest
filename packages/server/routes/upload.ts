import { Hono } from 'hono'
import { join, extname, basename } from 'path'
import { existsSync } from 'fs'
import type { MagpieDb } from '../services/db'

export function createUploadRoute(db: MagpieDb, getWatchDirs: () => string[]) {
  const route = new Hono()

  route.post('/upload', async (c) => {
    const body = await c.req.parseBody({ all: true })
    const rawFiles = body['files']
    if (!rawFiles) return c.json({ error: 'No files provided' }, 400)

    const files = Array.isArray(rawFiles) ? rawFiles : [rawFiles]
    const uploadFiles = files.filter((f): f is File => f instanceof File)
    if (uploadFiles.length === 0) return c.json({ error: 'No files provided' }, 400)

    const destDir = getWatchDirs()[0]
    if (!destDir) return c.json({ error: 'No watch directory configured' }, 500)

    const results: Array<{ name: string; path: string; size: number; status: string; error?: string }> = []

    for (const file of uploadFiles) {
      try {
        const destPath = resolveUniquePath(destDir, file.name)
        const buffer = await file.arrayBuffer()
        await Bun.write(destPath, buffer)

        db.enqueue(destPath, 'created')

        results.push({
          name: basename(destPath),
          path: destPath,
          size: file.size,
          status: 'ok',
        })
      } catch (err: any) {
        results.push({
          name: file.name,
          path: '',
          size: file.size,
          status: 'error',
          error: err.message,
        })
      }
    }

    return c.json({ uploaded: results })
  })

  return route
}

function resolveUniquePath(dir: string, fileName: string): string {
  let destPath = join(dir, fileName)
  if (!existsSync(destPath)) return destPath

  const ext = extname(fileName)
  const base = basename(fileName, ext)
  let counter = 1
  while (existsSync(destPath)) {
    destPath = join(dir, `${base} (${counter})${ext}`)
    counter++
  }
  return destPath
}
