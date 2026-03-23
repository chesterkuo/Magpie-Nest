import { useState, useEffect, useCallback } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

const TOKEN = () => localStorage.getItem('magpie-token') || 'magpie-dev'
const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' })

interface HealthData {
  status: string
  services: Record<string, any>
  disk?: any
  uptime?: number
  version?: string
}

interface LLMConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  ollamaHost: string
}

interface EmbedConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  ollamaHost: string
  dimensions: number
}

interface SettingsData {
  watchDirs: string[]
  indexing: { queueLength: number; totalIndexed: number; lastIndexedAt: string | null }
  llm: LLMConfig
  embedding: EmbedConfig
  version: string
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`}
    />
  )
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

function ProviderCard({
  title,
  type,
  config,
  onChange,
  onSave,
}: {
  title: string
  type: 'llm' | 'embedding'
  config: LLMConfig | EmbedConfig
  onChange: (field: string, value: string) => void
  onSave: () => Promise<void>
}) {
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ status: string; message?: string } | null>(null)

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message })
    } finally {
      setTesting(false)
    }
  }

  const isOllama = config.provider === 'ollama'

  const inputClass =
    'w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg px-3 py-2.5 text-sm text-[#1D1D1F] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none'

  return (
    <section className="bg-white shadow-sm border border-[#E5E5EA] rounded-xl p-4 space-y-3">
      <h2 className="text-base font-semibold text-[#1D1D1F]">{title}</h2>

      {/* Provider */}
      <div className="space-y-1">
        <label className="text-sm text-[#6E6E73]">Provider</label>
        <select
          value={config.provider}
          onChange={(e) => onChange('provider', e.target.value)}
          className={inputClass}
        >
          <option value="ollama">Ollama</option>
          <option value="openai-compatible">OpenAI-Compatible</option>
        </select>
      </div>

      {/* API Key (only for openai-compatible) */}
      {!isOllama && (
        <div className="space-y-1">
          <label className="text-sm text-[#6E6E73]">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => onChange('apiKey', e.target.value)}
              placeholder="sk-..."
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg px-3 py-2.5 pr-10 text-sm text-[#1D1D1F] placeholder-[#86868B] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none"
            />
            <button
              type="button"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6E6E73] hover:text-[#1D1D1F]"
            >
              {showKey ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Base URL / Ollama Host */}
      <div className="space-y-1">
        <label className="text-sm text-[#6E6E73]">
          {isOllama ? 'Ollama Host' : 'Base URL'}
        </label>
        <input
          type="text"
          value={isOllama ? config.ollamaHost : config.baseUrl}
          onChange={(e) => onChange(isOllama ? 'ollamaHost' : 'baseUrl', e.target.value)}
          placeholder={isOllama ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
          className={inputClass}
        />
      </div>

      {/* Model */}
      <div className="space-y-1">
        <label className="text-sm text-[#6E6E73]">Model</label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder={type === 'llm' ? 'llama3.2' : 'nomic-embed-text'}
          className={inputClass}
        />
      </div>

      {/* Dimensions (embedding only) */}
      {type === 'embedding' && 'dimensions' in config && (
        <div className="space-y-1">
          <label className="text-sm text-[#6E6E73]">Dimensions</label>
          <input
            type="number"
            value={(config as EmbedConfig).dimensions}
            onChange={(e) => onChange('dimensions', e.target.value)}
            placeholder="768"
            className={inputClass}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSave}
          className="bg-[#007AFF] hover:bg-[#0056CC] px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
        >
          Save
        </button>
        <button
          onClick={testConnection}
          disabled={testing}
          className="bg-[#34C759] hover:bg-[#2DB84E] disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <span className={`text-sm ${testResult.status === 'ok' ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
            {testResult.status === 'ok' ? 'Connected' : testResult.message || 'Failed'}
          </span>
        )}
      </div>
    </section>
  )
}

