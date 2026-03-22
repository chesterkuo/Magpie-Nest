import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import type { VectorDb } from '../services/lancedb'
import type { ProviderManager } from '../services/providers/factory'

const startTime = Date.now()

export function createHealthRoute(db: MagpieDb, vectorDb: VectorDb, getWatchDirs: () => string[], providerManager?: ProviderManager) {
  const route = new Hono()

  route.get('/health', async (c) => {
    const dataDir = process.env.DATA_DIR || './data'

    // Check LLM provider
    let llmStatus: any = { status: 'error', model: '', loaded: false }
    try {
      llmStatus = await providerManager?.getLLMProvider().healthCheck()
        ?? { status: 'error', model: '', loaded: false }
    } catch {}

    // Check embedding provider (no healthCheck on EmbeddingProvider, report name/model)
    let embedStatus: any = { status: 'ok', provider: '', model: '', dimensions: 0 }
    try {
      if (providerManager) {
        const ep = providerManager.getEmbeddingProvider()
        embedStatus = { status: 'ok', provider: ep.name(), model: ep.modelName(), dimensions: ep.dimensions() }
      }
    } catch {
      embedStatus = { status: 'error', provider: '', model: '', dimensions: 0 }
    }

    // Check SQLite
    let sqliteStatus: any = { status: 'error', totalFiles: 0 }
    try {
      const row = db.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }
      sqliteStatus = { status: 'ok', totalFiles: row.count }
    } catch {}

    // Check LanceDB
    let lanceStatus: any = { status: 'error', totalChunks: 0 }
    try {
      const count = await vectorDb.count()
      lanceStatus = { status: 'ok', totalChunks: count }
    } catch {
      // count method may not exist yet — treat as ok with 0
      lanceStatus = { status: 'ok', totalChunks: 0 }
    }

    // Check whisper binary
    const whisperModel = `${dataDir}/models/ggml-base.en.bin`
    const whisperStatus = {
      status: (await Bun.file(whisperModel).exists()) ? 'ok' as const : 'unavailable' as const,
      modelPath: whisperModel,
    }

    // Check Kokoro PID
    const kokoroPid = `${dataDir}/kokoro.pid`
    let kokoroRunning = false
    try {
      if (await Bun.file(kokoroPid).exists()) {
        const pid = parseInt(await Bun.file(kokoroPid).text())
        process.kill(pid, 0) // throws if process not running
        kokoroRunning = true
      }
    } catch {}

    const criticalOk = llmStatus.status === 'ok' && sqliteStatus.status === 'ok' && lanceStatus.status === 'ok'
    const voiceOk = whisperStatus.status === 'ok' && kokoroRunning

    // Disk usage
    async function getDiskInfo(path: string) {
      try {
        const proc = Bun.spawn(['df', '-k', path])
        const output = await new Response(proc.stdout).text()
        const lines = output.trim().split('\n')
        if (lines.length >= 2) {
          const parts = lines[1].split(/\s+/)
          return { path, freeBytes: parseInt(parts[3]) * 1024, totalBytes: parseInt(parts[1]) * 1024 }
        }
      } catch {}
      return { path, freeBytes: 0, totalBytes: 0 }
    }
    const dataDirDisk = await getDiskInfo(dataDir)

    return c.json({
      status: criticalOk ? (voiceOk ? 'ok' : 'degraded') : 'error',
      services: {
        llm: llmStatus,
        embedding: embedStatus,
        lancedb: lanceStatus,
        sqlite: sqliteStatus,
        whisper: whisperStatus,
        kokoro: { status: kokoroRunning ? 'ok' : 'unavailable', processRunning: kokoroRunning },
      },
      disk: {
        dataDir: dataDirDisk,
        watchDirs: await Promise.all(getWatchDirs().map(d => getDiskInfo(d))),
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0',
    })
  })

  return route
}
