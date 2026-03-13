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

  async create_playlist(args: { name: string; query?: string; file_type?: string; limit?: number }) {
    const { nanoid } = await import('nanoid')
    const id = nanoid()
    ctx.db.createPlaylist(id, args.name)

    if (args.query) {
      const vector = await ctx.embedQuery(args.query)
      const results = await ctx.vectorDb.search(vector, args.limit || 20)
      const audioResults = results.filter(r => r.file_type === 'audio')
      const seen = new Set<string>()
      const unique = audioResults.filter(r => {
        if (seen.has(r.file_id)) return false
        seen.add(r.file_id)
        return true
      })
      unique.forEach((r, i) => ctx.db.addToPlaylist(id, r.file_id, i))
      const files = unique
        .map(r => ctx.db.getFileById(r.file_id))
        .filter(Boolean)
        .map(toFileItem)
      return { playlist: { id, name: args.name }, files }
    }
    return { playlist: { id, name: args.name }, files: [] }
  },

  async list_directory(args: { path: string; sort_by?: string; file_type?: string }) {
    const allowedSort = ['name', 'modified_at', 'size']
    const sort = allowedSort.includes(args.sort_by || '') ? args.sort_by! : 'modified_at'
    const conditions: string[] = ['path LIKE ?']
    const params: unknown[] = [`${args.path}%`]
    if (args.file_type) {
      conditions.push('file_type = ?')
      params.push(args.file_type)
    }
    const where = ' WHERE ' + conditions.join(' AND ')
    const files = ctx.db.db.prepare(
      `SELECT * FROM files${where} ORDER BY ${sort} DESC LIMIT 100`
    ).all(...params) as any[]
    return { files: files.map(toFileItem) }
  },

  async get_disk_status(args: { path?: string }) {
    const { db } = ctx
    const types = ['video', 'audio', 'pdf', 'image', 'doc'] as const
    const fileStats: Record<string, { count: number; totalSize: number }> = {}
    for (const t of types) {
      const row = db.db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(size),0) as totalSize FROM files WHERE file_type = ?').get(t) as { count: number; totalSize: number }
      fileStats[t] = { count: row.count, totalSize: row.totalSize }
    }

    let disk = { free: 0, total: 0, used: 0 }
    try {
      const proc = Bun.spawn(['df', '-k', args.path || ctx.dataDir])
      const output = await new Response(proc.stdout).text()
      const lines = output.trim().split('\n')
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/)
        const total = parseInt(parts[1]) * 1024
        const used = parseInt(parts[2]) * 1024
        const free = parseInt(parts[3]) * 1024
        disk = { free, total, used }
      }
    } catch {}

    return { disk, fileStats }
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
    {
      type: 'function',
      function: {
        name: 'create_playlist',
        description: 'Create a named playlist. Optionally search for audio files to add to it.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Playlist name' },
            query: { type: 'string', description: 'Search query to find audio files to add' },
            limit: { type: 'number', description: 'Max tracks to add (default 20)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_directory',
        description: 'Browse the contents of a specific folder. Shows indexed files under the given path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to browse' },
            sort_by: { type: 'string', enum: ['name', 'modified', 'size'], description: 'Sort order' },
            file_type: { type: 'string', enum: ['video', 'audio', 'pdf', 'image', 'doc'], description: 'Filter by type' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_disk_status',
        description: 'Get disk usage statistics and file counts by type.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Specific path to check (defaults to data directory)' },
          },
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
