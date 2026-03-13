import * as lancedb from '@lancedb/lancedb'

export interface ChunkRecord {
  id: string
  file_id: string
  text: string
  vector: number[]
  file_name: string
  file_type: string
  file_path: string
}

export interface SearchResult {
  id: string
  file_id: string
  text: string
  file_name: string
  file_type: string
  file_path: string
  _distance: number
}

export interface VectorDb {
  addChunks(chunks: ChunkRecord[]): Promise<void>
  search(queryVector: number[], limit: number): Promise<SearchResult[]>
  deleteByFileId(fileId: string): Promise<void>
  count(): Promise<number>
}

export async function createVectorDb(dbPath: string): Promise<VectorDb> {
  const db = await lancedb.connect(dbPath)

  async function getOrCreateTable() {
    const tableNames = await db.tableNames()
    if (tableNames.includes('file_chunks')) {
      return db.openTable('file_chunks')
    }
    return null
  }

  return {
    async addChunks(chunks: ChunkRecord[]) {
      const tableNames = await db.tableNames()
      if (tableNames.includes('file_chunks')) {
        const table = await db.openTable('file_chunks')
        await table.add(chunks)
      } else {
        await db.createTable('file_chunks', chunks)
      }
    },

    async search(queryVector: number[], limit: number) {
      const table = await getOrCreateTable()
      if (!table) return []

      const results = await table
        .vectorSearch(queryVector)
        .limit(limit)
        .toArray()

      return results.map((r) => ({
        id: r.id as string,
        file_id: r.file_id as string,
        text: r.text as string,
        file_name: r.file_name as string,
        file_type: r.file_type as string,
        file_path: r.file_path as string,
        _distance: r._distance as number,
      }))
    },

    async deleteByFileId(fileId: string) {
      const table = await getOrCreateTable()
      if (!table) return
      const safeId = fileId.replace(/'/g, "''")
      await table.delete(`file_id = '${safeId}'`)
    },

    async count(): Promise<number> {
      try {
        const table = await db.openTable('file_chunks')
        return await table.countRows()
      } catch { return 0 }
    },
  }
}
