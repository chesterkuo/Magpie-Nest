# Conversation History Management — Design Spec

## Goal

Add delete functionality (single and batch) to conversation history, and reorganize the list with date-grouped collapsible sections.

## Server

### New API Endpoints

**`DELETE /api/conversations/:id`** — Delete a single conversation.
- Returns `{ ok: true }` on success, 404 if not found.

**`DELETE /api/conversations`** — Batch delete conversations.
- Body: `{ ids: string[] }`
- Returns `{ deleted: number }` with count of actually deleted rows.
- Returns 400 if `ids` is empty or missing.

### New Database Methods

Add to `MagpieDb` interface and implementation in `packages/server/services/db.ts`:

```typescript
deleteConversation(id: string): boolean  // returns true if row existed
deleteConversations(ids: string[]): number  // returns count deleted
```

Implementation uses prepared statements:
- `DELETE FROM conversations WHERE id = ?`
- `DELETE FROM conversations WHERE id IN (...)` (dynamically built for batch)

## Client — ConversationList.tsx

### Date-Grouped Collapsible Tree

Group conversations by `updatedAt` into sections:
- **Today** — same calendar day
- **Yesterday** — previous calendar day
- **Last 7 Days** — within last 7 days (excluding today/yesterday)
- **Last 30 Days** — within last 30 days (excluding above)
- **Older** — everything else

Each section has:
- Collapsible header with chevron icon (`ChevronDownIcon`/`ChevronRightIcon`)
- Section label + conversation count badge
- "Select all" checkbox in the header (only visible in selection mode)

Sections default to **expanded** for Today/Yesterday, **collapsed** for older groups.

### Selection Mode

- Header gets a "Select" / "Done" toggle button
- In selection mode: checkboxes appear on every conversation row
- Each date group header gets a "select all" checkbox
- Tapping a conversation in selection mode toggles its checkbox (doesn't navigate)
- Tapping outside selection mode navigates as before

### Floating Delete Bar

When 1+ conversations selected, a floating bar appears at the bottom:
```
[count] selected                              [Delete]
```

- Bar: `fixed bottom-20 left-0 right-0` (above BottomNav) or positioned inside the content area
- Delete button: `bg-[#FF3B30] text-white rounded-lg`
- Clicking Delete shows a confirmation: "Delete N conversation(s)? This cannot be undone."
- On confirm: calls `DELETE /api/conversations` with selected IDs, removes from local state

### Swipe-to-Delete (Optional Enhancement)

Individual conversations support swipe-left to reveal a red "Delete" button (iOS-style). This works independently of selection mode.

## Files to Create/Modify

**Server:**
- Modify: `packages/server/services/db.ts` — add deleteConversation, deleteConversations
- Modify: `packages/server/routes/conversations.ts` — add DELETE endpoints
- Create: `packages/server/routes/__tests__/conversations-delete.test.ts` (or add to existing test file)

**Client:**
- Modify: `packages/client/src/routes/ConversationList.tsx` — full rewrite with date groups, selection, delete

## What's NOT in Scope

- Search/filter conversations
- Edit conversation title
- Export conversations
- Swipe gestures (can be added later)
