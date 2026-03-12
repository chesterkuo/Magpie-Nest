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
