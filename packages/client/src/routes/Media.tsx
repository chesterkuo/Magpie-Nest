import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, QueueListIcon } from '@heroicons/react/24/outline'
import type { FileItem, PlaylistSummary } from '@magpie/shared'
import { RenderBlock } from '../components/renderers/RenderBlock'
import { usePlayback } from '../hooks/usePlayback'

const TOKEN = () => localStorage.getItem('magpie-token') || 'magpie-dev'
const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' })

type Tab = 'videos' | 'music' | 'photos'

export function Media() {
  const [tab, setTab] = useState<Tab>('videos')
  const [files, setFiles] = useState<FileItem[]>([])
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { playAll } = usePlayback()

  const typeMap: Record<Tab, string> = { videos: 'video', music: 'audio', photos: 'image' }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/files?type=${typeMap[tab]}&sort=modified_at&order=desc&limit=200`, { headers: headers() })
      .then(r => r.json())
      .then(d => { setFiles(d.files); setLoading(false) })
    if (tab === 'music') {
      fetch('/api/playlists', { headers: headers() })
        .then(r => r.json())
        .then(d => setPlaylists(d.playlists))
    }
  }, [tab])

  const filtered = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files

  async function createPlaylist() {
    const name = prompt('Playlist name:')
    if (!name) return
    await fetch('/api/playlists', { method: 'POST', headers: headers(), body: JSON.stringify({ name }) })
    const res = await fetch('/api/playlists', { headers: headers() })
    setPlaylists((await res.json()).playlists)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1">
        {(['videos', 'music', 'photos'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-[#007AFF] text-white rounded-lg'
                : 'text-[#6E6E73] hover:bg-black/5 rounded-lg'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-white border border-[#D2D2D7] rounded-lg pl-9 pr-3 py-2 text-sm text-[#1D1D1F] placeholder-[#86868B] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none transition-colors"
        />
      </div>

      {/* Music: playlists section */}
      {tab === 'music' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1D1D1F]">Playlists</h2>
            <button onClick={createPlaylist} className="text-xs text-[#007AFF] hover:text-[#0056CC] transition-colors">
              + New Playlist
            </button>
          </div>
          {playlists.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
              <QueueListIcon className="w-5 h-5 text-[#6E6E73] shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#1D1D1F]">{p.name}</p>
                <p className="text-xs text-[#86868B]">{p.trackCount} tracks</p>
              </div>
            </div>
          ))}
          <h2 className="text-sm font-semibold text-[#1D1D1F] pt-2">All Tracks</h2>
          {filtered.length > 0 && (
            <button
              onClick={() => playAll(filtered)}
              className="text-xs px-3 py-1.5 bg-[#007AFF] hover:bg-[#0056CC] text-white rounded-lg transition-colors"
            >
              Play All ({filtered.length})
            </button>
          )}
        </div>
      )}

      {/* File grid / list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#E5E5EA] animate-pulse rounded-xl h-16" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <RenderBlock items={filtered} />
      ) : (
        <p className="text-sm text-[#6E6E73]">No {tab} found</p>
      )}
    </div>
  )
}
