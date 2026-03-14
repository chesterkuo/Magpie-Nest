export type RenderType =
  | 'video_card'
  | 'audio_player'
  | 'pdf_preview'
  | 'image_grid'
  | 'file_list'

export type FileType = 'video' | 'audio' | 'pdf' | 'image' | 'doc'

export function fileTypeToRenderType(type: FileType): RenderType {
  const map: Record<FileType, RenderType> = {
    video: 'video_card',
    audio: 'audio_player',
    pdf: 'pdf_preview',
    image: 'image_grid',
    doc: 'file_list',
  }
  return map[type] || 'file_list'
}

export interface FileItem {
  id: string
  name: string
  type: FileType
  size: number
  modified: string
  renderType: RenderType
  streamUrl: string
  thumbUrl: string
  // Optional metadata
  duration?: number       // seconds (video/audio)
  artist?: string         // audio ID3
  album?: string          // audio ID3
  width?: number          // image/video dimensions
  height?: number         // image/video dimensions
}

export interface AgentChunk {
  type: 'thinking' | 'text' | 'render' | 'error'
  content?: string
  tool?: string
  items?: FileItem[]
  message?: string
}

export interface PlaylistSummary {
  id: string
  name: string
  trackCount: number
  createdAt: string
  updatedAt: string
}

export interface Playlist extends PlaylistSummary {
  items: FileItem[]
}

export interface Message {
  role: 'user' | 'assistant'
  text: string
  items?: FileItem[]
  thinking?: string
}

export interface ConversationSummary {
  id: string
  preview: string
  messageCount: number
  updatedAt: string
}

export interface Conversation {
  id: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}
