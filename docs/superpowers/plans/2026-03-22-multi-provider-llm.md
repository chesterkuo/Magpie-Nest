# Multi-Provider LLM Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Magpie to use external LLM providers (Gemini, OpenAI, etc.) via OpenAI-compatible API alongside the existing Ollama integration, with independent configuration for chat and embedding models.

**Architecture:** A provider abstraction layer (`LLMProvider` + `EmbeddingProvider` interfaces) sits between the agent loop / indexer and the underlying SDK. A `ProviderManager` class handles config resolution (SQLite settings > env vars > defaults), provider instantiation, and hot-swap on settings change. A new `settings` SQLite table stores runtime config.

**Tech Stack:** OpenAI npm SDK (`openai`), Bun runtime, Hono, SQLite (bun:sqlite), LanceDB

**Spec:** `docs/superpowers/specs/2026-03-22-multi-provider-llm-and-ui-redesign-design.md` (Section 1)

---

### Task 1: Add `settings` table to SQLite

**Files:**
- Modify: `packages/server/services/db.ts`
- Test: `packages/server/services/__tests__/db.test.ts`

- [ ] **Step 1: Write failing tests for settings CRUD**

Add to `packages/server/services/__tests__/db.test.ts`:
```typescript
describe('settings', () => {
  it('getSetting returns null for unknown key', () => {
    expect(db.getSetting('nonexistent')).toBeNull()
  })

  it('setSetting and getSetting round-trip', () => {
    db.setSetting('llm_provider', 'ollama')
    expect(db.getSetting('llm_provider')).toBe('ollama')
  })

  it('setSetting overwrites existing value', () => {
    db.setSetting('llm_model', 'v1')
    db.setSetting('llm_model', 'v2')
    expect(db.getSetting('llm_model')).toBe('v2')
  })

  it('getAllSettings returns all key-value pairs', () => {
    db.setSetting('a', '1')
    db.setSetting('b', '2')
    const all = db.getAllSettings()
    expect(all.a).toBe('1')
    expect(all.b).toBe('2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: FAIL — `getSetting` is not a function

- [ ] **Step 3: Add settings table schema and methods**

In `packages/server/services/db.ts`:

1. Add to the `MagpieDb` interface (after `close(): void` at line 51):
```typescript
  // Settings
  getSetting(key: string): string | null
  setSetting(key: string, value: string): void
  getAllSettings(): Record<string, string>
```

2. Add to the `db.exec()` SQL block (after the conversations index at line 109):
```sql
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT DEFAULT (datetime('now'))
    );
```

3. Add prepared statements (after `listConversations` at line 143):
```typescript
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`),
    getAllSettings: db.prepare('SELECT key, value FROM settings'),
```

4. Add methods to the return object (after `listConversations` method, before `close()`):
```typescript
    getSetting(key: string) {
      const row = stmts.getSetting.get(key) as { value: string } | null
      return row?.value ?? null
    },

    setSetting(key: string, value: string) {
      stmts.setSetting.run(key, value)
    },

    getAllSettings() {
      const rows = stmts.getAllSettings.all() as Array<{ key: string; value: string }>
      const result: Record<string, string> = {}
      for (const row of rows) result[row.key] = row.value
      return result
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: All 22+ tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/services/db.ts packages/server/services/__tests__/db.test.ts
git commit -m "feat: add settings table to SQLite for provider config"
```

---

### Task 2: Create provider type definitions

**Files:**
- Create: `packages/server/services/providers/types.ts`

- [ ] **Step 1: Create the types file**

Create `packages/server/services/providers/types.ts`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/services/providers/types.ts
git commit -m "feat: add provider type definitions"
```

---

### Task 3: Implement Ollama provider

**Files:**
- Create: `packages/server/services/providers/ollama.ts`
- Test: `packages/server/services/providers/__tests__/ollama.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/services/providers/__tests__/ollama.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'
import { createOllamaLLM, createOllamaEmbedding } from '../ollama'

