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
