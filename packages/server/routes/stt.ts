import { Hono } from 'hono'
import { transcribe } from '../services/stt'

export const sttRoute = new Hono()

sttRoute.post('/stt', async (c) => {
  try {
    const formData = await c.req.formData()
    const audio = formData.get('audio') as File | null
    if (!audio) return c.json({ error: 'Missing audio field' }, 400)

    const buffer = await audio.arrayBuffer()
    const result = await transcribe(buffer)
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 503)
  }
})
