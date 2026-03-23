# i18n Localization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-language support (10 languages) with react-i18next and auto-detection from browser settings.

**Architecture:** Install react-i18next + i18next-browser-languagedetector. Create i18n config file and JSON translation files per language. Replace all hardcoded strings in components with `t('key')` calls. Auto-detect language from `navigator.language`.

**Tech Stack:** react-i18next, i18next, i18next-browser-languagedetector

**Spec:** `docs/superpowers/specs/2026-03-23-i18n-localization-design.md`

---

### Task 1: Install i18next and create config + English translations

**Files:**
- Create: `packages/client/src/i18n.ts`
- Create: `packages/client/src/locales/en.json`
- Modify: `packages/client/src/main.tsx`

- [ ] **Step 1: Install packages**

Run: `cd packages/client && bun add react-i18next i18next i18next-browser-languagedetector`

- [ ] **Step 2: Create English translation file**

Create `packages/client/src/locales/en.json` with ALL translatable strings:
```json
{
  "nav.chat": "Chat",
  "nav.history": "History",
  "nav.recent": "Recent",
  "nav.media": "Media",
  "nav.upload": "Upload",
  "nav.settings": "Settings",
  "nav.collapseSidebar": "Collapse sidebar",
  "nav.expandSidebar": "Expand sidebar",

  "chat.emptyState": "Ask Magpie to find your files",
  "chat.placeholder": "Ask Magpie anything...",
  "chat.send": "Send message",
  "chat.thinking": "Thinking...",
  "chat.usingTool": "Using {{tool}}...",
  "chat.voiceRecord": "Record voice message",
  "chat.voiceStop": "Stop recording",
  "chat.voiceProcessing": "Processing...",

  "conversations.title": "Conversations",
  "conversations.newChat": "New Chat",
  "conversations.empty": "No conversations yet",
  "conversations.select": "Select",
  "conversations.done": "Done",
  "conversations.delete": "Delete",
  "conversations.deleteConfirm": "Delete {{count}} conversation(s)?",
  "conversations.deleteWarning": "This cannot be undone.",
  "conversations.cancel": "Cancel",
  "conversations.selected": "{{count}} selected",
  "conversations.messages": "{{count}} messages",
  "conversations.today": "Today",
  "conversations.yesterday": "Yesterday",
  "conversations.last7Days": "Last 7 Days",
  "conversations.last30Days": "Last 30 Days",
  "conversations.older": "Older",
  "conversations.emptyConversation": "Empty conversation",

  "recent.title": "Recent Files",
  "recent.empty": "No recent files found",
  "recent.loadMore": "Load more",
  "recent.loading": "Loading...",

  "media.videos": "Videos",
  "media.music": "Music",
  "media.photos": "Photos",
  "media.search": "Search...",
  "media.playlists": "Playlists",
  "media.newPlaylist": "+ New Playlist",
  "media.noVideos": "No videos found",
  "media.noMusic": "No music found",
  "media.noPhotos": "No photos found",

  "upload.title": "Upload Files",
  "upload.dropzone": "Drop files here or click to browse",
  "upload.hint": "Any file type, no size limit",

  "settings.title": "Settings",
  "settings.systemStatus": "System Status",
  "settings.chatModel": "Chat Model",
  "settings.embeddingModel": "Embedding Model",
  "settings.watchDirs": "Watch Directories",
  "settings.voice": "Voice",
  "settings.about": "About",
  "settings.provider": "Provider",
  "settings.apiKey": "API Key",
  "settings.baseUrl": "Base URL",
  "settings.model": "Model",
  "settings.dimensions": "Dimensions",
  "settings.ollamaHost": "Ollama Host",
  "settings.save": "Save",
  "settings.testConnection": "Test Connection",
  "settings.add": "Add",
  "settings.remove": "Remove",
  "settings.reindex": "Re-index",
  "settings.readAloud": "Read responses aloud",
  "settings.indexed": "Indexed: {{count}}",
  "settings.queue": "Queue: {{count}}",
  "settings.language": "Language",

  "common.offline": "You're offline — viewing cached data",
  "common.close": "Close",
  "common.previous": "Previous",
  "common.next": "Next"
}
```

- [ ] **Step 3: Create i18n config**

Create `packages/client/src/i18n.ts`:
```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import th from './locales/th.json'
import nl from './locales/nl.json'
import id from './locales/id.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-TW': { translation: zhTW },
      'zh-CN': { translation: zhCN },
      fr: { translation: fr },
      es: { translation: es },
      ja: { translation: ja },
      ko: { translation: ko },
      th: { translation: th },
      nl: { translation: nl },
      id: { translation: id },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'magpie-lang',
    },
  })

export default i18n
```

