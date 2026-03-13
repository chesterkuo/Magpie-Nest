import { Hono } from 'hono'
import { synthesize } from '../services/tts'

export const ttsRoute = new Hono()

ttsRoute.post('/tts', async (c) => {
  try {
    const { text, language } = await c.req.json<{ text: string; language?: string }>()
    if (!text) return c.json({ error: 'Missing required field: text' }, 400)

    const audioResponse = await synthesize(text, language || 'en')
    const audioBuffer = await audioResponse.arrayBuffer()

    // Note: spec says audio/mpeg but Kokoro outputs WAV natively.
    // WAV works fine for browser playback via <audio>. Convert to mpeg in Phase 2 if needed.
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBuffer.byteLength),
      },
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 503)
  }
})
