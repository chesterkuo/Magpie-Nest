import { createDb, type MagpieDb } from './services/db'
import { createVectorDb, type VectorDb } from './services/lancedb'
import { embedSingle } from './services/embeddings'
import { initToolContext } from './agent/tools/registry'
import { createWatcher } from './services/watcher'
import { existsSync, mkdirSync } from 'fs'

const DATA_DIR = process.env.DATA_DIR || './data'
const SQLITE_PATH = `${DATA_DIR}/sqlite/magpie.db`
const LANCEDB_PATH = `${DATA_DIR}/lancedb`
const WATCH_DIRS = (process.env.WATCH_DIRS || '').split(',').filter(Boolean)

export interface AppContext {
  db: MagpieDb
  vectorDb: VectorDb
  getWatchDirs: () => string[]
  setWatchDirs: (dirs: string[]) => void
}

export async function bootstrap(): Promise<AppContext> {
  // Ensure data directories exist
  for (const dir of ['sqlite', 'lancedb', 'thumbs', 'hls-cache']) {
    const path = `${DATA_DIR}/${dir}`
    if (!existsSync(path)) mkdirSync(path, { recursive: true })
  }

  let currentWatchDirs = [...WATCH_DIRS]
  let currentWatcher: { close: () => Promise<void> } | null = null

  const db = createDb(SQLITE_PATH)
  const vectorDb = await createVectorDb(LANCEDB_PATH)

  // Init tool context
  initToolContext({
    db,
    vectorDb,
    embedQuery: embedSingle,
    dataDir: DATA_DIR,
  })

  function startWatcher(dirs: string[]) {
    if (dirs.length === 0) return null
    const w = createWatcher(dirs, (filePath, eventType) => {
      console.log(`[watcher] ${eventType}: ${filePath}`)
      if (eventType === 'deleted') {
        db.deleteFileByPath(filePath)
      } else {
        db.enqueue(filePath, eventType)
      }
    }, 5000) // 5 second debounce
    console.log(`[watcher] Watching: ${dirs.join(', ')}`)
    return w
  }

  currentWatcher = startWatcher(WATCH_DIRS)

  console.log('[magpie] Server bootstrapped')
  return {
    db,
    vectorDb,
    getWatchDirs: () => currentWatchDirs,
    setWatchDirs: (dirs: string[]) => {
      if (currentWatcher) currentWatcher.close()
      currentWatchDirs = dirs
      currentWatcher = startWatcher(dirs)
    },
  }
}
