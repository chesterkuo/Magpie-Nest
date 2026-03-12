import { readFile } from 'fs/promises'
import type { FileType } from '@magpie/shared'

const MIME_MAP: Record<string, FileType> = {
  'application/pdf': 'pdf',
  'video/mp4': 'video',
  'video/x-matroska': 'video',
  'video/avi': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/gif': 'image',
}

const EXT_MAP: Record<string, FileType> = {
  '.pdf': 'pdf',
  '.mp4': 'video', '.mkv': 'video', '.avi': 'video', '.mov': 'video', '.webm': 'video',
  '.mp3': 'audio', '.flac': 'audio', '.aac': 'audio', '.wav': 'audio', '.ogg': 'audio',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.heic': 'image', '.gif': 'image',
  '.docx': 'doc', '.xlsx': 'doc', '.pptx': 'doc', '.txt': 'doc', '.md': 'doc', '.csv': 'doc',
}

export function detectFileType(filename: string, mimeType: string): FileType {
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType]
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return EXT_MAP[ext] || 'doc'
}

export async function extractText(
  filePath: string,
  mimeType: string,
  fileType: FileType
): Promise<string> {
  // Media files — no text extraction
  if (fileType === 'video' || fileType === 'audio' || fileType === 'image') {
    return ''
  }

  try {
    if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default
      const buffer = await readFile(filePath)
      const data = await pdfParse(buffer)
      return data.text
    }

    if (mimeType.includes('wordprocessingml') || filePath.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value
    }

    if (mimeType.includes('spreadsheetml') || filePath.endsWith('.xlsx')) {
      const XLSX = await import('xlsx')
      const workbook = XLSX.readFile(filePath)
      const texts: string[] = []
      for (const name of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
        texts.push(`Sheet: ${name}\n${csv}`)
      }
      return texts.join('\n\n')
    }

    // Fallback: read as plain text
    if (mimeType.startsWith('text/') || ['.txt', '.md', '.csv'].some((e) => filePath.endsWith(e))) {
      const content = await readFile(filePath, 'utf-8')
      return content
    }

    return ''
  } catch {
    return ''
  }
}

export function chunkText(text: string, metadata: string, chunkSize = 800): string[] {
  if (!text.trim()) return []

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const chunk = text.slice(start, end)
    chunks.push(`${metadata}\n\n${chunk}`)
    start = end
  }

  return chunks
}
