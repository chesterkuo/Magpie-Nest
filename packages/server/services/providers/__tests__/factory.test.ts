import { describe, it, expect } from 'bun:test'
import { createDb } from '../../db'
import { ProviderManager } from '../factory'

describe('ProviderManager', () => {
  it('creates Ollama providers when configured', () => {
    const db = createDb(':memory:')
    const pm = new ProviderManager(db)
    // Set Ollama config
    db.setSetting('llm_provider', 'ollama')
    db.setSetting('embed_provider', 'ollama')
    pm.reload()

    expect(pm.getLLMProvider().name()).toBe('ollama')
    expect(pm.getEmbeddingProvider().name()).toBe('ollama')
    db.close()
  })

  it('creates OpenAI-compatible providers when configured', () => {
    const db = createDb(':memory:')
    const pm = new ProviderManager(db)
    db.setSetting('llm_provider', 'openai-compatible')
    db.setSetting('llm_api_key', 'test-key')
    db.setSetting('llm_base_url', 'https://api.test.com')
    db.setSetting('llm_model', 'test-model')
    db.setSetting('embed_provider', 'openai-compatible')
    db.setSetting('embed_api_key', 'test-key')
    db.setSetting('embed_base_url', 'https://api.test.com')
    db.setSetting('embed_model', 'test-embed')
    pm.reload()

    expect(pm.getLLMProvider().name()).toBe('openai-compatible')
    expect(pm.getEmbeddingProvider().name()).toBe('openai-compatible')
    db.close()
  })

  it('falls back to env vars when no SQLite settings', () => {
    const db = createDb(':memory:')
    // env vars are read at process level; just verify it doesn't throw
    const pm = new ProviderManager(db)
    pm.reload()
    expect(pm.getLLMProvider()).toBeTruthy()
    expect(pm.getEmbeddingProvider()).toBeTruthy()
    db.close()
  })
})
