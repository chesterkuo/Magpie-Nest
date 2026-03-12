import type { FileItem } from '@magpie/shared'

export function PDFViewer({ item }: { item: FileItem }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-sm font-medium truncate mb-2">{item.name}</p>
      <a
        href={`/api/file/${item.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-400 hover:underline"
      >
        Open PDF
      </a>
    </div>
  )
}
