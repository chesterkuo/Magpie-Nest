import { type MagpieDb } from './db'
import { type VectorDb } from './lancedb'
import { extractText, chunkText, detectFileType } from './extractor'
import { generateThumb } from './thumbnail'
import { extractMetadata } from './metadata'
import { nanoid } from 'nanoid'
import { statSync } from 'fs'
import { basename } from 'path'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

const DATA_DIR = process.env.DATA_DIR || './data'

export async function processFile(
  filePath: string,
  db: MagpieDb,
  vectorDb: VectorDb,
  embed: (texts: string[]) => Promise<number[][]>
): Promise<void> {
  const stat = statSync(filePath)
  const name = basename(filePath)

  // Quick hash of first 64KB for change detection
  const buf = await readFile(filePath)
  const hash = createHash('md5').update(buf.subarray(0, 65536)).digest('hex')

  // Check if already indexed with same hash
  const existing = db.getFileByPath(filePath)
  if (existing && existing.hash === hash) return

  const fileId = existing?.id || nanoid()
  const mime = detectMime(name)
  const fileType = detectFileType(name, mime)

  // Extract text
  const text = await extractText(filePath, mime, fileType)

  // Extract structured metadata
  let meta: Record<string, any> = {}
  try {
    meta = await extractMetadata(filePath, fileType)
  } catch {}

  // Upsert file record
  db.upsertFile({
    id: fileId,
    path: filePath,
    name,
    mime_type: mime,
    size: stat.size,
    modified_at: stat.mtime.toISOString(),
    file_type: fileType,
    meta: JSON.stringify(meta),
    hash,
  })

  // Generate thumbnail
  try {
    await generateThumb(filePath, `${DATA_DIR}/thumbs/${fileId}.webp`, fileType)
  } catch {
    // Thumbnail generation is best-effort
  }

  // Chunk and embed text content
  if (text.trim()) {
    const dateStr = stat.mtime.toISOString().split('T')[0]
    const metadata = `[${dateStr}] File: ${name} | Type: ${fileType} | Path: ${filePath}`
    const chunks = chunkText(text, metadata)

    if (chunks.length > 0) {
      // Delete old chunks
      await vectorDb.deleteByFileId(fileId)

      // Embed in batches of 10
      for (let i = 0; i < chunks.length; i += 10) {
        const batch = chunks.slice(i, i + 10)
        const vectors = await embed(batch)

        const records = batch.map((chunkText, j) => ({
          id: `${fileId}_${i + j}`,
          file_id: fileId,
          text: chunkText,
          vector: vectors[j],
          file_name: name,
          file_type: fileType,
          file_path: filePath,
        }))

        await vectorDb.addChunks(records)
      }
    }
  }
}

function detectMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    avi: 'video/avi',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    gif: 'image/gif',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
  }
  return map[ext] || 'application/octet-stream'
}
