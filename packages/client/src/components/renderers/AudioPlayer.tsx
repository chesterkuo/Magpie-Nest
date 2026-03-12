import type { FileItem } from '@magpie/shared'

export function AudioPlayer({ item }: { item: FileItem }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
      <img src={item.thumbUrl} alt="" className="w-12 h-12 rounded object-cover bg-gray-700" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <audio controls src={item.streamUrl} className="w-full mt-1 h-8" />
      </div>
    </div>
  )
}
