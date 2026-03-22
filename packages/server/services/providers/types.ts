export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolCall {
  id: string
  function: { name: string; arguments: Record<string, unknown> }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ChatResponse {
  content: string
  tool_calls?: ToolCall[]
}

export interface ChatStreamChunk {
  content: string
}

export interface LLMProvider {
  chat(opts: {
    messages: ChatMessage[]
    tools?: ToolDefinition[]
  }): Promise<ChatResponse>

  chatStream(opts: {
    messages: ChatMessage[]
  }): AsyncIterable<ChatStreamChunk>

  name(): string
  modelName(): string
  healthCheck(): Promise<{ status: string; model: string; loaded: boolean }>
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
  embedSingle(text: string): Promise<number[]>
  name(): string
  modelName(): string
  dimensions(): number
}

export interface ProviderConfig {
  provider: 'ollama' | 'openai-compatible'
  apiKey?: string
  baseUrl?: string
  model: string
  // Ollama-specific
  ollamaHost?: string
}
