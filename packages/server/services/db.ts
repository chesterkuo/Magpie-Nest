import { Database } from 'bun:sqlite'

export interface FileRecord {
  id: string
  path: string
  name: string
  mime_type: string
  size: number
  modified_at: string
  indexed_at?: string
  file_type: string
  meta: string
  hash: string
}

interface QueueItem {
  id: number
  file_path: string
  event_type: string
  queued_at: string
  status: string
}

export interface MagpieDb {
  db: Database
  upsertFile(file: FileRecord): void
  getFileById(id: string): FileRecord | null
  getFileByPath(path: string): FileRecord | null
  listRecent(opts: { limit?: number; file_type?: string; days?: number }): FileRecord[]
  deleteFileByPath(path: string): void
  enqueue(filePath: string, eventType: string): void
  dequeuePending(batchSize: number): QueueItem[]
  markQueueDone(id: number): void
  markQueueError(id: number): void
  close(): void
}

export function createDb(dbPath: string): MagpieDb {
  const db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id          TEXT PRIMARY KEY,
      path        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      size        INTEGER NOT NULL,
      modified_at TEXT NOT NULL,
      indexed_at  TEXT DEFAULT (datetime('now')),
      file_type   TEXT NOT NULL,
      meta        TEXT DEFAULT '{}',
      hash        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
    CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_at);
    CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type);

    CREATE TABLE IF NOT EXISTS index_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path   TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      queued_at   TEXT DEFAULT (datetime('now')),
      status      TEXT DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON index_queue(status);
  `)

  const stmts = {
    upsert: db.prepare(`
      INSERT INTO files (id, path, name, mime_type, size, modified_at, file_type, meta, hash)
      VALUES ($id, $path, $name, $mime_type, $size, $modified_at, $file_type, $meta, $hash)
      ON CONFLICT(path) DO UPDATE SET
        name=$name, mime_type=$mime_type, size=$size, modified_at=$modified_at,
        indexed_at=datetime('now'), file_type=$file_type, meta=$meta, hash=$hash
    `),
    getById: db.prepare('SELECT * FROM files WHERE id = ?'),
    getByPath: db.prepare('SELECT * FROM files WHERE path = ?'),
    deleteByPath: db.prepare('DELETE FROM files WHERE path = ?'),
    enqueue: db.prepare(
      'INSERT INTO index_queue (file_path, event_type) VALUES (?, ?)'
    ),
    dequeuePending: db.prepare(
      'SELECT * FROM index_queue WHERE status = ? ORDER BY id LIMIT ?'
    ),
    markStatus: db.prepare(
      'UPDATE index_queue SET status = ? WHERE id = ?'
    ),
  }

  return {
    db,

    upsertFile(file: FileRecord) {
      stmts.upsert.run({
        $id: file.id,
        $path: file.path,
        $name: file.name,
        $mime_type: file.mime_type,
        $size: file.size,
        $modified_at: file.modified_at,
        $file_type: file.file_type,
        $meta: file.meta,
        $hash: file.hash,
      })
    },

    getFileById(id: string) {
      return (stmts.getById.get(id) as FileRecord) ?? null
    },

    getFileByPath(path: string) {
      return (stmts.getByPath.get(path) as FileRecord) ?? null
    },

    listRecent({ limit = 20, file_type, days }) {
      let sql = 'SELECT * FROM files'
      const conditions: string[] = []
      const params: unknown[] = []

      if (file_type) {
        conditions.push('file_type = ?')
        params.push(file_type)
      }
      if (days) {
        conditions.push("modified_at >= datetime('now', ?)")
        params.push(`-${days} days`)
      }
      if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ')
      }
      sql += ' ORDER BY modified_at DESC LIMIT ?'
      params.push(limit)

      return db.prepare(sql).all(...params) as FileRecord[]
    },

    deleteFileByPath(path: string) {
      stmts.deleteByPath.run(path)
    },

    enqueue(filePath: string, eventType: string) {
      stmts.enqueue.run(filePath, eventType)
    },

    dequeuePending(batchSize: number) {
      const items = stmts.dequeuePending.all('pending', batchSize) as QueueItem[]
      for (const item of items) {
        stmts.markStatus.run('processing', item.id)
      }
      return items.map((i) => ({ ...i, status: 'processing' }))
    },

    markQueueDone(id: number) {
      stmts.markStatus.run('done', id)
    },

    markQueueError(id: number) {
      stmts.markStatus.run('error', id)
    },

    close() {
      db.close()
    },
  }
}
