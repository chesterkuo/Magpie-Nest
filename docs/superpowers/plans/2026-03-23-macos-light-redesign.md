# macOS Light Theme Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Magpie client from dark theme to macOS-native light style with Apple system fonts, fix all critical/high UX issues (safe areas, touch targets, aria-labels, contrast, reduced-motion, loading states).

**Architecture:** Replace all dark Tailwind classes with a macOS-inspired light palette (off-white #F5F5F7 bg, white cards, system blue #007AFF accent). Use Apple system font stack. Fix accessibility and mobile UX issues across all components. No new libraries needed — pure Tailwind class changes.

**Tech Stack:** React 19, Tailwind CSS 4, Heroicons, Vite

**Design Tokens:**
```
Page BG:        bg-[#F5F5F7]          (#F5F5F7 Apple off-white)
Card BG:        bg-white               (#FFFFFF)
Sidebar BG:     bg-white/80 backdrop-blur-xl  (frosted glass)
Text Primary:   text-[#1D1D1F]        (Apple black)
Text Secondary: text-[#6E6E73]        (Apple gray — 4.6:1 contrast on white)
Text Tertiary:  text-[#86868B]        (lighter gray — 3.5:1, large text only)
Accent:         text-[#007AFF] bg-[#007AFF]  (macOS system blue)
Danger:         text-red-500           (#EF4444)
Success:        text-emerald-500       (#10B981)
Border:         border-[#D2D2D7]      (Apple separator)
Card Radius:    rounded-xl             (12px, macOS window radius)
Card Shadow:    shadow-sm              (0 1px 2px rgba(0,0,0,0.05))
Font:           font-sans (configured to Apple system font stack)
```

---

### Task 1: Set up theme foundation — HTML, CSS, Tailwind config, font

**Files:**
- Modify: `packages/client/index.html`
- Modify: `packages/client/src/index.css`
- Modify: `packages/client/tailwind.config.ts` (create if needed, or use CSS config)

- [ ] **Step 1: Update index.html**

Remove `class="dark"` from `<html>`. Update body classes. Fix viewport (keep user-scalable=no for app, add safe area env):
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#F5F5F7" />
    <link rel="manifest" href="/manifest.json" />
    <title>Magpie</title>
  </head>
  <body class="bg-[#F5F5F7] text-[#1D1D1F] overflow-hidden fixed inset-0">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update index.css with system font, safe areas, reduced-motion**

```css
@import "tailwindcss";

@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-overflow-scrolling: touch;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fadeIn 0.2s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .animate-in {
    animation: none;
  }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* iOS safe area padding utilities */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/index.html packages/client/src/index.css
git commit -m "feat: macOS light theme foundation — system font, safe areas, reduced-motion"
```

---

### Task 2: Redesign App shell — Sidebar, BottomNav, App.tsx

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/client/src/components/Sidebar.tsx`
- Modify: `packages/client/src/components/BottomNav.tsx`

- [ ] **Step 1: Rewrite Sidebar with frosted glass macOS style**

Key changes:
- Background: `bg-white/80 backdrop-blur-xl border-r border-[#D2D2D7]`
- Header: `text-[#1D1D1F] font-semibold`
- Active link: `bg-[#007AFF]/10 text-[#007AFF]`
- Inactive: `text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5`
- Collapse button: add `aria-label="Toggle sidebar"`
- Icon size: `w-5 h-5` (keep)

- [ ] **Step 2: Rewrite BottomNav with iOS tab bar style**

Key changes:
- Background: `bg-white/90 backdrop-blur-xl border-t border-[#D2D2D7]`
- Add `pb-safe` class for iOS home indicator
- Active: `text-[#007AFF]`
- Inactive: `text-[#86868B]`
- Touch targets: `py-3` (min 44px height)
- Add `aria-label` to each NavLink

- [ ] **Step 3: Update App.tsx layout**

- Remove offline banner dark colors, use: `bg-amber-50 text-amber-800 border-b border-amber-200`
- Main bg: already set via body

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/App.tsx packages/client/src/components/Sidebar.tsx packages/client/src/components/BottomNav.tsx
git commit -m "feat: macOS frosted sidebar and iOS tab bar with safe areas"
```

---

### Task 3: Redesign ChatInput, VoiceInput, ThinkingIndicator, Spinner

**Files:**
- Modify: `packages/client/src/components/ChatInput.tsx`
- Modify: `packages/client/src/components/VoiceInput.tsx`
- Modify: `packages/client/src/components/ThinkingIndicator.tsx`
- Modify: `packages/client/src/components/ui/Spinner.tsx`

- [ ] **Step 1: Rewrite ChatInput with macOS style**

Key changes:
- Container: `border border-[#D2D2D7] rounded-xl bg-white focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 shadow-sm transition-all`
- Textarea: `text-[#1D1D1F] placeholder-[#86868B]` remove `bg-transparent`, ensure `bg-white`
- Send button: `text-[#007AFF] disabled:text-[#D2D2D7]` with `aria-label="Send message"`
- Touch target: `p-2.5` (min 44px)
- Form border: `border-t border-[#E5E5EA] bg-[#F5F5F7]`

- [ ] **Step 2: Rewrite VoiceInput with aria-label and touch size**

- Add `aria-label="Record voice message"`
- Recording: `ring-2 ring-red-500 bg-red-500 text-white`
- Processing: `opacity-50 text-[#86868B]`
- Idle: `text-[#6E6E73] hover:text-[#1D1D1F]`
- Touch target: `p-2.5`

- [ ] **Step 3: Update Spinner with ARIA**

```tsx
export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-[#007AFF] ${className}`} role="status" aria-label="Loading" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
```

- [ ] **Step 4: Update ThinkingIndicator**

- `text-[#6E6E73]` instead of `text-gray-400`
- Add `role="status"`

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/ChatInput.tsx packages/client/src/components/VoiceInput.tsx packages/client/src/components/ThinkingIndicator.tsx packages/client/src/components/ui/Spinner.tsx
git commit -m "feat: macOS-style chat input, voice button, and accessible spinner"
```

---

### Task 4: Redesign MessageList and Chat page

**Files:**
- Modify: `packages/client/src/components/MessageList.tsx`
- Modify: `packages/client/src/routes/Chat.tsx`

- [ ] **Step 1: Rewrite MessageList with iMessage-style bubbles**

- User messages: `bg-[#007AFF] text-white rounded-2xl rounded-br-sm`
- Assistant messages: `bg-white text-[#1D1D1F] rounded-2xl rounded-bl-sm shadow-sm border border-[#E5E5EA]`
- Avatar: `bg-[#007AFF]` circle with "M" in white
- Text: `text-sm text-[#1D1D1F]` for assistant, `text-white` for user

- [ ] **Step 2: Update Chat.tsx**

- Empty state: `text-[#6E6E73]` with more helpful message and icon
- Add loading state when `isLoading && messages.length === 0`

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/MessageList.tsx packages/client/src/routes/Chat.tsx
git commit -m "feat: iMessage-style chat bubbles on light background"
```

---

### Task 5: Redesign PlaybackBar with macOS style and touch fixes

**Files:**
- Modify: `packages/client/src/components/PlaybackBar.tsx`

- [ ] **Step 1: Rewrite PlaybackBar**

Key changes:
- Bar: `bg-white/90 backdrop-blur-xl border-t border-[#D2D2D7]`
- Track info: `text-[#1D1D1F]` name, `text-[#6E6E73]` artist
- Controls: `text-[#1D1D1F]` with `hover:text-[#007AFF]` — add `aria-label` to EVERY button
- Active shuffle/repeat: `text-[#007AFF]`
- Touch targets: `p-2.5` on all buttons (min 44px)
- Time text: `text-[#6E6E73]` (sufficient contrast on white)
- Range slider: style with `accent-[#007AFF]`, add `h-2` instead of `h-1`
- Compact mobile: `gap-1 md:gap-3`

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/PlaybackBar.tsx
git commit -m "feat: macOS-style playback bar with accessible touch targets"
```

---

### Task 6: Redesign route pages — ConversationList, Recent, Media, Upload

**Files:**
- Modify: `packages/client/src/routes/ConversationList.tsx`
- Modify: `packages/client/src/routes/Recent.tsx`
- Modify: `packages/client/src/routes/Media.tsx`
- Modify: `packages/client/src/routes/Upload.tsx`

- [ ] **Step 1: ConversationList**

- Title: `text-[#1D1D1F] font-semibold`
- Cards: `bg-white rounded-xl shadow-sm border border-[#E5E5EA] hover:shadow-md transition-shadow`
- Preview text: `text-[#6E6E73]`
- Date: `text-[#86868B]`
- New Chat button: `bg-[#007AFF] text-white rounded-lg` with `aria-label`
- Empty state: helpful text with icon
- Add loading spinner while fetching

- [ ] **Step 2: Recent**

- Section headers: `text-[#6E6E73] uppercase`
- Skeleton: `bg-[#E5E5EA] animate-pulse rounded-xl`
- "Load more" button: `text-[#007AFF] hover:text-[#0056CC]` with clear disabled state

- [ ] **Step 3: Media**

- Tabs: active `bg-[#007AFF] text-white`, inactive `text-[#6E6E73] hover:bg-black/5`
- Search: `bg-white border border-[#D2D2D7] rounded-lg focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20`
- Playlist cards: `bg-white rounded-xl shadow-sm border border-[#E5E5EA]`
- Empty states: helpful with icons

- [ ] **Step 4: Upload**

- Drop zone: `border-2 border-dashed border-[#D2D2D7] rounded-xl bg-white hover:border-[#007AFF]`
- Drag hover: `border-[#007AFF] bg-[#007AFF]/5`
- Progress bar: `bg-[#007AFF]` on `bg-[#E5E5EA]` track
- File rows: `bg-white rounded-lg shadow-sm border border-[#E5E5EA]`
- Add `aria-label` to drop zone, `role="region"`

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/routes/ConversationList.tsx packages/client/src/routes/Recent.tsx packages/client/src/routes/Media.tsx packages/client/src/routes/Upload.tsx
git commit -m "feat: macOS light theme for all route pages"
```

---

### Task 7: Redesign Settings page

**Files:**
- Modify: `packages/client/src/routes/Settings.tsx`

- [ ] **Step 1: Full Settings restyle**

- Section cards: `bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-4`
- Section titles: `text-base font-semibold text-[#1D1D1F]`
- Labels: `text-sm text-[#6E6E73]`
- Inputs: `bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg text-[#1D1D1F] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 focus:outline-none`
- Select: same as inputs
- Buttons: primary `bg-[#007AFF] text-white`, secondary `bg-[#F5F5F7] text-[#1D1D1F] border border-[#D2D2D7]`
- Toggle: `bg-[#E5E5EA]` off / `bg-[#34C759]` on (macOS green)
- Status dots: `bg-[#34C759]` ok / `bg-[#FF3B30]` error
- Eye icon: add `aria-label="Toggle password visibility"`
- Test button: `bg-[#34C759] text-white`
- All inputs: min height 44px for touch

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/routes/Settings.tsx
git commit -m "feat: macOS light theme Settings page with accessible inputs"
```

---

### Task 8: Redesign renderer components

**Files:**
- Modify: `packages/client/src/components/renderers/VideoCard.tsx`
- Modify: `packages/client/src/components/renderers/AudioPlayer.tsx`
- Modify: `packages/client/src/components/renderers/ImageGrid.tsx`
- Modify: `packages/client/src/components/renderers/FileList.tsx`
- Modify: `packages/client/src/components/ImageLightbox.tsx`

- [ ] **Step 1: VideoCard**

- Card: `bg-white rounded-xl shadow-sm overflow-hidden border border-[#E5E5EA]`
- Title: `text-[#1D1D1F]`
- Duration badge: `bg-black/70 text-white`
- Play overlay: always visible on mobile (`opacity-60 md:opacity-0 md:group-hover:opacity-100`)

- [ ] **Step 2: AudioPlayer**

- Card: `bg-white rounded-lg hover:bg-[#F5F5F7] border border-[#E5E5EA]`
- Active: `border-l-2 border-[#007AFF]`
- Play button: `bg-[#007AFF] text-white rounded-full p-2.5` (44px touch)
- Queue button: `text-[#6E6E73] hover:text-[#007AFF]` with `aria-label="Add to queue"`

- [ ] **Step 3: ImageGrid**

- Responsive: `grid-cols-2 md:grid-cols-3`
- Images: `rounded-lg` (not overflow-hidden on container)

- [ ] **Step 4: FileList**

- Row: `bg-white rounded-lg hover:bg-[#F5F5F7] border border-[#E5E5EA]`
- Icon: `text-[#007AFF]`
- Name: `text-[#1D1D1F]`
- Size: `text-[#6E6E73]`

- [ ] **Step 5: ImageLightbox**

- Backdrop: `bg-black/90`
- Buttons: `text-white p-3` (48px touch targets) with `aria-label`
- Close: `aria-label="Close lightbox"`
- Nav: `aria-label="Previous image"` / `aria-label="Next image"`

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/renderers/ packages/client/src/components/ImageLightbox.tsx
git commit -m "feat: macOS light theme for all renderer components"
```

---

### Task 9: Update e2e tests and final verification

**Files:**
- Modify: `e2e/navigation.spec.ts`
- Modify: `e2e/media.spec.ts`
- Modify: `e2e/settings.spec.ts`

- [ ] **Step 1: Update e2e tests for new classes**

- Navigation: active class changed from `text-white` to `text-[#007AFF]` or contains `007AFF`
- Media: active tab class changed from `bg-gray-800` to `bg-[#007AFF]` or contains `007AFF`
- Settings: update any class-based assertions

- [ ] **Step 2: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All 184+ tests pass (no server changes)

- [ ] **Step 3: Run all e2e tests**

Run: `bunx playwright test`
Expected: All 38 tests pass

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test: update e2e tests for macOS light theme"
```
