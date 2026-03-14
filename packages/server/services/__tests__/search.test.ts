import { describe, it, expect } from 'bun:test'
import { keywordScore, hybridRank } from '../search'

describe('keywordScore', () => {
  it('returns 1.0 for exact query match', () => {
    const score = keywordScore('hello world test', 'hello world test')
    expect(score).toBe(1.0)
  })

  it('returns 0 for no overlap', () => {
    const score = keywordScore('hello world', 'foo bar baz')
    expect(score).toBe(0)
  })

  it('returns partial score for partial match', () => {
    const score = keywordScore('hello world test', 'hello banana')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it('is case insensitive', () => {
    const score = keywordScore('Hello World', 'hello world')
    expect(score).toBe(1.0)
  })

  it('returns 0 for empty query', () => {
    const score = keywordScore('some text', '')
    expect(score).toBe(0)
  })
})

describe('hybridRank', () => {
  it('re-ranks results combining vector and keyword scores', () => {
    const results = [
      { id: '1', file_id: 'f1', text: 'cats and dogs playing', file_name: 'a.txt', file_type: 'doc', file_path: '/a.txt', _distance: 0.1 },
      { id: '2', file_id: 'f2', text: 'python programming tutorial', file_name: 'b.txt', file_type: 'doc', file_path: '/b.txt', _distance: 0.2 },
      { id: '3', file_id: 'f3', text: 'dogs in the park', file_name: 'c.txt', file_type: 'doc', file_path: '/c.txt', _distance: 0.3 },
    ]
    const ranked = hybridRank(results, 'dogs', 10)
    expect(ranked.length).toBe(3)
  })

  it('respects limit', () => {
    const results = [
      { id: '1', file_id: 'f1', text: 'hello', file_name: 'a.txt', file_type: 'doc', file_path: '/a.txt', _distance: 0.1 },
      { id: '2', file_id: 'f2', text: 'world', file_name: 'b.txt', file_type: 'doc', file_path: '/b.txt', _distance: 0.2 },
    ]
    const ranked = hybridRank(results, 'hello', 1)
    expect(ranked.length).toBe(1)
  })

  it('returns empty for empty results', () => {
    const ranked = hybridRank([], 'query', 10)
    expect(ranked).toEqual([])
  })
})
