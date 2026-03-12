import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { createDb } from '../services/db'
import { createVectorDb } from '../services/lancedb'
import { initToolContext, executeTool } from '../agent/tools/registry'
import { rmSync, mkdirSync } from 'fs'

const TEST_DIR = '/tmp/magpie-e2e'

describe('E2E: Tool execution', () => {
  beforeAll(async () => {
    mkdirSync(`${TEST_DIR}/sqlite`, { recursive: true })
    mkdirSync(`${TEST_DIR}/lancedb`, { recursive: true })

    const db = createDb(`${TEST_DIR}/sqlite/test.db`)
    const vectorDb = await createVectorDb(`${TEST_DIR}/lancedb`)

    // Seed test data
    db.upsertFile({
      id: 'e2e-1',
      path: '/media/test-movie.mp4',
      name: 'test-movie.mp4',
      mime_type: 'video/mp4',
      size: 1_000_000,
      modified_at: new Date().toISOString(),
      file_type: 'video',
      meta: '{}',
      hash: 'test-hash',
    })

    const fakeEmbed = async (text: string) => new Array(768).fill(0.1)

    initToolContext({ db, vectorDb, embedQuery: fakeEmbed, dataDir: TEST_DIR })
  })

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true })
    } catch {}
  })

  it('list_recent returns seeded files', async () => {
    const result = await executeTool('list_recent', { days: 30 })
    expect(result.files.length).toBe(1)
    expect(result.files[0].name).toBe('test-movie.mp4')
    expect(result.files[0].renderType).toBe('video_card')
  })

  it('get_file_info returns file details', async () => {
    const result = await executeTool('get_file_info', { file_id: 'e2e-1' })
    expect(result.files[0].id).toBe('e2e-1')
  })

  it('play_media returns stream URL', async () => {
    const result = await executeTool('play_media', { file_id: 'e2e-1' })
    expect(result.files[0].streamUrl).toContain('/api/stream/e2e-1')
  })

  it('returns error for unknown file', async () => {
    const result = await executeTool('get_file_info', { file_id: 'nonexistent' })
    expect(result.error).toBeDefined()
  })
})
