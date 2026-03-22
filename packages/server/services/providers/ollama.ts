import { Ollama } from 'ollama'
import type { LLMProvider, EmbeddingProvider, ChatMessage, ToolDefinition, ChatResponse, ChatStreamChunk, ToolCall } from './types'

export function createOllamaLLM(config: { host: string; model: string }): LLMProvider {
  const ollama = new Ollama({ host: config.host })

  return {
    async chat({ messages, tools }) {
      const response = await ollama.chat({
        model: config.model,
        messages: messages as any,
        tools: tools as any,
        stream: false,
      })

      const toolCalls: ToolCall[] | undefined = response.message.tool_calls?.map((tc: any) => ({
        id: tc.function?.name || 'call',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }))

      return {
        content: response.message.content || '',
        tool_calls: toolCalls?.length ? toolCalls : undefined,
      }
    },

    async *chatStream({ messages }) {
      const stream = await ollama.chat({
        model: config.model,
        messages: messages as any,
        stream: true,
      })
      for await (const chunk of stream) {
        if (chunk.message.content) {
          yield { content: chunk.message.content }
        }
      }
    },

    name() { return 'ollama' },
    modelName() { return config.model },

    async healthCheck() {
      try {
        const res = await fetch(`${config.host}/api/tags`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = await res.json() as { models?: Array<{ name: string }> }
          const loaded = data.models?.some(m => m.name.includes(config.model.split(':')[0])) ?? false
          return { status: 'ok', model: config.model, loaded }
        }
      } catch {}
      return { status: 'error', model: config.model, loaded: false }
    },
  }
}

export function createOllamaEmbedding(config: { host: string; model: string; dimensions: number }): EmbeddingProvider {
  const ollama = new Ollama({ host: config.host })

  return {
    async embed(texts: string[]) {
      const response = await ollama.embed({ model: config.model, input: texts })
      return response.embeddings
    },

    async embedSingle(text: string) {
      const [vector] = await this.embed([text])
      return vector
    },

    name() { return 'ollama' },
    modelName() { return config.model },
    dimensions() { return config.dimensions },
  }
}
