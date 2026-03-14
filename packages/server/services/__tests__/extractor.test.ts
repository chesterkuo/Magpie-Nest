import { describe, it, expect } from 'bun:test'
import { extractText, detectFileType, chunkText } from '../extractor'
import { writeFileSync, unlinkSync } from 'fs'

describe('detectFileType', () => {
  it('detects PDF', () => {
    expect(detectFileType('report.pdf', 'application/pdf')).toBe('pdf')
  })

  it('detects video', () => {
    expect(detectFileType('movie.mp4', 'video/mp4')).toBe('video')
  })

  it('detects audio', () => {
    expect(detectFileType('song.mp3', 'audio/mpeg')).toBe('audio')
  })

  it('detects image', () => {
    expect(detectFileType('photo.jpg', 'image/jpeg')).toBe('image')
  })

  it('detects doc', () => {
    expect(detectFileType('readme.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc')
  })
})

describe('extractText', () => {
  it('extracts text from a plain text file', async () => {
    const tmpPath = '/tmp/magpie-test-extract.txt'
    writeFileSync(tmpPath, 'Hello Magpie world')
    try {
      const text = await extractText(tmpPath, 'text/plain', 'doc')
      expect(text).toContain('Hello Magpie world')
    } finally {
      unlinkSync(tmpPath)
    }
  })

  it('returns empty string for video files', async () => {
    const text = await extractText('/tmp/nonexistent.mp4', 'video/mp4', 'video')
    expect(text).toBe('')
  })

  it('returns empty string for nonexistent .pptx file (graceful error handling)', async () => {
    const text = await extractText('/tmp/nonexistent-magpie-test.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'doc')
    expect(text).toBe('')
  })
})

describe('chunkText', () => {
  it('includes metadata prefix in each chunk', () => {
    const text = 'Hello world this is test content for chunking'
    const metadata = '[2026-03-14] File: test.txt | Type: doc | Path: /data/test.txt'
    const chunks = chunkText(text, metadata, 100)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toContain('[2026-03-14]')
    expect(chunks[0]).toContain('File: test.txt')
    expect(chunks[0]).toContain('Hello world')
  })

  it('returns empty array for blank text', () => {
    const chunks = chunkText('   ', 'meta')
    expect(chunks).toEqual([])
  })
})

describe('detectFileType pptx', () => {
  it('detects .pptx as doc', () => {
    expect(detectFileType('slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('doc')
  })
})
