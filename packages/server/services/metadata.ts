import type { FileType } from '@magpie/shared'

export interface FileMetadata {
  duration?: number    // seconds
  artist?: string
  album?: string
  title?: string
  width?: number
  height?: number
  pages?: number       // PDF page count
}

export async function extractMetadata(
  filePath: string,
  fileType: FileType
): Promise<FileMetadata> {
  try {
    if (fileType === 'audio') return await extractAudioMeta(filePath)
    if (fileType === 'video') return await extractVideoMeta(filePath)
    if (fileType === 'image') return await extractImageMeta(filePath)
    if (fileType === 'pdf') return await extractPdfMeta(filePath)
  } catch {}
  return {}
}

async function extractAudioMeta(filePath: string): Promise<FileMetadata> {
  const mm = await import('music-metadata')
  const metadata = await mm.parseFile(filePath)
  return {
    duration: metadata.format.duration,
    artist: metadata.common.artist,
    album: metadata.common.album,
    title: metadata.common.title,
  }
}

async function extractVideoMeta(filePath: string): Promise<FileMetadata> {
  const proc = Bun.spawn([
    'ffprobe', '-v', 'quiet', '-print_format', 'json',
    '-show_format', '-show_streams', filePath,
  ])
  const output = await new Response(proc.stdout).text()
  const data = JSON.parse(output)
  const videoStream = data.streams?.find((s: any) => s.codec_type === 'video')
  return {
    duration: data.format?.duration ? parseFloat(data.format.duration) : undefined,
    width: videoStream?.width,
    height: videoStream?.height,
  }
}

async function extractImageMeta(filePath: string): Promise<FileMetadata> {
  const sharp = (await import('sharp')).default
  const info = await sharp(filePath).metadata()
  return {
    width: info.width,
    height: info.height,
  }
}

async function extractPdfMeta(filePath: string): Promise<FileMetadata> {
  const { readFile } = await import('fs/promises')
  const pdfParse = (await import('pdf-parse')).default
  const buffer = await readFile(filePath)
  const data = await pdfParse(buffer)
  return {
    pages: data.numpages,
  }
}
