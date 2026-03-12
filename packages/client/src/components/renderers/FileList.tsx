import type { FileItem } from '@magpie/shared'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function FileList({ items }: { items: FileItem[] }) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-gray-400">
              {item.type} &middot; {formatSize(item.size)} &middot; {item.modified}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