Note: This file imports all locale files. They will be created in Task 2. For now, create stub files so the build doesn't break — or create them all in Task 2 before this import runs.

- [ ] **Step 4: Import i18n in main.tsx**

Add `import './i18n'` after the CSS import in `packages/client/src/main.tsx`:
```typescript
import './index.css'
import './i18n'
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/i18n.ts packages/client/src/locales/en.json packages/client/src/main.tsx packages/client/package.json bun.lock
git commit -m "feat: install react-i18next and create i18n config with English translations"
```

---

### Task 2: Create all 9 non-English translation files

**Files:**
- Create: `packages/client/src/locales/zh-TW.json`
- Create: `packages/client/src/locales/zh-CN.json`
- Create: `packages/client/src/locales/fr.json`
- Create: `packages/client/src/locales/es.json`
- Create: `packages/client/src/locales/ja.json`
- Create: `packages/client/src/locales/ko.json`
- Create: `packages/client/src/locales/th.json`
- Create: `packages/client/src/locales/nl.json`
- Create: `packages/client/src/locales/id.json`

- [ ] **Step 1: Create all 9 translation files**

Each file has the same keys as `en.json` but with translated values. Use the same JSON structure. Translate all values accurately for each language. Keep `{{interpolation}}` placeholders unchanged.

IMPORTANT: Every file must have EXACTLY the same keys as en.json. Do not add or remove keys.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/locales/
git commit -m "feat: add translations for zh-TW, zh-CN, fr, es, ja, ko, th, nl, id"
```

---

### Task 3: Replace hardcoded strings in navigation components

**Files:**
- Modify: `packages/client/src/components/Sidebar.tsx`
- Modify: `packages/client/src/components/BottomNav.tsx`
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Update Sidebar.tsx**

Add `import { useTranslation } from 'react-i18next'` at the top.

The `links` array currently has hardcoded labels. Since hooks can't be used at module level, move the links array inside the component or use translation keys:

```typescript
export function Sidebar() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  const links = [
    { to: '/', icon: ChatBubbleLeftRightIcon, label: t('nav.chat') },
    { to: '/conversations', icon: ChatBubbleLeftIcon, label: t('nav.history') },
    { to: '/recent', icon: ClockIcon, label: t('nav.recent') },
    { to: '/media', icon: MusicalNoteIcon, label: t('nav.media') },
    { to: '/upload', icon: ArrowUpTrayIcon, label: t('nav.upload') },
    { to: '/settings', icon: Cog6ToothIcon, label: t('nav.settings') },
  ]
