import { describe, test, expect } from 'bun:test'
import { extractMetadata } from '../services/metadata'

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