export function Settings() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [newDir, setNewDir] = useState('')
  const [readAloud, setReadAloud] = useState(() => localStorage.getItem('magpie-tts') === 'true')
  const [llm, setLlm] = useState<LLMConfig>({ provider: 'openai-compatible', apiKey: '', baseUrl: '', model: '', ollamaHost: 'http://localhost:11434' })
  const [embed, setEmbed] = useState<EmbedConfig>({ provider: 'openai-compatible', apiKey: '', baseUrl: '', model: '', ollamaHost: 'http://localhost:11434', dimensions: 768 })

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth)
    fetch('/api/settings', { headers: headers() }).then(r => r.json()).then((data: SettingsData) => {
      setSettings(data)
      if (data.llm) setLlm(data.llm)
      if (data.embedding) setEmbed(data.embedding)
    })
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

  const saveLlm = useCallback(async () => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ llm }),
    })
    const data = await res.json()
    if (data.llm) setLlm(data.llm)
  }, [llm])

  const saveEmbed = useCallback(async () => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ embedding: embed }),
    })
    const data = await res.json()
    if (data.embedding) setEmbed(data.embedding)
  }, [embed])

  function updateLlm(field: string, value: string) {
    setLlm(prev => ({ ...prev, [field]: value }))
  }

  function updateEmbed(field: string, value: string) {
    setEmbed(prev => ({
      ...prev,
      [field]: field === 'dimensions' ? parseInt(value) || 0 : value,
    }))
  }

  const svc = health?.services || {}

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
      <h1 className="text-lg font-semibold text-[#1D1D1F]">Settings</h1>

      {/* System Status */}
      <section className="bg-white shadow-sm border border-[#E5E5EA] rounded-xl p-4 space-y-3">
        <h2 className="text-base font-semibold text-[#1D1D1F]">System Status</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <StatusDot ok={svc.llm?.status === 'ok'} />
            <span className="text-[#1D1D1F]">LLM</span>
            <span className="text-[#86868B] text-xs ml-auto truncate">{svc.llm?.model || ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={svc.embedding?.status === 'ok'} />
            <span className="text-[#1D1D1F]">Embedding</span>
            <span className="text-[#86868B] text-xs ml-auto truncate">{svc.embedding?.model || ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={svc.sqlite?.status === 'ok'} />
            <span className="text-[#1D1D1F]">SQLite</span>
            <span className="text-[#86868B] text-xs ml-auto">{svc.sqlite?.totalFiles ?? 0} files</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={svc.lancedb?.status === 'ok'} />
            <span className="text-[#1D1D1F]">LanceDB</span>
            <span className="text-[#86868B] text-xs ml-auto">{svc.lancedb?.totalChunks ?? 0} chunks</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={svc.whisper?.status === 'ok'} />
            <span className="text-[#1D1D1F]">Whisper</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={svc.kokoro?.status === 'ok'} />
            <span className="text-[#1D1D1F]">Kokoro TTS</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#86868B] pt-1 border-t border-[#E5E5EA]">
          <span>Status: <span className={health?.status === 'ok' ? 'text-[#34C759]' : health?.status === 'degraded' ? 'text-yellow-500' : 'text-[#FF3B30]'}>{health?.status || '...'}</span></span>
          <span>Uptime: {health?.uptime ? `${Math.floor(health.uptime / 60)}m` : '...'}</span>
          <span>Indexed: {settings?.indexing?.totalIndexed ?? '...'}</span>
          <span>Queue: {settings?.indexing?.queueLength ?? 0}</span>
        </div>
      </section>

      {/* Chat Model */}
      <ProviderCard
        title="Chat Model"
        type="llm"
        config={llm}
        onChange={updateLlm}
        onSave={saveLlm}
      />

      {/* Embedding Model */}
      <ProviderCard
        title="Embedding Model"
        type="embedding"
        config={embed}
        onChange={updateEmbed}
        onSave={saveEmbed}
      />

      {/* Watch Directories */}
      <section className="bg-white shadow-sm border border-[#E5E5EA] rounded-xl p-4 space-y-3">
        <h2 className="text-base font-semibold text-[#1D1D1F]">Watch Directories</h2>
        <div className="space-y-2">
          {settings?.watchDirs.map(dir => (
            <div key={dir} className="flex items-center gap-2 bg-[#F5F5F7] border border-[#E5E5EA] rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-[#1D1D1F] truncate">{dir}</span>
              <button onClick={() => triggerIndex(dir)} className="text-xs bg-[#F5F5F7] text-[#1D1D1F] border border-[#D2D2D7] hover:bg-[#E5E5EA] px-2 py-1 rounded transition-colors">Re-index</button>
              <button onClick={() => removeDir(dir)} className="text-xs text-[#FF3B30] hover:text-[#CC2F26] transition-colors">Remove</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newDir}
              onChange={e => setNewDir(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDir()}
              placeholder="/path/to/watch"
              className="flex-1 bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg px-3 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none"
            />
            <button onClick={addDir} className="px-3 py-2 bg-[#007AFF] hover:bg-[#0056CC] rounded-lg text-sm text-white transition-colors">Add</button>
          </div>
        </div>
      </section>

      {/* Voice */}
      <section className="bg-white shadow-sm border border-[#E5E5EA] rounded-xl p-4 space-y-3">
        <h2 className="text-base font-semibold text-[#1D1D1F]">Voice</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#6E6E73]">Read responses aloud</span>
          <ToggleSwitch enabled={readAloud} onToggle={toggleTts} />
        </div>
      </section>

      {/* About */}
      <section className="bg-white shadow-sm border border-[#E5E5EA] rounded-xl p-4 space-y-3">
        <h2 className="text-base font-semibold text-[#1D1D1F]">About</h2>
        <div className="text-sm text-[#6E6E73] space-y-1">
          <p>Magpie v{settings?.version || '1.0.0'}</p>
          <p>Plusblocks Technology Ltd.</p>
        </div>
      </section>
    </div>
  )
}
