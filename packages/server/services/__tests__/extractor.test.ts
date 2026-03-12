import { describe, it, expect } from 'bun:test'
import { extractText, detectFileType } from '../extractor'
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
})
