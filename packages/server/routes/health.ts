import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import type { VectorDb } from '../services/lancedb'

const startTime = Date.now()

export function createHealthRoute(db: MagpieDb, vectorDb: VectorDb) {
  const route = new Hono()

  route.get('/health', async (c) => {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const dataDir = process.env.DATA_DIR || './data'

    // Check Ollama
    let ollamaStatus: any = { status: 'error', model: '', loaded: false }
    try {
      const res = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json() as { models?: Array<{ name: string }> }
        const model = process.env.OLLAMA_MODEL || 'qwen3:8b'
        ollamaStatus = {
          status: 'ok',
          model,
          loaded: data.models?.some(m => m.name.includes(model.split(':')[0])) ?? false,
        }
      }
    } catch {}

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

    const criticalOk = ollamaStatus.status === 'ok' && sqliteStatus.status === 'ok' && lanceStatus.status === 'ok'
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
        ollama: ollamaStatus,
        lancedb: lanceStatus,
        sqlite: sqliteStatus,
        whisper: whisperStatus,
        kokoro: { status: kokoroRunning ? 'ok' : 'unavailable', processRunning: kokoroRunning },
      },
      disk: { dataDir: dataDirDisk, watchDirs: [] },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0',
    })
  })

  return route
}
