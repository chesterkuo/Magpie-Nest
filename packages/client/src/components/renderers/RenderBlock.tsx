import type { FileItem } from '@magpie/shared'
import { VideoCard } from './VideoCard'
import { AudioPlayer } from './AudioPlayer'
import { PDFViewer } from './PDFViewer'
import { ImageGrid } from './ImageGrid'
import { FileList } from './FileList'
import { DocViewer } from './DocViewer'

export function RenderBlock({ items }: { items: FileItem[] }) {
  const images = items.filter((i) => i.renderType === 'image_grid')
  const others = items.filter((i) => i.renderType !== 'image_grid')

  return (
    <div className="space-y-2">
      {others.map((item) => {
        switch (item.renderType) {
          case 'video_card':
            return <VideoCard key={item.id} item={item} />
          case 'audio_player':
            return <AudioPlayer key={item.id} item={item} />
          case 'pdf_preview':
            return <PDFViewer key={item.id} item={item} />
          case 'file_list':
            if (item.name.endsWith('.docx') || item.name.endsWith('.xlsx')) {
              return <DocViewer key={item.id} item={item} />
            }
            return <FileList key={item.id} items={[item]} />
          default:
            return <FileList key={item.id} items={[item]} />
        }
      })}
      {images.length > 0 && <ImageGrid items={images} />}
    </div>
  )
}
