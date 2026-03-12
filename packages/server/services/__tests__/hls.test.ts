import { describe, it, expect } from 'bun:test'
import { buildFfmpegArgs, getHlsCachePath } from '../hls'

describe('HLS', () => {
  it('builds transmux args for mp4', () => {
    const args = buildFfmpegArgs('/media/movie.mp4', '/cache/abc')
    expect(args).toContain('-c')
    expect(args).toContain('copy')
    expect(args).toContain('-hls_time')
  })

  it('builds transcode args for avi', () => {
    const args = buildFfmpegArgs('/media/movie.avi', '/cache/abc')
    expect(args).toContain('libx264')
  })

  it('returns correct cache path', () => {
    const path = getHlsCachePath('file-123', '/data')
    expect(path).toBe('/data/hls-cache/file-123')
  })
})
