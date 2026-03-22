import type { MagpieDb } from '../../services/db'
import type { VectorDb } from '../../services/lancedb'
import { fileTypeToRenderType, type FileItem, type FileType, type RenderType } from '@magpie/shared'
import { hybridRank } from '../../services/search'

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

function toFileItem(record: any): FileItem {
  let meta: Record<string, any> = {}
  try { meta = JSON.parse(record.meta || '{}') } catch {}
  return {
    id: record.id,
    name: record.name || record.file_name,
    type: record.file_type as FileType,
    size: record.size || 0,
    modified: record.modified_at || record.modified || '',
    renderType: fileTypeToRenderType(record.file_type as FileType),
    streamUrl: `/api/stream/${record.id}`,
    thumbUrl: `/api/thumb/${record.id}`,
    ...(meta.duration != null && { duration: meta.duration }),
    ...(meta.artist && { artist: meta.artist }),
    ...(meta.album && { album: meta.album }),
    ...(meta.width && { width: meta.width }),
    ...(meta.height && { height: meta.height }),
  }
}

const toolImplementations: Record<string, (args: any) => Promise<any>> = {
  async search_files(args: { query: string; file_type?: string; days_ago?: number; limit?: number }) {
    const limit = args.limit || 10
    // Over-fetch 3x when filters applied to ensure enough results after filtering
    const fetchMultiplier = (args.file_type || args.days_ago) ? 3 : 1
    const vector = await ctx.embedQuery(args.query)
    const results = await ctx.vectorDb.search(vector, Math.max(limit * fetchMultiplier, limit * 3))

    // Hybrid re-rank with keyword scoring
    const ranked = hybridRank(results, args.query, results.length)

    let filtered = ranked
    if (args.file_type) {
      filtered = filtered.filter((r) => r.file_type === args.file_type)
    }

    if (args.days_ago) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - args.days_ago)
      const cutoffStr = cutoff.toISOString()
      filtered = filtered.filter((r) => {
        const file = ctx.db.getFileById(r.file_id)
        return file && file.modified_at >= cutoffStr
      })
    }

    const seen = new Set<string>()
    const unique = filtered.filter((r) => {
      if (seen.has(r.file_id)) return false
      seen.add(r.file_id)
      return true
    })

    // Trim to requested limit after filtering
    const trimmed = unique.slice(0, limit)

    const files = trimmed
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
    const sortMap: Record<string, string> = { name: 'name', modified_at: 'modified_at', modified: 'modified_at', size: 'size' }
    const sort = sortMap[args.sort_by || ''] || 'modified_at'
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

  async organize_files(args: { path: string; strategy?: string }) {
    const { existsSync, mkdirSync, renameSync } = await import('fs')
    const { join, basename, dirname, resolve } = await import('path')

    const targetDir = resolve(args.path)
    if (!existsSync(targetDir)) return { error: 'Directory not found' }

    const strategy = args.strategy || 'type'
    const typeFolders: Record<string, string> = {
      video: 'Videos', audio: 'Music', pdf: 'Documents',
      image: 'Images', doc: 'Documents',
    }

    const files = ctx.db.db.prepare(
      'SELECT * FROM files WHERE path LIKE ?'
    ).all(`${targetDir}%`) as any[]

    const moved: string[] = []
    const errors: string[] = []

    for (const file of files) {
      const fileDir = dirname(file.path)
      // Only organize files directly in the target dir
      if (resolve(fileDir) !== targetDir) continue

      let destFolder: string
      if (strategy === 'date') {
        const date = (file.modified_at || '').split('T')[0]
        destFolder = join(targetDir, date || 'unknown')
      } else {
        destFolder = join(targetDir, typeFolders[file.file_type] || 'Other')
      }

      try {
        if (!existsSync(destFolder)) mkdirSync(destFolder, { recursive: true })
        const newPath = join(destFolder, basename(file.path))
        if (newPath === file.path) continue
        renameSync(file.path, newPath)
        ctx.db.db.prepare('UPDATE files SET path = ? WHERE id = ?').run(newPath, file.id)
        moved.push(`${basename(file.path)} → ${basename(destFolder)}/`)
      } catch (e: any) {
        errors.push(`${basename(file.path)}: ${e.message}`)
      }
    }

    return {
      organized: moved.length,
      moved,
      errors: errors.length > 0 ? errors : undefined,
    }
  },

  async batch_rename(args: { path: string; pattern: string; replacement: string; dry_run?: boolean }) {
    const { existsSync, renameSync } = await import('fs')
    const { basename, dirname, resolve } = await import('path')

    const targetDir = resolve(args.path)
    if (!existsSync(targetDir)) return { error: 'Directory not found' }

    let regex: RegExp
    try {
      regex = new RegExp(args.pattern, 'g')
    } catch (e: any) {
      return { error: `Invalid pattern: ${e.message}` }
    }

    const files = ctx.db.db.prepare(
      'SELECT * FROM files WHERE path LIKE ?'
    ).all(`${targetDir}%`) as any[]

    const previews: Array<{ from: string; to: string }> = []
    const errors: string[] = []

    for (const file of files) {
      const oldName = basename(file.path)
      const newName = oldName.replace(regex, args.replacement)
      if (newName === oldName) continue

      const newPath = resolve(dirname(file.path), newName)
      previews.push({ from: oldName, to: newName })

      if (!args.dry_run) {
        try {
          renameSync(file.path, newPath)
          ctx.db.db.prepare('UPDATE files SET path = ?, name = ? WHERE id = ?').run(newPath, newName, file.id)
        } catch (e: any) {
          errors.push(`${oldName}: ${e.message}`)
        }
      }
    }

    return {
      matched: previews.length,
      previews,
      applied: !args.dry_run,
      errors: errors.length > 0 ? errors : undefined,
    }
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

  async airdrop_control(args: { action: 'status' | 'everyone' | 'contacts' | 'off' }) {
    const modeMap: Record<string, string> = {
      everyone: 'Everyone',
      contacts: 'Contacts Only',
      off: 'Off',
    }

    if (args.action === 'status') {
      try {
        const proc = Bun.spawnSync(['defaults', 'read', 'com.apple.sharingd', 'DiscoverableMode'])
        const mode = new TextDecoder().decode(proc.stdout).trim()
        return { mode: mode || 'Unknown', message: `AirDrop is currently set to: ${mode || 'Unknown'}` }
      } catch {
        return { mode: 'Unknown', message: 'Could not read AirDrop status.' }
      }
    }

    const mode = modeMap[args.action]
    if (!mode) return { error: 'Invalid action' }

    try {
      Bun.spawnSync(['defaults', 'write', 'com.apple.sharingd', 'DiscoverableMode', '-string', mode])
      Bun.spawnSync(['killall', '-HUP', 'sharingd'])
      const msg = args.action === 'off'
        ? 'AirDrop has been turned off.'
        : `AirDrop is now set to "${mode}". Files received via AirDrop will appear in ~/Downloads and be auto-indexed. Remember to turn it off when done.`
      return { mode, message: msg }
    } catch (err: any) {
      return { error: `Failed to set AirDrop: ${err.message}` }
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
    {
      type: 'function',
      function: {
        name: 'organize_files',
        description: 'Organize files in a directory by moving them into subfolders based on file type (Videos/, Music/, Documents/, Images/) or date.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to organize' },
            strategy: { type: 'string', enum: ['type', 'date'], description: 'Organization strategy (default: type)' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'batch_rename',
        description: 'Rename multiple files matching a regex pattern. Supports dry_run to preview changes before applying.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory containing files to rename' },
            pattern: { type: 'string', description: 'Regex pattern to match in filenames' },
            replacement: { type: 'string', description: 'Replacement string (supports $1, $2 capture groups)' },
            dry_run: { type: 'boolean', description: 'If true, show preview without renaming (default: false)' },
          },
          required: ['path', 'pattern', 'replacement'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'airdrop_control',
        description: 'Control AirDrop discoverability on this Mac. Can enable (everyone/contacts only), disable, or check current status. When enabling for everyone, remind the user to turn it off when done.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['status', 'everyone', 'contacts', 'off'],
              description: 'Get current status or set AirDrop mode',
            },
          },
          required: ['action'],
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
