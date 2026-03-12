import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

const TRANSMUX_EXTENSIONS = new Set(['.mp4', '.mkv', '.mov', '.webm'])

export function getHlsCachePath(fileId: string, dataDir: string): string {
  return join(dataDir, 'hls-cache', fileId)
}

export function buildFfmpegArgs(inputPath: string, outputDir: string): string[] {
  const ext = '.' + inputPath.split('.').pop()?.toLowerCase()
  const playlistPath = join(outputDir, 'playlist.m3u8')
  const segmentPath = join(outputDir, 'seg_%03d.ts')

  const baseArgs = ['-y', '-i', inputPath]

  if (TRANSMUX_EXTENSIONS.has(ext)) {
    return [
      ...baseArgs,
      '-c', 'copy',
      '-hls_time', '10',
      '-hls_list_size', '0',
      '-hls_segment_filename', segmentPath,
      playlistPath,
    ]
  }

  return [
    ...baseArgs,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-c:a', 'aac',
    '-hls_time', '10',
    '-hls_list_size', '0',
    '-hls_segment_filename', segmentPath,
    playlistPath,
  ]
}

export async function ensureHls(
  fileId: string,
  inputPath: string,
  dataDir: string
): Promise<string> {
  const cacheDir = getHlsCachePath(fileId, dataDir)
  const playlistPath = join(cacheDir, 'playlist.m3u8')

  if (existsSync(playlistPath)) {
    return playlistPath
  }

  mkdirSync(cacheDir, { recursive: true })
  const args = buildFfmpegArgs(inputPath, cacheDir)
  await execAsync(`ffmpeg ${args.map((a) => `"${a}"`).join(' ')}`)
  return playlistPath
}
