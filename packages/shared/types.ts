export type RenderType =
  | 'video_card'
  | 'audio_player'
  | 'pdf_preview'
  | 'image_grid'
  | 'file_list'

export type FileType = 'video' | 'audio' | 'pdf' | 'image' | 'doc'

export interface FileItem {
  id: string
  name: string
  type: FileType
  size: number
  modified: string
  renderType: RenderType
  streamUrl: string
  thumbUrl: string
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
