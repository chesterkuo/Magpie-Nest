import { useState, useEffect } from 'react'

const TOKEN = () => localStorage.getItem('magpie-token') || 'magpie-dev'
const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' })

interface HealthData {
  status: string
  services: Record<string, any>
  disk?: any
  uptime?: number
  version?: string
}

interface SettingsData {
  watchDirs: string[]
  indexing: { queueLength: number; totalIndexed: number; lastIndexedAt: string | null }
  version: string
}

export function Settings() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [newDir, setNewDir] = useState('')
  const [readAloud, setReadAloud] = useState(() => localStorage.getItem('magpie-tts') === 'true')

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth)
    fetch('/api/settings', { headers: headers() }).then(r => r.json()).then(setSettings)
  }, [])

  async function addDir() {
    if (!newDir.trim() || !settings) return
    const dirs = [...settings.watchDirs, newDir.trim()]
    await fetch('/api/settings', { method: 'PUT', headers: headers(), body: JSON.stringify({ watchDirs: dirs }) })
    setSettings({ ...settings, watchDirs: dirs })
    setNewDir('')
  }

  async function removeDir(dir: string) {
    if (!settings) return
    const dirs = settings.watchDirs.filter(d => d !== dir)
    await fetch('/api/settings', { method: 'PUT', headers: headers(), body: JSON.stringify({ watchDirs: dirs }) })
    setSettings({ ...settings, watchDirs: dirs })
  }

  async function triggerIndex(path: string) {
    await fetch('/api/index/trigger', { method: 'POST', headers: headers(), body: JSON.stringify({ path }) })
  }

  function toggleTts() {
    const next = !readAloud
    setReadAloud(next)
    localStorage.setItem('magpie-tts', String(next))
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      {/* Status */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">System Status</h2>
        <div className="bg-gray-800 rounded-lg p-3 space-y-1 text-sm">
          <p>Status: <span className={health?.status === 'ok' ? 'text-green-400' : health?.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'}>{health?.status || '...'}</span></p>
          <p>Ollama: {health?.services?.ollama?.status || '...'} ({health?.services?.ollama?.model || ''})</p>
          <p>Files indexed: {settings?.indexing?.totalIndexed ?? '...'}</p>
          <p>Queue: {settings?.indexing?.queueLength ?? '...'} pending</p>
          <p>Uptime: {health?.uptime ? `${Math.floor(health.uptime / 60)}m` : '...'}</p>
        </div>
      </section>

      {/* Watch Directories */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Watch Directories</h2>
        <div className="space-y-2">
          {settings?.watchDirs.map(dir => (
            <div key={dir} className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
              <span className="flex-1 text-sm truncate">{dir}</span>
              <button onClick={() => triggerIndex(dir)} className="text-xs text-blue-400">Re-index</button>
              <button onClick={() => removeDir(dir)} className="text-xs text-red-400">Remove</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text" value={newDir} onChange={e => setNewDir(e.target.value)}
              placeholder="/path/to/watch"
              className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
            />
            <button onClick={addDir} className="px-3 py-2 bg-blue-600 rounded-lg text-sm">Add</button>
          </div>
        </div>
      </section>

      {/* Voice */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Voice</h2>
        <div className="bg-gray-800 rounded-lg p-3">
          <label className="flex items-center justify-between text-sm">
            <span>Read responses aloud</span>
            <input type="checkbox" checked={readAloud} onChange={toggleTts} className="rounded" />
          </label>
        </div>
      </section>

      {/* Auth */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Authentication</h2>
        <div className="bg-gray-800 rounded-lg p-3 text-sm">
          <p className="text-gray-400 mb-2">API Token</p>
          <code className="bg-gray-900 px-2 py-1 rounded text-xs">{TOKEN()}</code>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">About</h2>
        <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400">
          <p>Magpie v{settings?.version || '1.0.0'}</p>
          <p>Plusblocks Technology Ltd.</p>
        </div>
      </section>
    </div>
  )
}
