import { Routes, Route, NavLink } from 'react-router'
import { Chat } from './routes/Chat'
import { Recent } from './routes/Recent'
import { Media } from './routes/Media'
import { Settings } from './routes/Settings'
import { PlaybackProvider } from './hooks/usePlayback'
import { PlaybackBar } from './components/PlaybackBar'
import { useOnlineStatus } from './hooks/useOnlineStatus'

export function App() {
  const online = useOnlineStatus()

  return (
    <PlaybackProvider>
      <div className="flex flex-col h-dvh">
        {!online && (
          <div className="bg-yellow-900/50 text-yellow-200 text-xs text-center py-1">
            You're offline — viewing cached data
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/recent" element={<Recent />} />
            <Route path="/media" element={<Media />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <PlaybackBar />

        <nav className="flex border-t border-gray-800 bg-gray-900">
          {[
            { to: '/', label: 'Chat' },
            { to: '/recent', label: 'Recent' },
            { to: '/media', label: 'Media' },
            { to: '/settings', label: 'Settings' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 py-3 text-center text-sm ${isActive ? 'text-white' : 'text-gray-500'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </PlaybackProvider>
  )
}