describe('OllamaLLM', () => {
  it('returns correct name and model', () => {
    const llm = createOllamaLLM({ host: 'http://localhost:11434', model: 'qwen3:4b' })
    expect(llm.name()).toBe('ollama')
    expect(llm.modelName()).toBe('qwen3:4b')
  })
})

describe('OllamaEmbedding', () => {
  it('returns correct name and model', () => {
    const emb = createOllamaEmbedding({ host: 'http://localhost:11434', model: 'nomic-embed-text', dimensions: 768 })
    expect(emb.name()).toBe('ollama')
    expect(emb.modelName()).toBe('nomic-embed-text')
    expect(emb.dimensions()).toBe(768)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test services/providers/__tests__/ollama.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Ollama provider**

Create `packages/server/services/providers/ollama.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/server && bun test services/providers/__tests__/ollama.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/services/providers/ollama.ts packages/server/services/providers/__tests__/ollama.test.ts
git commit -m "feat: implement Ollama LLM and embedding providers"
```

---

### Task 4: Install OpenAI SDK and implement OpenAI-compatible provider

**Files:**
- Create: `packages/server/services/providers/openai-compat.ts`
- Test: `packages/server/services/providers/__tests__/openai-compat.test.ts`

- [ ] **Step 1: Install openai package**

Run: `cd packages/server && bun add openai`

- [ ] **Step 2: Write failing test**

Create `packages/server/services/providers/__tests__/openai-compat.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test'
import { createOpenAICompatLLM, createOpenAICompatEmbedding } from '../openai-compat'

describe('OpenAICompatLLM', () => {
  it('returns correct name and model', () => {
    const llm = createOpenAICompatLLM({
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com',
      model: 'gemini-2.5-flash',
    })
    expect(llm.name()).toBe('openai-compatible')
    expect(llm.modelName()).toBe('gemini-2.5-flash')
  })
})

describe('OpenAICompatEmbedding', () => {
  it('returns correct name, model, dimensions', () => {
    const emb = createOpenAICompatEmbedding({
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com',
      model: 'gemini-embedding-2-preview',
      dimensions: 3072,
    })
    expect(emb.name()).toBe('openai-compatible')
    expect(emb.modelName()).toBe('gemini-embedding-2-preview')
    expect(emb.dimensions()).toBe(3072)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/server && bun test services/providers/__tests__/openai-compat.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement OpenAI-compatible provider**

Create `packages/server/services/providers/openai-compat.ts`:
```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/server && bun test services/providers/__tests__/openai-compat.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/services/providers/openai-compat.ts packages/server/services/providers/__tests__/openai-compat.test.ts packages/server/package.json
git commit -m "feat: implement OpenAI-compatible LLM and embedding providers"
```

---

### Task 5: Implement ProviderManager factory

**Files:**
- Create: `packages/server/services/providers/factory.ts`
- Test: `packages/server/services/providers/__tests__/factory.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/server/services/providers/__tests__/factory.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test services/providers/__tests__/factory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ProviderManager**

Create `packages/server/services/providers/factory.ts`:
```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && bun test services/providers/__tests__/factory.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/services/providers/factory.ts packages/server/services/providers/__tests__/factory.test.ts
git commit -m "feat: implement ProviderManager factory with config resolution"
```

---

### Task 6: Add `dropTable` and `getDimensions` to VectorDb

**Files:**
- Modify: `packages/server/services/lancedb.ts`
- Test: `packages/server/services/__tests__/lancedb.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/server/services/__tests__/lancedb.test.ts`:
```typescript
it('dropTable clears all chunks', async () => {
  // Add some chunks first
  await vectorDb.addChunks([{
    id: 'drop-1', file_id: 'f1', text: 'test', vector: new Array(768).fill(0.1),
    file_name: 'test.txt', file_type: 'doc', file_path: '/tmp/test.txt',
  }])
  expect(await vectorDb.count()).toBe(1)
  await vectorDb.dropTable()
  expect(await vectorDb.count()).toBe(0)
})

it('getDimensions returns null for empty table', async () => {
  expect(await vectorDb.getDimensions()).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test services/__tests__/lancedb.test.ts`
Expected: FAIL — `dropTable` is not a function

- [ ] **Step 3: Add methods to VectorDb interface and implementation**

In `packages/server/services/lancedb.ts`:

1. Add to `VectorDb` interface (after `count()` at line 28):
```typescript
  dropTable(): Promise<void>
  getDimensions(): Promise<number | null>
```

2. Add to the return object (after `count()` method):
```typescript
    async dropTable() {
      const tableNames = await db.tableNames()
      if (tableNames.includes('file_chunks')) {
        await db.dropTable('file_chunks')
      }
    },

    async getDimensions() {
      try {
        const table = await db.openTable('file_chunks')
        const rows = await table.query().limit(1).toArray()
        if (rows.length > 0 && rows[0].vector) {
          return (rows[0].vector as number[]).length
        }
      } catch {}
      return null
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && bun test services/__tests__/lancedb.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/services/lancedb.ts packages/server/services/__tests__/lancedb.test.ts
git commit -m "feat: add dropTable and getDimensions to VectorDb"
```

---

### Task 7: Refactor agent loop to use LLMProvider

**Files:**
- Modify: `packages/server/agent/loop.ts`
- Modify: `packages/server/routes/chat.ts`
- Test: `packages/server/agent/__tests__/loop.test.ts`

- [ ] **Step 1: Refactor agent loop signature**

Rewrite `packages/server/agent/loop.ts`:
```typescript
import { SYSTEM_PROMPT } from './prompt'
import { buildToolDefinitions, executeTool } from './tools/registry'
import type { AgentChunk } from '@magpie/shared'
import type { LLMProvider } from '../services/providers/types'

const MAX_ITERATIONS = 5

export async function* runAgent(
  llmProvider: LLMProvider,
  userMessage: string,
  history: Array<{ role: string; content: string }> = []
): AsyncGenerator<AgentChunk> {
  const tools = buildToolDefinitions()
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-20),
    { role: 'user', content: userMessage },
  ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await llmProvider.chat({ messages, tools })

    if (response.tool_calls?.length) {
      for (const toolCall of response.tool_calls) {
        yield { type: 'thinking', tool: toolCall.function.name }

        const result = await executeTool(
          toolCall.function.name,
          toolCall.function.arguments
        )

        messages.push({ role: 'assistant', content: response.content || '', tool_calls: [toolCall] })
        messages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id })

        if (result.files?.length) {
          yield { type: 'render', items: result.files }
        }
      }
      continue
    }

    // Final response — stream it
    for await (const chunk of llmProvider.chatStream({ messages })) {
      if (chunk.content) {
        yield { type: 'text', content: chunk.content }
      }
    }
    break
  }
}
```

- [ ] **Step 2: Update chat route to pass LLMProvider**

Rewrite `packages/server/routes/chat.ts`:
```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { runAgent } from '../agent/loop'
import type { LLMProvider } from '../services/providers/types'

export function createChatRoute(getLLMProvider: () => LLMProvider) {
  const route = new Hono()

  route.post('/chat', async (c) => {
    const { message, history } = await c.req.json<{
      message: string
      history?: Array<{ role: string; content: string }>
    }>()

    if (!message?.trim()) {
      return c.json({ error: 'Message is required' }, 400)
    }

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of runAgent(getLLMProvider(), message, history || [])) {
          await stream.writeSSE({
            data: JSON.stringify(chunk),
            event: 'chunk',
          })
        }
      } catch (err: any) {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'error', message: err.message }),
          event: 'chunk',
        })
      }
    })
  })

  return route
}
```

- [ ] **Step 3: Run existing agent loop tests**

Run: `cd packages/server && bun test agent/__tests__/loop.test.ts`
Expected: Tests may need updating to pass LLMProvider — fix as needed.

- [ ] **Step 4: Commit**

```bash
git add packages/server/agent/loop.ts packages/server/routes/chat.ts
git commit -m "refactor: agent loop and chat route use LLMProvider interface"
```

---

### Task 8: Refactor indexer to use EmbeddingProvider

**Files:**
- Modify: `packages/server/services/indexer.ts`
- Remove: `packages/server/services/embeddings.ts` (functionality moved to providers)

- [ ] **Step 1: Update indexer to accept embed function**

In `packages/server/services/indexer.ts`, change line 3:
```typescript
// OLD: import { embed } from './embeddings'
// The embed function is now passed via a parameter
```

Update `processFile` signature (line 15) to accept an embed function:
```typescript
export async function processFile(
  filePath: string,
  db: MagpieDb,
  vectorDb: VectorDb,
  embed: (texts: string[]) => Promise<number[][]>
): Promise<void> {
```

The `embed` call at line 77 already uses the function name — no change needed in the body.

- [ ] **Step 2: Update indexer worker to accept embed function**

Read `packages/server/workers/indexer.worker.ts` and update it to receive the embed function from the bootstrap context. The worker should import from the tool context or receive it as a parameter.

- [ ] **Step 3: Delete embeddings.ts**

Delete `packages/server/services/embeddings.ts` — its functionality is now in the providers.

- [ ] **Step 4: Run tests**

Run: `cd packages/server && bun test`
Expected: All tests pass (embeddings.ts was not directly tested, only used by indexer)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: indexer uses provider embed function, remove embeddings.ts"
```

---

### Task 9: Wire ProviderManager into bootstrap and routes

**Files:**
- Modify: `packages/server/bootstrap.ts`
- Modify: `packages/server/index.ts`
- Modify: `packages/server/routes/health.ts`
- Modify: `packages/server/routes/settings.ts`

- [ ] **Step 1: Update bootstrap.ts**

Rewrite `packages/server/bootstrap.ts` to use ProviderManager:
```typescript
import { createDb, type MagpieDb } from './services/db'
import { createVectorDb, type VectorDb } from './services/lancedb'
import { ProviderManager } from './services/providers/factory'
import { initToolContext } from './agent/tools/registry'
import { createWatcher } from './services/watcher'
import { existsSync, mkdirSync } from 'fs'

const DATA_DIR = process.env.DATA_DIR || './data'
const SQLITE_PATH = `${DATA_DIR}/sqlite/magpie.db`
const LANCEDB_PATH = `${DATA_DIR}/lancedb`
const WATCH_DIRS = (process.env.WATCH_DIRS || '').split(',').filter(Boolean)

export interface AppContext {
  db: MagpieDb
  vectorDb: VectorDb
  providerManager: ProviderManager
  getWatchDirs: () => string[]
  setWatchDirs: (dirs: string[]) => void
}

export async function bootstrap(): Promise<AppContext> {
  for (const dir of ['sqlite', 'lancedb', 'thumbs', 'hls-cache']) {
    const path = `${DATA_DIR}/${dir}`
    if (!existsSync(path)) mkdirSync(path, { recursive: true })
  }

  let currentWatchDirs = [...WATCH_DIRS]
  let currentWatcher: { close: () => Promise<void> } | null = null

  const db = createDb(SQLITE_PATH)
  const vectorDb = await createVectorDb(LANCEDB_PATH)
  const providerManager = new ProviderManager(db)

  initToolContext({
    db,
    vectorDb,
    embedQuery: (text) => providerManager.getEmbeddingProvider().embedSingle(text),
    dataDir: DATA_DIR,
  })

  function startWatcher(dirs: string[]) {
    if (dirs.length === 0) return null
    const w = createWatcher(dirs, (filePath, eventType) => {
      console.log(`[watcher] ${eventType}: ${filePath}`)
      if (eventType === 'deleted') {
        db.deleteFileByPath(filePath)
      } else {
        db.enqueue(filePath, eventType)
      }
    }, 30000)
    console.log(`[watcher] Watching: ${dirs.join(', ')}`)
    return w
  }

  currentWatcher = startWatcher(WATCH_DIRS)

  console.log('[magpie] Server bootstrapped')
  return {
    db,
    vectorDb,
    providerManager,
    getWatchDirs: () => currentWatchDirs,
    setWatchDirs: (dirs: string[]) => {
      if (currentWatcher) currentWatcher.close()
      currentWatchDirs = dirs
      currentWatcher = startWatcher(dirs)
    },
  }
}
```

- [ ] **Step 2: Update index.ts to wire new routes**

Update `packages/server/index.ts` to use `createChatRoute` and pass `providerManager`:
```typescript
// Replace: import { chatRoute } from './routes/chat'
import { createChatRoute } from './routes/chat'

// In the route setup, replace:
// api.route('/', chatRoute)
// With:
api.route('/', createChatRoute(() => appContext.providerManager.getLLMProvider()))
```

- [ ] **Step 3: Update health route to use ProviderManager**

Update `packages/server/routes/health.ts` to accept `ProviderManager` and call `healthCheck()` on both providers instead of manually checking Ollama:

Change function signature:
```typescript
export function createHealthRoute(db: MagpieDb, vectorDb: VectorDb, getWatchDirs: () => string[], providerManager: ProviderManager) {
```

Replace the Ollama health check section (lines 14-27) with:
```typescript
    // Check LLM provider
    let llmStatus: any = { status: 'error', model: '', loaded: false }
    try {
      llmStatus = await providerManager.getLLMProvider().healthCheck()
    } catch {}

    // Check embedding provider
    let embedStatus: any = { status: 'error', model: '', loaded: false }
    try {
      embedStatus = await providerManager.getEmbeddingProvider().healthCheck()
    } catch {}
```

Update the response to include both:
```typescript
    services: {
      llm: { ...llmStatus, provider: providerManager.getLLMProvider().name() },
      embedding: { ...embedStatus, provider: providerManager.getEmbeddingProvider().name() },
      lancedb: lanceStatus,
      sqlite: sqliteStatus,
      whisper: whisperStatus,
      kokoro: { ... },
    },
```

- [ ] **Step 4: Update settings route with LLM config + test-connection**

Update `packages/server/routes/settings.ts` to:
- Accept `providerManager` parameter
- Include LLM/embedding config in GET response (mask API keys)
- Handle LLM/embedding config in PUT (save to settings table, call `providerManager.reload()`)
- Add `POST /settings/test-connection` endpoint

See spec section "Settings API Endpoints" for exact request/response shapes.

- [ ] **Step 5: Update index.ts route wiring**

Update `packages/server/index.ts` to pass `providerManager` to health and settings routes.

- [ ] **Step 6: Run all tests**

Run: `cd packages/server && bun test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire ProviderManager into bootstrap, health, settings, and chat routes"
```

---

### Task 10: Update .env.example and worker

**Files:**
- Modify: `.env.example`
- Modify: `packages/server/workers/indexer.worker.ts`

- [ ] **Step 1: Update .env.example**

Add new env vars to `.env.example`:
```
# LLM Provider (default: openai-compatible)
LLM_PROVIDER=openai-compatible
LLM_API_KEY=
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.5-flash

# Embedding Provider (default: openai-compatible)
EMBED_PROVIDER=openai-compatible
EMBED_API_KEY=
EMBED_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
EMBED_MODEL=gemini-embedding-2-preview

# Ollama (used when provider=ollama)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

- [ ] **Step 2: Update indexer worker to use provider embed**

The indexer worker at `packages/server/workers/indexer.worker.ts` currently imports `embed` from `../services/embeddings`. Update it to receive the embed function from the provider manager (via the module-level context or by passing it through the worker initialization).

- [ ] **Step 3: Run full test suite**

Run: `cd packages/server && bun test`
Expected: All 165+ tests pass

- [ ] **Step 4: Manual test — chat with Gemini**

1. Ensure `.env` has the Gemini API key configured
2. Restart the dev server: `bun run dev`
3. Open http://localhost:5173
4. Send a chat message
5. Verify response streams from Gemini 2.5 Flash

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: update env config and indexer worker for multi-provider support"
```

---

### Task 11: Update README for multi-provider setup

**Files:**
- Modify: `README.md`
- Modify: `README.zh-TW.md`

- [ ] **Step 1: Update both READMEs**

Add a section on LLM provider configuration. Update the environment variables table with new vars. Note that external LLM is the default and Ollama is optional.

- [ ] **Step 2: Commit**

```bash
git add README.md README.zh-TW.md
git commit -m "docs: update README for multi-provider LLM support"
```
