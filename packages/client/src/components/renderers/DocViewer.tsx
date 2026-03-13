import { useState, useEffect } from 'react'
import type { FileItem } from '@magpie/shared'

export function DocViewer({ item }: { item: FileItem }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/file/${item.id}/preview?token=${token}`)
        if (!res.ok) throw new Error()
        setHtml(await res.text())
      } catch {
        setError(true)
      }
    }
    load()
  }, [item.id])

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="flex gap-2">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-400 hover:underline">
            {expanded ? 'Collapse' : 'Preview'}
          </button>
          <a
            href={`/api/file/${item.id}?token=${token}`}
            download={item.name}
            className="text-xs text-gray-400 hover:underline"
          >Download</a>
        </div>
      </div>
      {expanded && (
        error
          ? <p className="text-sm text-red-400">Preview unavailable</p>
          : html
            ? <iframe srcDoc={html} className="w-full h-96 rounded bg-white" sandbox="allow-same-origin" />
            : <p className="text-sm text-gray-400">Loading preview...</p>
      )}
    </div>
  )
}