```

Update collapse button aria-label: `aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}`

- [ ] **Step 2: Update BottomNav.tsx**

Same pattern — move links inside component, use `t()`:
```typescript
export function BottomNav() {
  const { t } = useTranslation()

  const links = [
    { to: '/', icon: ChatBubbleLeftRightIcon, label: t('nav.chat') },
    ...
  ]
```

- [ ] **Step 3: Update App.tsx**

Add `useTranslation` import and replace offline banner text:
```typescript
const { t } = useTranslation()
...
{t('common.offline')}
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/Sidebar.tsx packages/client/src/components/BottomNav.tsx packages/client/src/App.tsx
git commit -m "feat: i18n for navigation components"
```

---

### Task 4: Replace strings in chat components

**Files:**
- Modify: `packages/client/src/components/ChatInput.tsx`
- Modify: `packages/client/src/components/VoiceInput.tsx`
- Modify: `packages/client/src/components/ThinkingIndicator.tsx`
- Modify: `packages/client/src/routes/Chat.tsx`

- [ ] **Step 1: Update ChatInput.tsx**

- `useTranslation` import
- Placeholder: `placeholder={t('chat.placeholder')}`
- Send button aria-label: `aria-label={t('chat.send')}`

- [ ] **Step 2: Update VoiceInput.tsx**

- aria-label: `aria-label={recording ? t('chat.voiceStop') : processing ? t('chat.voiceProcessing') : t('chat.voiceRecord')}`

- [ ] **Step 3: Update ThinkingIndicator.tsx**

- `{tool === 'thinking' ? t('chat.thinking') : t('chat.usingTool', { tool })}`

- [ ] **Step 4: Update Chat.tsx**

- Empty state: `{t('chat.emptyState')}`

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/ChatInput.tsx packages/client/src/components/VoiceInput.tsx packages/client/src/components/ThinkingIndicator.tsx packages/client/src/routes/Chat.tsx
git commit -m "feat: i18n for chat components"
```

---

### Task 5: Replace strings in ConversationList

**Files:**
- Modify: `packages/client/src/routes/ConversationList.tsx`

- [ ] **Step 1: Update ConversationList.tsx**

Add `useTranslation` import. Replace ALL hardcoded strings:
- Title: `{t('conversations.title')}`
- Select/Done: `{selectionMode ? t('conversations.done') : t('conversations.select')}`
- New Chat: `{t('conversations.newChat')}`
- Empty: `{t('conversations.empty')}`
- Delete: `{t('conversations.delete')}`
- Delete confirm: `{t('conversations.deleteConfirm', { count: selected.size })}`
- Warning: `{t('conversations.deleteWarning')}`
- Cancel: `{t('conversations.cancel')}`
- Selected count: `{t('conversations.selected', { count: selected.size })}`
- Messages count: `{t('conversations.messages', { count: c.messageCount })}`
- Date groups: `{t('conversations.today')}`, `{t('conversations.yesterday')}`, etc.
- Empty conversation: `{t('conversations.emptyConversation')}`

For date groups, the `GROUP_ORDER` array and `getDateGroup` function use strings as keys. Map them to translation keys:
```typescript
const groupLabels: Record<DateGroup, string> = {
  'Today': 'conversations.today',
  'Yesterday': 'conversations.yesterday',
  'Last 7 Days': 'conversations.last7Days',
  'Last 30 Days': 'conversations.last30Days',
  'Older': 'conversations.older',
}
```
Then use `{t(groupLabels[group.label])}` in the JSX.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/routes/ConversationList.tsx
git commit -m "feat: i18n for ConversationList"
```

---

### Task 6: Replace strings in remaining route pages

**Files:**
- Modify: `packages/client/src/routes/Recent.tsx`
- Modify: `packages/client/src/routes/Media.tsx`
- Modify: `packages/client/src/routes/Upload.tsx`

- [ ] **Step 1: Update Recent.tsx**

- Title: `{t('recent.title')}`
- Empty: `{t('recent.empty')}`
- Load more: `{t('recent.loadMore')}`
- Loading: `{t('recent.loading')}`
- Date section headers (Today/Yesterday): use same pattern as ConversationList

- [ ] **Step 2: Update Media.tsx**

- Tabs: `{t('media.videos')}`, `{t('media.music')}`, `{t('media.photos')}`
- Search placeholder: `{t('media.search')}`
- Playlists: `{t('media.playlists')}`
- New Playlist: `{t('media.newPlaylist')}`
- Empty states: `{t('media.noVideos')}`, etc.

- [ ] **Step 3: Update Upload.tsx**

- Title: `{t('upload.title')}`
- Drop zone text: `{t('upload.dropzone')}`
- Hint: `{t('upload.hint')}`

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/routes/Recent.tsx packages/client/src/routes/Media.tsx packages/client/src/routes/Upload.tsx
git commit -m "feat: i18n for Recent, Media, and Upload pages"
```

---

### Task 7: Replace strings in Settings page + add language selector

**Files:**
- Modify: `packages/client/src/routes/Settings.tsx`

- [ ] **Step 1: Update Settings.tsx with i18n**

Add `useTranslation` import. Replace all section titles, labels, button text with `t()` calls.

Also add a **Language selector** section (after Voice, before About):
```tsx
{/* Language */}
<div className="bg-white shadow-sm border border-[#E5E5EA] rounded-xl p-4 space-y-3">
  <h2 className="text-base font-semibold text-[#1D1D1F]">{t('settings.language')}</h2>
  <select
    value={i18n.language}
    onChange={(e) => i18n.changeLanguage(e.target.value)}
    className={inputClass}
  >
    <option value="en">English</option>
    <option value="zh-TW">繁體中文</option>
    <option value="zh-CN">简体中文</option>
    <option value="fr">Français</option>
    <option value="es">Español</option>
    <option value="ja">日本語</option>
    <option value="ko">한국어</option>
    <option value="th">ไทย</option>
    <option value="nl">Nederlands</option>
    <option value="id">Bahasa Indonesia</option>
  </select>
</div>
```

Use `const { t, i18n } = useTranslation()` to access both `t` and `i18n`.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/routes/Settings.tsx
git commit -m "feat: i18n for Settings page with language selector"
```

---

### Task 8: Update e2e tests and verify

**Files:**
- Possibly modify: `e2e/*.spec.ts`

- [ ] **Step 1: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All pass (no server changes in this feature)

- [ ] **Step 2: Run all e2e tests**

Run: `bunx playwright test`

E2e tests use text-based selectors like `hasText: 'Chat'`, `hasText: 'New Chat'`, etc. Since the default language is English and Playwright uses a fresh browser (no localStorage), detection should fall back to English. Tests should pass without changes.

If any fail due to language detection, add locale override in playwright config or in test setup.

- [ ] **Step 3: Fix any failures and commit**

```bash
git add e2e/
git commit -m "test: update e2e tests for i18n"
```
