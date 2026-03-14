import { Ollama } from 'ollama'
import { SYSTEM_PROMPT } from './prompt'
import { buildToolDefinitions, executeTool } from './tools/registry'
import type { AgentChunk } from '@magpie/shared'

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
})
const MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b'
const MAX_ITERATIONS = 5

export async function* runAgent(
  userMessage: string,
  history: Array<{ role: string; content: string }> = []
): AsyncGenerator<AgentChunk> {
  const tools = buildToolDefinitions()
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-20), // Keep last 20 messages for context window management
    { role: 'user', content: userMessage },
  ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await ollama.chat({
      model: MODEL,
      messages,
      tools,
      stream: false,
    })

    if (response.message.tool_calls?.length) {
      for (const toolCall of response.message.tool_calls) {
        yield { type: 'thinking', tool: toolCall.function.name }

        const result = await executeTool(
          toolCall.function.name,
          toolCall.function.arguments
        )

        messages.push(response.message)
        messages.push({ role: 'tool', content: JSON.stringify(result) })

        if (result.files?.length) {
          yield { type: 'render', items: result.files }
        }
      }
      continue
    }

    // Final response — stream it
    const finalStream = await ollama.chat({
      model: MODEL,
      messages,
      stream: true,
    })

    for await (const chunk of finalStream) {
      if (chunk.message.content) {
        yield { type: 'text', content: chunk.message.content }
      }
    }
    break
  }
}
