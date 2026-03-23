import { DocumentIcon } from '@heroicons/react/24/outline'
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
        <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg border border-[#E5E5EA] hover:bg-[#F5F5F7] transition-colors p-3">
          <DocumentIcon className="w-5 h-5 text-[#007AFF] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-[#1D1D1F]">{item.name}</p>
            <p className="text-xs text-[#86868B]">
              {item.type} &middot; {formatSize(item.size)} &middot; {item.modified}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
