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
