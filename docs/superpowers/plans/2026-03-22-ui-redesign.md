# UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Magpie client UI from basic/functional to a professional Spotify/Discord-style interface with Heroicons, responsive sidebar/bottom-nav layout, and rich visual polish.

**Architecture:** Replace all emoji icons with Heroicons. Extract navigation into Sidebar (desktop >=768px) and BottomNav (mobile) components. Add reusable UI primitives (Spinner). Restyle every component with consistent design tokens (colors, spacing, transitions). No new libraries beyond `@heroicons/react`.

**Tech Stack:** React 19, Tailwind CSS 4, Heroicons, Vite

**Spec:** `docs/superpowers/specs/2026-03-22-multi-provider-llm-and-ui-redesign-design.md` (Section 2)

**Depends on:** Multi-Provider LLM plan should be completed first (Settings page needs LLM config UI).

---

### Task 1: Install Heroicons and create Spinner component

**Files:**
- Create: `packages/client/src/components/ui/Spinner.tsx`

- [ ] **Step 1: Install Heroicons**

Run: `cd packages/client && bun add @heroicons/react`

- [ ] **Step 2: Create Spinner component**

Create `packages/client/src/components/ui/Spinner.tsx`:
```tsx
export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-blue-500 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/ui/Spinner.tsx packages/client/package.json
git commit -m "feat: install Heroicons and add Spinner component"
```

---

### Task 2: Create Sidebar and BottomNav components

**Files:**
- Create: `packages/client/src/components/Sidebar.tsx`
- Create: `packages/client/src/components/BottomNav.tsx`
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Create Sidebar component**

Create `packages/client/src/components/Sidebar.tsx`:
```tsx
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
```

- [ ] **Step 2: Create BottomNav component**

Create `packages/client/src/components/BottomNav.tsx`:
```tsx
import { NavLink } from 'react-router'
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  MusicalNoteIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline'

const links = [
  { to: '/', icon: ChatBubbleLeftRightIcon, label: 'Chat' },
  { to: '/conversations', icon: ChatBubbleLeftIcon, label: 'History' },
  { to: '/recent', icon: ClockIcon, label: 'Recent' },
  { to: '/media', icon: MusicalNoteIcon, label: 'Media' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="flex md:hidden border-t border-gray-800 bg-gray-900">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              isActive ? 'text-white' : 'text-gray-500'
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
```

- [ ] **Step 3: Update App.tsx with responsive layout**

Rewrite `packages/client/src/App.tsx`:
```tsx
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
```

- [ ] **Step 4: Verify in browser**

Open http://localhost:5173 and verify:
- Desktop (>=768px): sidebar visible, bottom nav hidden
- Mobile (<768px): sidebar hidden, bottom nav visible

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/Sidebar.tsx packages/client/src/components/BottomNav.tsx packages/client/src/App.tsx
git commit -m "feat: responsive sidebar (desktop) and bottom nav (mobile)"
```

---

### Task 3: Redesign ChatInput and VoiceInput

**Files:**
- Modify: `packages/client/src/components/ChatInput.tsx`
- Modify: `packages/client/src/components/VoiceInput.tsx`

- [ ] **Step 1: Rewrite ChatInput with textarea and Heroicons**

Replace emoji send button with `PaperAirplaneIcon`. Replace `<input>` with auto-growing `<textarea>`. Add subtle border styling. Use `onKeyDown` for Shift+Enter (newline) vs Enter (send).

Key changes:
- `<textarea>` with `rows={1}` and auto-resize via `onInput` adjusting `scrollHeight`
- `PaperAirplaneIcon` for send button
- Container: `border border-gray-700 rounded-xl bg-gray-800/50 focus-within:border-blue-500 transition-colors`
- Voice and send buttons inside the container, right-aligned

- [ ] **Step 2: Rewrite VoiceInput with Heroicons**

Replace emoji 🎤 with `MicrophoneIcon`. Recording state: `ring-2 ring-rose-500 animate-pulse bg-rose-600`. Processing state: `opacity-50`. Idle: `text-gray-400 hover:text-white`.

- [ ] **Step 3: Verify in browser**

Test chat input renders correctly, auto-grows, sends on Enter, newline on Shift+Enter, voice button works.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/ChatInput.tsx packages/client/src/components/VoiceInput.tsx
git commit -m "feat: redesign ChatInput with textarea and Heroicons"
```

---

### Task 4: Redesign MessageList and ThinkingIndicator

**Files:**
- Modify: `packages/client/src/components/MessageList.tsx`
- Modify: `packages/client/src/components/ThinkingIndicator.tsx`

- [ ] **Step 1: Rewrite MessageList**

