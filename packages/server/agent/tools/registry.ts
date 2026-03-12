import type { MagpieDb } from '../../services/db'
import type { VectorDb } from '../../services/lancedb'
import type { FileItem, FileType, RenderType } from '@magpie/shared'

interface ToolContext {
  db: MagpieDb
  vectorDb: VectorDb
  embedQuery: (text: string) => Promise<number[]>
  dataDir: string
}

let ctx: ToolContext

export function initToolContext(context: ToolContext) {
  ctx = context
}

function fileTypeToRenderType(type: FileType): RenderType {
  const map: Record<FileType, RenderType> = {
    video: 'video_card',
    audio: 'audio_player',
    pdf: 'pdf_preview',
    image: 'image_grid',
    doc: 'file_list',
  }
  return map[type] || 'file_list'
}

function toFileItem(record: any): FileItem {
  return {
    id: record.id,
    name: record.name || record.file_name,
    type: record.file_type as FileType,
    size: record.size || 0,
    modified: record.modified_at || record.modified || '',
    renderType: fileTypeToRenderType(record.file_type as FileType),
    streamUrl: `/api/stream/${record.id}`,
    thumbUrl: `/api/thumb/${record.id}`,
  }
}

const toolImplementations: Record<string, (args: any) => Promise<any>> = {
  async search_files(args: { query: string; file_type?: string; days_ago?: number; limit?: number }) {
    const vector = await ctx.embedQuery(args.query)
    const results = await ctx.vectorDb.search(vector, args.limit || 10)

    let filtered = results
    if (args.file_type) {
      filtered = results.filter((r) => r.file_type === args.file_type)
    }

    const seen = new Set<string>()
    const unique = filtered.filter((r) => {
      if (seen.has(r.file_id)) return false
      seen.add(r.file_id)
      return true
    })

    const files = unique
      .map((r) => ctx.db.getFileById(r.file_id))
      .filter(Boolean)
      .map(toFileItem)

    return { files }
  },

  async play_media(args: { file_id: string }) {
    const file = ctx.db.getFileById(args.file_id)
    if (!file) return { error: 'File not found' }
    return { files: [toFileItem(file)] }
  },

  async open_document(args: { file_id: string }) {
    const file = ctx.db.getFileById(args.file_id)
    if (!file) return { error: 'File not found' }
    return { files: [toFileItem(file)] }
  },

  async list_recent(args: { days?: number; file_type?: string; limit?: number }) {
    const records = ctx.db.listRecent({
      days: args.days || 7,
      file_type: args.file_type,
      limit: args.limit || 20,
    })
    return { files: records.map(toFileItem) }
  },

  async get_file_info(args: { file_id: string }) {
    const file = ctx.db.getFileById(args.file_id)
    if (!file) return { error: 'File not found' }
    return {
      files: [toFileItem(file)],
      metadata: JSON.parse(file.meta),
    }
  },
}

export function buildToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'search_files',
        description: 'Search for files using natural language. Uses semantic vector search across all indexed files.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural language search query' },
            file_type: { type: 'string', enum: ['video', 'audio', 'pdf', 'image', 'doc'], description: 'Filter by file type' },
            days_ago: { type: 'number', description: 'Only search files modified within this many days' },
            limit: { type: 'number', description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'play_media',
        description: 'Play a video or audio file. Returns streaming URL for playback.',
        parameters: {
          type: 'object',
          properties: {
            file_id: { type: 'string', description: 'The file ID to play' },
          },
          required: ['file_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_document',
        description: 'Open a document (PDF, DOCX, etc.) for preview.',
        parameters: {
          type: 'object',
          properties: {
            file_id: { type: 'string', description: 'The file ID to open' },
          },
          required: ['file_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_recent',
        description: 'List recently added or modified files.',
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Number of days to look back (default 7)' },
            file_type: { type: 'string', enum: ['video', 'audio', 'pdf', 'image', 'doc'], description: 'Filter by type' },
            limit: { type: 'number', description: 'Max results (default 20)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_file_info',
        description: 'Get detailed information and metadata about a specific file.',
        parameters: {
          type: 'object',
          properties: {
            file_id: { type: 'string', description: 'The file ID' },
          },
          required: ['file_id'],
        },
      },
    },
  ]
}

export async function executeTool(name: string, args: any): Promise<any> {
  const fn = toolImplementations[name]
  if (!fn) return { error: `Unknown tool: ${name}` }
  return fn(args)
}
