import { Routes, Route, NavLink } from 'react-router'
import { Chat } from './routes/Chat'
function Recent() {
  return <div className="p-4">Recent files</div>
}
function Media() {
  return <div className="p-4">Media library</div>
}
function Settings() {
  return <div className="p-4">Settings</div>
}

export function App() {
  return (
    <div className="flex flex-col h-dvh">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/recent" element={<Recent />} />
          <Route path="/media" element={<Media />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

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
  )
}