- User messages: `self-end max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2`
- Assistant messages: `self-start max-w-[85%]` with `UserCircleIcon` avatar for user, a simple colored circle with "M" for Magpie
- Add `animate-in` fade for new messages (use CSS animation: `@keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`)

- [ ] **Step 2: Rewrite ThinkingIndicator**

Replace `animate-pulse` text with Spinner + tool name:
```tsx
import { Spinner } from './ui/Spinner'

export function ThinkingIndicator({ tool }: { tool: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
      <Spinner className="w-4 h-4" />
      <span>Using {tool}...</span>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Send a message, check bubbles render correctly, thinking indicator shows spinner.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/MessageList.tsx packages/client/src/components/ThinkingIndicator.tsx
git commit -m "feat: redesign MessageList with avatars and ThinkingIndicator with spinner"
```

---

### Task 5: Redesign PlaybackBar

**Files:**
- Modify: `packages/client/src/components/PlaybackBar.tsx`

- [ ] **Step 1: Rewrite PlaybackBar with Heroicons**

Replace all emoji controls with Heroicons:
- `ArrowsRightLeftIcon` (shuffle)
- `BackwardIcon` (previous)
- `PlayIcon` / `PauseIcon` (play/pause)
- `ForwardIcon` (next)
- `ArrowPathIcon` (repeat)
- `SpeakerWaveIcon` + volume range (desktop only: `hidden md:flex`)

Layout:
```
[AlbumArt] [TrackInfo] [Controls] [ProgressBar] [Time] [Volume(desktop)]
```

Progress bar: styled `<input type="range">` with `accent-blue-500`.
Album art: `w-10 h-10 rounded-md shadow-lg object-cover`.
Controls: `flex items-center gap-1` with icon buttons `p-1.5 rounded-full hover:bg-gray-700 transition-colors`.
Active shuffle/repeat: `text-blue-500` instead of default `text-gray-400`.

- [ ] **Step 2: Verify playback controls work**

Play an audio file, test all controls (play/pause, next/prev, shuffle, repeat, seek, volume).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/PlaybackBar.tsx
git commit -m "feat: redesign PlaybackBar with Heroicons and volume control"
```

---

### Task 6: Redesign renderer components

**Files:**
- Modify: `packages/client/src/components/renderers/VideoCard.tsx`
- Modify: `packages/client/src/components/renderers/AudioPlayer.tsx`
- Modify: `packages/client/src/components/renderers/ImageGrid.tsx`
- Modify: `packages/client/src/components/renderers/PDFViewer.tsx`
- Modify: `packages/client/src/components/renderers/DocViewer.tsx`
- Modify: `packages/client/src/components/renderers/FileList.tsx`
- Modify: `packages/client/src/components/ImageLightbox.tsx`

- [ ] **Step 1: Redesign VideoCard**

- Larger thumbnail: `aspect-video w-full rounded-lg overflow-hidden relative group`
- Hover overlay: `absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center`
- Play icon: `PlayIcon` from Heroicons (w-12 h-12 text-white)
- Duration badge: `absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded`
- Title: `text-sm font-medium mt-2 truncate`

- [ ] **Step 2: Redesign AudioPlayer**

- Card: `flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700/50 transition-colors`
- Active track: `border-l-2 border-violet-500`
- Album art: `w-12 h-12 rounded bg-gray-700 object-cover`
- Play button: `PlayIcon` or `PauseIcon` in a `bg-blue-600 rounded-full p-2` button
- Queue button: `PlusIcon` with `text-gray-400 hover:text-white`

- [ ] **Step 3: Redesign ImageGrid**

- `grid grid-cols-3 gap-1.5 rounded-lg overflow-hidden`
- Images: `aspect-square object-cover cursor-pointer hover:opacity-80 transition-opacity`

- [ ] **Step 4: Redesign ImageLightbox**

Replace emoji arrows/close with Heroicons:
- `XMarkIcon` for close
- `ChevronLeftIcon` / `ChevronRightIcon` for navigation
- Better backdrop: `bg-black/95`

- [ ] **Step 5: Redesign PDFViewer**

Replace emoji buttons with Heroicons:
- `ChevronLeftIcon` / `ChevronRightIcon` for page nav
- `ArrowsPointingOutIcon` / `ArrowsPointingInIcon` for fullscreen toggle

- [ ] **Step 6: Redesign DocViewer and FileList**

DocViewer: Better card styling with `bg-gray-800 rounded-xl p-4`.
FileList: Add `DocumentIcon` from Heroicons for each file, hover state `hover:bg-gray-700/50 transition-colors`.

- [ ] **Step 7: Verify all renderers in browser**

Test with various file types — videos, audio, images, PDFs, documents.

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/components/renderers/ packages/client/src/components/ImageLightbox.tsx
git commit -m "feat: redesign all renderer components with Heroicons and polished styling"
```

