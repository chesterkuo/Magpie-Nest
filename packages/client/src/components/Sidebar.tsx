import { NavLink } from 'react-router'
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  MusicalNoteIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'

const links = [
  { to: '/', icon: ChatBubbleLeftRightIcon, label: 'Chat' },
  { to: '/conversations', icon: ChatBubbleLeftIcon, label: 'History' },
  { to: '/recent', icon: ClockIcon, label: 'Recent' },
  { to: '/media', icon: MusicalNoteIcon, label: 'Media' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`hidden md:flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className={`flex items-center h-14 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <span className="text-lg font-semibold text-white">Magpie</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          {collapsed
            ? <ChevronRightIcon className="w-5 h-5" />
            : <ChevronLeftIcon className="w-5 h-5" />
          }
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 py-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
