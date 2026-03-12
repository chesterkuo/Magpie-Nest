import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createVectorDb, type VectorDb } from '../lancedb'
import { rmSync } from 'fs'

const TEST_DIR = '/tmp/magpie-lance-test'

describe('VectorDb', () => {
  let vdb: VectorDb

  beforeEach(async () => {
    vdb = await createVectorDb(TEST_DIR)
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }) } catch {}
  })

  it('adds chunks and searches by vector', async () => {
    const fakeVector = new Array(768).fill(0).map((_, i) => i / 768)

    await vdb.addChunks([
      {
        id: 'chunk-1',
        file_id: 'file-1',
        text: 'contract agreement for 2025',
        vector: fakeVector,
        file_name: 'contract.pdf',
        file_type: 'pdf',
        file_path: '/docs/contract.pdf',
      },
    ])

    const results = await vdb.search(fakeVector, 5)
    expect(results.length).toBe(1)
    expect(results[0].file_id).toBe('file-1')
  })

  it('deletes chunks by file_id', async () => {
    const fakeVector = new Array(768).fill(0.5)

    await vdb.addChunks([
      {
        id: 'c1',
        file_id: 'f1',
        text: 'hello',
        vector: fakeVector,
        file_name: 'a.txt',
        file_type: 'doc',
        file_path: '/a.txt',
      },
      {
        id: 'c2',
        file_id: 'f2',
        text: 'world',
        vector: fakeVector,
        file_name: 'b.txt',
        file_type: 'doc',
        file_path: '/b.txt',
      },
    ])

    await vdb.deleteByFileId('f1')
    const results = await vdb.search(fakeVector, 10)
    expect(results.every((r) => r.file_id !== 'f1')).toBe(true)
  })
})