---

### Task 7: Redesign route pages

**Files:**
- Modify: `packages/client/src/routes/Chat.tsx`
- Modify: `packages/client/src/routes/ConversationList.tsx`
- Modify: `packages/client/src/routes/Recent.tsx`
- Modify: `packages/client/src/routes/Media.tsx`

- [ ] **Step 1: Update Chat.tsx**

Minimal changes — ensure it works with the new sidebar layout. Add padding adjustments for desktop: `md:p-6 p-4`.

- [ ] **Step 2: Redesign ConversationList**

- Header: `text-lg font-semibold` + "New Chat" button with `PlusIcon`
- Cards: `bg-gray-800 rounded-xl p-4 hover:bg-gray-700/50 transition-colors cursor-pointer`
- Preview text: `text-sm text-gray-400 truncate`
- Date: `text-xs text-gray-500`
- Message count badge: `text-xs text-gray-500`

- [ ] **Step 3: Redesign Recent page**

- Section headers (Today, Yesterday, etc.): `text-xs font-medium text-gray-500 uppercase tracking-wider`
- Skeleton loading: `bg-gray-800 animate-pulse rounded-lg h-16` placeholder cards
- Better spacing between date groups

- [ ] **Step 4: Redesign Media page**

- Tab buttons: `px-4 py-2 rounded-lg text-sm font-medium transition-colors` with active `bg-gray-800 text-white` / inactive `text-gray-400 hover:text-white`
- Search input: `bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors` with `MagnifyingGlassIcon` prefix
- Playlist cards with `QueueListIcon`

- [ ] **Step 5: Verify all pages in browser**

Navigate through all pages, check styling on desktop and mobile.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/routes/
git commit -m "feat: redesign Chat, ConversationList, Recent, and Media pages"
```

---

### Task 8: Redesign Settings page with LLM config

**Files:**
- Modify: `packages/client/src/routes/Settings.tsx`

- [ ] **Step 1: Redesign Settings with grouped cards and LLM config**

The Settings page needs:
1. **System Status** card — colored status dots, provider info
2. **Chat Model** card — provider dropdown, API key (password + eye toggle), base URL, model, test button
3. **Embedding Model** card — same fields as chat model
4. **Watch Directories** card — existing functionality, better styling
5. **Voice** card — toggle switch for TTS
6. **About** card — version, company

Key new components inline:
- Provider selector: `<select className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white">`
- API key input: `<input type={showKey ? 'text' : 'password'}>` with `EyeIcon`/`EyeSlashIcon` toggle
- Test button: `bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-sm` — calls `POST /api/settings/test-connection`, shows result inline
- Toggle switch: custom `<button>` with `w-10 h-6 rounded-full` background toggling `bg-gray-600` / `bg-blue-500`, and a sliding `translate-x` circle

Each section: `bg-gray-800 rounded-xl p-4 space-y-3`.
Section title: `text-base font-medium text-white`.
Labels: `text-sm text-gray-400`.

- [ ] **Step 2: Verify settings page**

- Open settings, verify all sections render
- Test provider switching
- Test API key masking
- Test connection button

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/routes/Settings.tsx
git commit -m "feat: redesign Settings page with LLM config and polished UI"
```

---

### Task 9: Add fadeIn animation CSS

**Files:**
- Modify: `packages/client/src/index.css`

- [ ] **Step 1: Add custom animation**

Add to `packages/client/src/index.css`:
```css
@import "tailwindcss";

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fadeIn 0.2s ease-out;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/index.css
git commit -m "feat: add fadeIn animation for chat messages"
```

---

### Task 10: Final verification and cleanup

- [ ] **Step 1: Remove dark mode toggle effect from old App.tsx**

The old `useEffect` with `matchMedia('prefers-color-scheme: dark')` is no longer needed since the HTML has `class="dark"` hardcoded. Remove if still present.

- [ ] **Step 2: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All tests pass

- [ ] **Step 3: Run Playwright e2e tests**

Run: `bunx playwright test`
Expected: Tests pass (DOM structure should be compatible)

- [ ] **Step 4: Visual review**

Open http://localhost:5173 on desktop and resize to mobile. Check:
- Sidebar shows on desktop, collapses, bottom nav on mobile
- All emoji replaced with Heroicons
- Chat bubbles, playback bar, video cards, audio players look polished
- Settings page has LLM config sections
- Transitions are smooth

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: UI redesign complete — Heroicons, responsive layout, polished styling"
```
