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
    ...history.slice(-20), // Keep last 20 messages for context window management
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
