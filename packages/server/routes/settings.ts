import { Hono } from 'hono'
import type { MagpieDb } from '../services/db'
import type { ProviderManager } from '../services/providers/factory'
import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

function maskKey(key: string | null): string {
  if (!key || key.length <= 4) return key ? '****' : ''
  return '****' + key.slice(-4)
}

export function createSettingsRoute(
  db: MagpieDb,
  getWatchDirs: () => string[],
  setWatchDirs: (dirs: string[]) => void,
  providerManager?: ProviderManager,
) {
  const route = new Hono()

  function getIndexingInfo() {
    const queueLength = (db.db.prepare("SELECT COUNT(*) as count FROM index_queue WHERE status = 'pending'").get() as { count: number }).count
    const totalIndexed = (db.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }).count
    const lastRow = db.db.prepare('SELECT indexed_at FROM files ORDER BY indexed_at DESC LIMIT 1').get() as { indexed_at: string } | null
    return { queueLength, totalIndexed, lastIndexedAt: lastRow?.indexed_at ?? null }
  }

  function getLLMConfig() {
    return {
      provider: db.getSetting('llm_provider') || process.env.LLM_PROVIDER || 'openai-compatible',
      model: db.getSetting('llm_model') || process.env.LLM_MODEL || process.env.OLLAMA_MODEL || '',
      baseUrl: db.getSetting('llm_base_url') || process.env.LLM_BASE_URL || '',
      apiKey: maskKey(db.getSetting('llm_api_key') || process.env.LLM_API_KEY || ''),
      ollamaHost: db.getSetting('ollama_host') || process.env.OLLAMA_HOST || 'http://localhost:11434',
    }
  }

  function getEmbedConfig() {
    return {
      provider: db.getSetting('embed_provider') || process.env.EMBED_PROVIDER || 'openai-compatible',
      model: db.getSetting('embed_model') || process.env.EMBED_MODEL || process.env.OLLAMA_EMBED_MODEL || '',
      baseUrl: db.getSetting('embed_base_url') || process.env.EMBED_BASE_URL || '',
      apiKey: maskKey(db.getSetting('embed_api_key') || process.env.EMBED_API_KEY || ''),
      dimensions: parseInt(db.getSetting('embed_dimensions') || process.env.EMBED_DIMENSIONS || '768'),
      ollamaHost: db.getSetting('ollama_host') || process.env.OLLAMA_HOST || 'http://localhost:11434',
    }
  }

  route.get('/settings', (c) => {
    return c.json({
      watchDirs: getWatchDirs(),
      indexing: getIndexingInfo(),
      llm: getLLMConfig(),
      embedding: getEmbedConfig(),
      version: '1.0.0',
    })
  })

  route.put('/settings', async (c) => {
    const body = await c.req.json<{
      watchDirs?: string[]
      llm?: { provider?: string; model?: string; baseUrl?: string; apiKey?: string; ollamaHost?: string }
      embedding?: { provider?: string; model?: string; baseUrl?: string; apiKey?: string; dimensions?: number; ollamaHost?: string }
    }>()

    if (body.watchDirs) {
      setWatchDirs(body.watchDirs)
    }

    // Save LLM config
    if (body.llm) {
      if (body.llm.provider) db.setSetting('llm_provider', body.llm.provider)
      if (body.llm.model) db.setSetting('llm_model', body.llm.model)
      if (body.llm.baseUrl !== undefined) db.setSetting('llm_base_url', body.llm.baseUrl)
      if (body.llm.apiKey !== undefined && !body.llm.apiKey.startsWith('****')) {
        db.setSetting('llm_api_key', body.llm.apiKey)
      }
      if (body.llm.ollamaHost) db.setSetting('ollama_host', body.llm.ollamaHost)
    }

    // Save embedding config
    if (body.embedding) {
      if (body.embedding.provider) db.setSetting('embed_provider', body.embedding.provider)
      if (body.embedding.model) db.setSetting('embed_model', body.embedding.model)
      if (body.embedding.baseUrl !== undefined) db.setSetting('embed_base_url', body.embedding.baseUrl)
      if (body.embedding.apiKey !== undefined && !body.embedding.apiKey.startsWith('****')) {
        db.setSetting('embed_api_key', body.embedding.apiKey)
      }
      if (body.embedding.dimensions !== undefined) db.setSetting('embed_dimensions', String(body.embedding.dimensions))
      if (body.embedding.ollamaHost) db.setSetting('ollama_host', body.embedding.ollamaHost)
    }

    // Reload providers if config changed
    if ((body.llm || body.embedding) && providerManager) {
      providerManager.reload()
    }

    return c.json({
      watchDirs: getWatchDirs(),
      indexing: getIndexingInfo(),
      llm: getLLMConfig(),
      embedding: getEmbedConfig(),
      version: '1.0.0',
    })
  })

  route.post('/settings/test-connection', async (c) => {
    const { type } = await c.req.json<{ type: 'llm' | 'embedding' }>()

    if (!providerManager) {
      return c.json({ error: 'Provider manager not available' }, 500)
    }

    if (type === 'llm') {
      try {
        const result = await providerManager.getLLMProvider().healthCheck()
        return c.json(result)
      } catch (err: any) {
        return c.json({ status: 'error', message: err.message }, 500)
      }
    } else if (type === 'embedding') {
      try {
        const ep = providerManager.getEmbeddingProvider()
        // Test by embedding a short string
        await ep.embedSingle('test')
        return c.json({ status: 'ok', provider: ep.name(), model: ep.modelName(), dimensions: ep.dimensions() })
      } catch (err: any) {
        return c.json({ status: 'error', message: err.message }, 500)
      }
    }

    return c.json({ error: 'Invalid type. Use "llm" or "embedding".' }, 400)
  })

  route.post('/index/trigger', async (c) => {
    const { path } = await c.req.json<{ path: string }>()
    if (!path) return c.json({ error: 'Missing required field: path' }, 400)
    const resolved = resolve(path)
    if (!existsSync(resolved)) return c.json({ error: 'Path does not exist' }, 404)

    // Recursively find files and enqueue them
    let queued = 0
    function enqueueDir(dir: string) {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.')) enqueueDir(full)
        } else {
          db.enqueue(full, 'created')
          queued++
        }
      }
    }
    enqueueDir(resolved)
    return c.json({ queued })
  })

  return route
}
