# i18n Localization — Design Spec

## Goal

Add multi-language support to Magpie using react-i18next with browser-based auto-detection and 10 languages.

## Languages

| Code | Language |
|------|----------|
| en | English (default/fallback) |
| zh-TW | Traditional Chinese |
| zh-CN | Simplified Chinese |
| fr | French |
| es | Spanish |
| ja | Japanese |
| ko | Korean |
| th | Thai |
| nl | Dutch |
| id | Indonesian |

## Architecture

- **Library:** `react-i18next` + `i18next` + `i18next-browser-languagedetector`
- **Detection:** `navigator.language` → match closest supported locale → fallback to `en`
- **Translation files:** JSON per language in `packages/client/src/locales/{lang}.json`
- **Namespace:** Single `translation` namespace (app is small)
- **Hook:** `useTranslation()` returns `t()` function
- **Init:** Configure in `packages/client/src/i18n.ts`, import in `main.tsx`

## Translation Key Structure

Flat dot-notation keys grouped by area:

```json
{
  "nav.chat": "Chat",
  "nav.history": "History",
  "nav.recent": "Recent",
  "nav.media": "Media",
  "nav.upload": "Upload",
  "nav.settings": "Settings",

  "chat.emptyState": "Ask Magpie to find your files",
  "chat.placeholder": "Ask Magpie anything...",
  "chat.send": "Send message",
  "chat.thinking": "Thinking...",
  "chat.usingTool": "Using {{tool}}...",

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

  "recent.title": "Recent Files",
  "recent.empty": "No recent files found",
  "recent.loadMore": "Load more",

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
  "settings.indexed": "Indexed",
  "settings.queue": "Queue",

  "common.offline": "You're offline — viewing cached data"
}
```

## Files to Create/Modify

**New files:**
- `packages/client/src/i18n.ts` — i18next config
- `packages/client/src/locales/en.json` — English (source of truth)
- `packages/client/src/locales/zh-TW.json`
- `packages/client/src/locales/zh-CN.json`
- `packages/client/src/locales/fr.json`
- `packages/client/src/locales/es.json`
- `packages/client/src/locales/ja.json`
- `packages/client/src/locales/ko.json`
- `packages/client/src/locales/th.json`
- `packages/client/src/locales/nl.json`
- `packages/client/src/locales/id.json`

**Modified files:**
- `packages/client/src/main.tsx` — import i18n.ts
- `packages/client/src/components/Sidebar.tsx`
- `packages/client/src/components/BottomNav.tsx`
- `packages/client/src/components/ChatInput.tsx`
- `packages/client/src/components/VoiceInput.tsx`
- `packages/client/src/components/ThinkingIndicator.tsx`
- `packages/client/src/components/MessageList.tsx`
- `packages/client/src/routes/Chat.tsx`
- `packages/client/src/routes/ConversationList.tsx`
- `packages/client/src/routes/Recent.tsx`
- `packages/client/src/routes/Media.tsx`
- `packages/client/src/routes/Upload.tsx`
- `packages/client/src/routes/Settings.tsx`
- `packages/client/src/App.tsx`
