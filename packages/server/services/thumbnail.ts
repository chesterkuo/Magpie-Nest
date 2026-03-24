import sharp from 'sharp'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const execAsync = promisify(exec)

const HEIC_EXTENSIONS = new Set(['.heic', '.heif'])

function ensureDir(filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function isHeic(filePath: string): boolean {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase()
  return HEIC_EXTENSIONS.has(ext)
}

export async function generateImageThumb(
  inputPath: string,
  outputPath: string,
  width = 320
): Promise<void> {
  ensureDir(outputPath)
  if (isHeic(inputPath)) {
    // sharp lacks HEIC support — use macOS sips to convert to JPEG first, then sharp to webp
    const tmpJpg = outputPath.replace(/\.webp$/, '.tmp.jpg')
    await execAsync(`sips -s format jpeg -Z ${width} "${inputPath}" --out "${tmpJpg}"`)
    await sharp(tmpJpg).webp({ quality: 80 }).toFile(outputPath)
    try { (await import('fs')).unlinkSync(tmpJpg) } catch {}
  } else {
    await sharp(inputPath).resize(width).webp({ quality: 80 }).toFile(outputPath)
  }
}

export async function generateVideoThumb(
  inputPath: string,
  outputPath: string,
  width = 320,
  seekSeconds = 10
): Promise<void> {
  ensureDir(outputPath)
  // Extract frame as png first (ffmpeg may lack webp encoder), then convert with sharp
  const tmpPng = outputPath.replace(/\.webp$/, '.tmp.png')
  await execAsync(
    `ffmpeg -y -ss ${seekSeconds} -i "${inputPath}" -frames:v 1 -update 1 -vf "scale=${width}:-1" "${tmpPng}"`
  )
  await sharp(tmpPng).webp({ quality: 80 }).toFile(outputPath)
  try { (await import('fs')).unlinkSync(tmpPng) } catch {}
}

export async function generateThumb(
  inputPath: string,
  outputPath: string,
  fileType: string
): Promise<void> {
  switch (fileType) {
    case 'image':
      return generateImageThumb(inputPath, outputPath)
    case 'video':
      return generateVideoThumb(inputPath, outputPath)
    case 'audio':
      try {
        const mm = await import('music-metadata')
        const metadata = await mm.parseFile(inputPath)
        const pic = metadata.common.picture?.[0]
        if (pic) {
          await sharp(pic.data).resize(320).webp({ quality: 80 }).toFile(outputPath)
        }
      } catch {}
      return
    default:
      return
  }
}
