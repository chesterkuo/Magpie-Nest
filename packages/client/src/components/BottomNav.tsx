import { NavLink } from 'react-router'
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  MusicalNoteIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'

const links = [
  { to: '/', icon: ChatBubbleLeftRightIcon, label: 'Chat' },
  { to: '/conversations', icon: ChatBubbleLeftIcon, label: 'History' },
  { to: '/recent', icon: ClockIcon, label: 'Recent' },
  { to: '/media', icon: MusicalNoteIcon, label: 'Media' },
  { to: '/upload', icon: ArrowUpTrayIcon, label: 'Upload' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="flex md:hidden bg-white/90 backdrop-blur-xl border-t border-[#D2D2D7] pb-safe">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          aria-label={label}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
              isActive ? 'text-[#007AFF]' : 'text-[#86868B]'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
