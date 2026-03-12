import { createDb } from '../services/db'
import { createVectorDb } from '../services/lancedb'
import { processFile } from '../services/indexer'

const DATA_DIR = process.env.DATA_DIR || './data'
const POLL_INTERVAL = 5000 // 5 seconds
const BATCH_SIZE = 10

async function main() {
  const db = createDb(`${DATA_DIR}/sqlite/magpie.db`)
  const vectorDb = await createVectorDb(`${DATA_DIR}/lancedb`)

  console.log('[indexer] Worker started')

  while (true) {
    const jobs = db.dequeuePending(BATCH_SIZE)

    for (const job of jobs) {
      try {
        console.log(`[indexer] Processing: ${job.file_path}`)
        await processFile(job.file_path, db, vectorDb)
        db.markQueueDone(job.id)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[indexer] Error: ${job.file_path}: ${message}`)
        db.markQueueError(job.id)
      }
    }

    await Bun.sleep(POLL_INTERVAL)
  }
}

main()
