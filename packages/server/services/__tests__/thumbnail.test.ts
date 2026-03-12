import { describe, it, expect, afterEach } from 'bun:test'
import { generateImageThumb } from '../thumbnail'
import { existsSync, rmSync, mkdirSync } from 'fs'
import sharp from 'sharp'

const THUMB_DIR = '/tmp/magpie-thumb-test'

describe('Thumbnail', () => {
  afterEach(() => {
    try { rmSync(THUMB_DIR, { recursive: true }) } catch {}
  })

  it('generates a webp thumbnail from an image', async () => {
    mkdirSync(THUMB_DIR, { recursive: true })

    // Create a test image
    const testImg = `${THUMB_DIR}/source.png`
    await sharp({ create: { width: 1000, height: 1000, channels: 3, background: 'red' } })
      .png()
      .toFile(testImg)

    const outPath = `${THUMB_DIR}/thumb.webp`
    await generateImageThumb(testImg, outPath)

    expect(existsSync(outPath)).toBe(true)

    const meta = await sharp(outPath).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(320)
  })
})
