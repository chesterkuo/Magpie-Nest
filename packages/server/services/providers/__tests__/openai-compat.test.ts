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
