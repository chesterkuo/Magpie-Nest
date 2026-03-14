import type { SearchResult } from './lancedb'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet',
  'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'about', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which',
  'who', 'whom',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

export function keywordScore(text: string, query: string): number {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return 0
  const textTokens = new Set(tokenize(text))
  const matches = queryTokens.filter(t => textTokens.has(t)).length
  return matches / queryTokens.length
}

export function hybridRank(
  results: SearchResult[],
  query: string,
  limit: number,
  alpha = 0.3
): SearchResult[] {
  if (results.length === 0) return []
  const maxDist = Math.max(...results.map(r => r._distance), 0.001)
  const scored = results.map(r => {
    const vectorScore = 1 - (r._distance / maxDist)
    const kwScore = keywordScore(r.text, query)
    const hybrid = (1 - alpha) * vectorScore + alpha * kwScore
    return { result: r, hybrid }
  })
  scored.sort((a, b) => b.hybrid - a.hybrid)
  return scored.slice(0, limit).map(s => s.result)
}
