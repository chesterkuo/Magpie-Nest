import { Ollama } from 'ollama'

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
})

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'

export async function embed(texts: string[]): Promise<number[][]> {
  const response = await ollama.embed({ model: EMBED_MODEL, input: texts })
  return response.embeddings
}

export async function embedSingle(text: string): Promise<number[]> {
  const [vector] = await embed([text])
  return vector
}
