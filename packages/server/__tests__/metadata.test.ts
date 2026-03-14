import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { writeFileSync, unlinkSync } from 'fs'
import { extractMetadata } from '../services/metadata'
import type { FileType } from '@magpie/shared'

describe('extractMetadata', () => {
  test('returns empty object for unknown file type', async () => {
    const meta = await extractMetadata('/nonexistent.xyz', 'doc')
    expect(meta).toEqual({})
  })

  test('returns empty object when audio file does not exist', async () => {
    const meta = await extractMetadata('/nonexistent.mp3', 'audio')
    expect(meta).toEqual({})
  })

  test('returns empty object when video file does not exist', async () => {
    const meta = await extractMetadata('/nonexistent.mp4', 'video')
    expect(meta).toEqual({})
  })

  test('returns empty object when image file does not exist', async () => {
    const meta = await extractMetadata('/nonexistent.png', 'image')
    expect(meta).toEqual({})
  })

  test('returns empty object when pdf file does not exist', async () => {
    const meta = await extractMetadata('/nonexistent.pdf', 'pdf')
    expect(meta).toEqual({})
  })
})

describe('extractMetadata image dimensions', () => {
  const tmpPng = '/tmp/magpie-test-1x1.png'

  beforeAll(() => {
    // Minimal 1x1 PNG (valid PNG header + IHDR + IDAT + IEND)
    const PNG_1x1 = Buffer.from(
      '89504e470d0a1a0a0000000d494844520000000100000001' +
      '0806000000 1f15c4890000000a49444154789c6260000000020001' +
      'e221bc330000000049454e44ae426082',
      'hex'
    )
    // Use a known-good 1x1 red PNG
    // PNG signature + IHDR (1x1, 8-bit RGBA) + IDAT (minimal) + IEND
    const png1x1 = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth=8, color=RGB, CRC
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT length + type
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // IDAT data (zlib compressed)
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // IDAT data + CRC
      0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND length + type
      0x44, 0xae, 0x42, 0x60, 0x82,                   // IEND CRC
    ])
    writeFileSync(tmpPng, png1x1)
  })

  afterAll(() => {
    try { unlinkSync(tmpPng) } catch {}
  })

  test('returns dimensions for a real 1x1 PNG image', async () => {
    const meta = await extractMetadata(tmpPng, 'image')
    expect(meta).toHaveProperty('width')
    expect(meta).toHaveProperty('height')
    expect(meta.width).toBe(1)
    expect(meta.height).toBe(1)
  })
})

describe('extractMetadata FileType coverage', () => {
  const allTypes: FileType[] = ['video', 'audio', 'pdf', 'image', 'doc']

  for (const type of allTypes) {
    test(`does not crash for type=${type} with nonexistent file`, async () => {
      const meta = await extractMetadata(`/nonexistent-magpie.${type}`, type)
      expect(typeof meta).toBe('object')
    })
  }
})
