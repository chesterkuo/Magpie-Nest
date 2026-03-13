import { useState, useEffect } from 'react'
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
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {(['videos', 'music', 'photos'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm rounded-md ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <input
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Filter..."
        className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
      />

      {tab === 'music' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Playlists</h2>
            <button onClick={createPlaylist} className="text-xs text-blue-400">+ New Playlist</button>
          </div>
          {playlists.map(p => (
            <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-gray-400">{p.trackCount} tracks</p>
              </div>
            </div>
          ))}
          <h2 className="text-sm font-semibold text-gray-300 pt-2">All Tracks</h2>
          {filtered.length > 0 && (
            <button
              onClick={() => playAll(filtered)}
              className="text-xs px-3 py-1 bg-blue-600 rounded"
            >Play All ({filtered.length})</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filtered.length > 0 ? (
        <RenderBlock items={filtered} />
      ) : (
        <p className="text-sm text-gray-500">No {tab} found</p>
      )}
    </div>
  )
}
