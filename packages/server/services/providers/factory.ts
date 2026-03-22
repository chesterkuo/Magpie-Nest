import type { MagpieDb } from '../db'
import type { LLMProvider, EmbeddingProvider } from './types'
import { createOllamaLLM, createOllamaEmbedding } from './ollama'
import { createOpenAICompatLLM, createOpenAICompatEmbedding } from './openai-compat'

export class ProviderManager {
  private db: MagpieDb
  private llm!: LLMProvider
  private embedding!: EmbeddingProvider

  constructor(db: MagpieDb) {
    this.db = db
    this.reload()
  }

  private resolve(key: string, envKey: string, fallback: string): string {
    return this.db.getSetting(key) || process.env[envKey] || fallback
  }

  reload() {
    // --- LLM ---
    const llmProvider = this.resolve('llm_provider', 'LLM_PROVIDER', 'openai-compatible')
    if (llmProvider === 'ollama') {
      const host = this.resolve('ollama_host', 'OLLAMA_HOST', 'http://localhost:11434')
      const model = this.resolve('llm_model', 'OLLAMA_MODEL', 'qwen3:4b')
      this.llm = createOllamaLLM({ host, model })
    } else {
      const apiKey = this.resolve('llm_api_key', 'LLM_API_KEY', '')
      const baseUrl = this.resolve('llm_base_url', 'LLM_BASE_URL', '')
      const model = this.resolve('llm_model', 'LLM_MODEL', '')

      if (apiKey && baseUrl && model) {
        this.llm = createOpenAICompatLLM({ apiKey, baseUrl, model })
      } else {
        // Fallback to Ollama if no API key configured
        const host = this.resolve('ollama_host', 'OLLAMA_HOST', 'http://localhost:11434')
        const model = this.resolve('llm_model', 'OLLAMA_MODEL', 'qwen3:4b')
        this.llm = createOllamaLLM({ host, model })
      }
    }

    // --- Embedding ---
    const embedProvider = this.resolve('embed_provider', 'EMBED_PROVIDER', 'openai-compatible')
    if (embedProvider === 'ollama') {
      const host = this.resolve('ollama_host', 'OLLAMA_HOST', 'http://localhost:11434')
      const model = this.resolve('embed_model', 'OLLAMA_EMBED_MODEL', 'nomic-embed-text')
      const dims = parseInt(this.resolve('embed_dimensions', '', '768'))
      this.embedding = createOllamaEmbedding({ host, model, dimensions: dims })
    } else {
      const apiKey = this.resolve('embed_api_key', 'EMBED_API_KEY', '')
      const baseUrl = this.resolve('embed_base_url', 'EMBED_BASE_URL', '')
      const model = this.resolve('embed_model', 'EMBED_MODEL', '')
      const dims = parseInt(this.resolve('embed_dimensions', '', '3072'))

      if (apiKey && baseUrl && model) {
        this.embedding = createOpenAICompatEmbedding({ apiKey, baseUrl, model, dimensions: dims })
      } else {
        const host = this.resolve('ollama_host', 'OLLAMA_HOST', 'http://localhost:11434')
        const embedModel = this.resolve('embed_model', 'OLLAMA_EMBED_MODEL', 'nomic-embed-text')
        this.embedding = createOllamaEmbedding({ host, model: embedModel, dimensions: 768 })
      }
    }
  }

  getLLMProvider(): LLMProvider { return this.llm }
  getEmbeddingProvider(): EmbeddingProvider { return this.embedding }
}
