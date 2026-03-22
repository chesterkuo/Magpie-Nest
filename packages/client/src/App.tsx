import { Routes, Route } from 'react-router'
import { Chat } from './routes/Chat'
import { Recent } from './routes/Recent'
import { Media } from './routes/Media'
import { Settings } from './routes/Settings'
import { ConversationList } from './routes/ConversationList'
import { PlaybackProvider } from './hooks/usePlayback'
import { PlaybackBar } from './components/PlaybackBar'
import { Sidebar } from './components/Sidebar'
import { BottomNav } from './components/BottomNav'
import { useOnlineStatus } from './hooks/useOnlineStatus'

export function App() {
  const online = useOnlineStatus()

  return (
    <PlaybackProvider>
      <div className="flex h-dvh">
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0">
          {!online && (
            <div className="bg-amber-900/50 text-amber-200 text-xs text-center py-1">
              You're offline — viewing cached data
            </div>
          )}

          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Chat />} />
              <Route path="/chat/:conversationId" element={<Chat />} />
              <Route path="/conversations" element={<ConversationList />} />
              <Route path="/recent" element={<Recent />} />
              <Route path="/media" element={<Media />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>

          <PlaybackBar />
          <BottomNav />
        </div>
      </div>
    </PlaybackProvider>
  )
}
