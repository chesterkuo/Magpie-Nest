import { createDb } from '../services/db'
import { createVectorDb } from '../services/lancedb'
import { processFile } from '../services/indexer'
import { createOllamaEmbedding } from '../services/providers/ollama'
import { createOpenAICompatEmbedding } from '../services/providers/openai-compat'

const DATA_DIR = process.env.DATA_DIR || './data'
const POLL_INTERVAL = 5000 // 5 seconds
const BATCH_SIZE = 10

function createEmbedFn() {
  const embedProvider = process.env.EMBED_PROVIDER || 'openai-compatible'

  if (embedProvider === 'ollama') {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
    const dims = parseInt(process.env.EMBED_DIMENSIONS || '768')
    const provider = createOllamaEmbedding({ host, model, dimensions: dims })
    return (texts: string[]) => provider.embed(texts)
  } else {
    const apiKey = process.env.EMBED_API_KEY || ''
    const baseUrl = process.env.EMBED_BASE_URL || ''
    const model = process.env.EMBED_MODEL || ''
    const dims = parseInt(process.env.EMBED_DIMENSIONS || '3072')

    if (apiKey && baseUrl && model) {
      const provider = createOpenAICompatEmbedding({ apiKey, baseUrl, model, dimensions: dims })
      return (texts: string[]) => provider.embed(texts)
    } else {
      // Fallback to Ollama
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
      const embedModel = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
      const provider = createOllamaEmbedding({ host, model: embedModel, dimensions: 768 })
      return (texts: string[]) => provider.embed(texts)
    }
  }
}

async function main() {
  const db = createDb(`${DATA_DIR}/sqlite/magpie.db`)
  const vectorDb = await createVectorDb(`${DATA_DIR}/lancedb`)
  const embed = createEmbedFn()

  console.log('[indexer] Worker started')

  while (true) {
    const jobs = db.dequeuePending(BATCH_SIZE)

    for (const job of jobs) {
      try {
        console.log(`[indexer] Processing: ${job.file_path}`)
        await processFile(job.file_path, db, vectorDb, embed)
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
