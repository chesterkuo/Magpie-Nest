import { describe, it, expect } from 'bun:test'
import { buildToolDefinitions, executeTool } from '../tools/registry'

describe('Tool Registry', () => {
  it('has all MVP tools registered', () => {
    const tools = buildToolDefinitions()
    const names = tools.map((t: any) => t.function.name)
    expect(names).toContain('search_files')
    expect(names).toContain('play_media')
    expect(names).toContain('open_document')
    expect(names).toContain('list_recent')
    expect(names).toContain('get_file_info')
  })

  it('returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent', {})
    expect(result.error).toBeDefined()
  })
})
