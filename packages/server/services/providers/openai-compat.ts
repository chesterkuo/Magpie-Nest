import OpenAI from 'openai'
import type { LLMProvider, EmbeddingProvider, ChatResponse, ChatStreamChunk, ToolCall } from './types'

export function createOpenAICompatLLM(config: {
  apiKey: string
  baseUrl: string
  model: string
}): LLMProvider {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })

  return {
    async chat({ messages, tools }) {
      const res = await client.chat.completions.create({
        model: config.model,
        messages: messages as any,
        tools: tools as any,
        stream: false,
      })

      const msg = res.choices[0]?.message
      let toolCalls: ToolCall[] | undefined

      if (msg?.tool_calls?.length) {
        toolCalls = msg.tool_calls.map(tc => ({
          id: tc.id,
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
          },
        }))
      }

      return {
        content: msg?.content || '',
        tool_calls: toolCalls,
      }
    },

    async *chatStream({ messages }) {
      const stream = await client.chat.completions.create({
        model: config.model,
        messages: messages as any,
        stream: true,
      })
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) yield { content }
      }
    },

    name() { return 'openai-compatible' },
    modelName() { return config.model },

    async healthCheck() {
      try {
        const models = await client.models.list()
        const loaded = models.data?.some(m => m.id.includes(config.model)) ?? false
        return { status: 'ok', model: config.model, loaded }
      } catch (err: any) {
        // Gemini's OpenAI-compatible endpoint may not support /models
        // Try a minimal chat to check connectivity
        try {
          await client.chat.completions.create({
            model: config.model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          })
          return { status: 'ok', model: config.model, loaded: true }
        } catch {
          return { status: 'error', model: config.model, loaded: false }
        }
      }
    },
  }
}

export function createOpenAICompatEmbedding(config: {
  apiKey: string
  baseUrl: string
  model: string
  dimensions: number
}): EmbeddingProvider {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })

  return {
    async embed(texts: string[]) {
      const res = await client.embeddings.create({
        model: config.model,
        input: texts,
      })
      return res.data.map(d => d.embedding)
    },

    async embedSingle(text: string) {
      const [vector] = await this.embed([text])
      return vector
    },

    name() { return 'openai-compatible' },
    modelName() { return config.model },
    dimensions() { return config.dimensions },
  }
}
