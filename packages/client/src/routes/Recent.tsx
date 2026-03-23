import { useState, useEffect, useCallback } from 'react'
import type { FileItem } from '@magpie/shared'
import { RenderBlock } from '../components/renderers/RenderBlock'

const TOKEN = () => localStorage.getItem('magpie-token') || 'magpie-dev'

function groupByDate(files: FileItem[]) {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  const groups: Record<string, FileItem[]> = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] }
  for (const f of files) {
    const d = new Date(f.modified)
    if (d.toDateString() === today) groups.Today.push(f)
    else if (d.toDateString() === yesterday) groups.Yesterday.push(f)
    else if (d > weekAgo) groups['This Week'].push(f)
    else groups.Earlier.push(f)
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[#E5E5EA] animate-pulse rounded-xl h-16" />
      ))}
    </div>
  )
}

export function Recent() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const loadFiles = useCallback(async (off: number) => {
    setLoading(true)
    const res = await fetch(`/api/files?sort=modified_at&order=desc&days=30&limit=${limit}&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOKEN()}` },
    })
    const data = await res.json()
    setFiles(prev => off === 0 ? data.files : [...prev, ...data.files])
    setTotal(data.total)
    setLoading(false)
  }, [])

  useEffect(() => { loadFiles(0) }, [])

  const groups = groupByDate(files)

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg text-[#1D1D1F] font-semibold">Recent Files</h1>

      {loading && files.length === 0 ? (
        <SkeletonCards />
      ) : (
        <>
          {groups.map(([label, items]) => (
            <div key={label} className="space-y-3">
              <h2 className="text-xs font-medium text-[#6E6E73] uppercase tracking-wider">{label}</h2>
              <RenderBlock items={items} />
            </div>
          ))}
          {!loading && files.length === 0 && (
            <p className="text-[#6E6E73] text-sm">No recent files found</p>
          )}
          {files.length < total && (
            <button
              onClick={() => { const next = offset + limit; setOffset(next); loadFiles(next) }}
              disabled={loading}
              className="w-full py-2 text-sm text-[#007AFF] hover:text-[#0056CC] disabled:text-[#86868B] transition-colors"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
