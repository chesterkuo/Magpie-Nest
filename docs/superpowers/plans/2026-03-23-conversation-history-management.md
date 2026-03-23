# Conversation History Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete (single + batch) to conversation history, and reorganize the list with date-grouped collapsible sections.

**Architecture:** Add `deleteConversation` and `deleteConversations` methods to db.ts. Add DELETE endpoints to conversations route. Rewrite ConversationList.tsx with date grouping, selection mode, and batch delete UI.

**Tech Stack:** Hono, Bun SQLite, React 19, Tailwind CSS 4, Heroicons

**Spec:** `docs/superpowers/specs/2026-03-23-conversation-history-management-design.md`

---

### Task 1: Add delete methods to db.ts with tests

**Files:**
- Modify: `packages/server/services/db.ts`
- Modify: `packages/server/services/__tests__/db.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/server/services/__tests__/db.test.ts`:
```typescript
describe('conversation delete', () => {
  it('deleteConversation removes a conversation', () => {
    db.saveConversation('del-1', JSON.stringify([{ role: 'user', text: 'hello' }]))
    expect(db.getConversation('del-1')).not.toBeNull()
    const deleted = db.deleteConversation('del-1')
    expect(deleted).toBe(true)
    expect(db.getConversation('del-1')).toBeNull()
  })

  it('deleteConversation returns false for nonexistent id', () => {
    expect(db.deleteConversation('nonexistent')).toBe(false)
  })

  it('deleteConversations batch deletes multiple', () => {
    db.saveConversation('batch-1', JSON.stringify([]))
    db.saveConversation('batch-2', JSON.stringify([]))
    db.saveConversation('batch-3', JSON.stringify([]))
    const count = db.deleteConversations(['batch-1', 'batch-3'])
    expect(count).toBe(2)
    expect(db.getConversation('batch-1')).toBeNull()
    expect(db.getConversation('batch-2')).not.toBeNull()
    expect(db.getConversation('batch-3')).toBeNull()
  })

  it('deleteConversations returns 0 for empty array', () => {
    expect(db.deleteConversations([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: FAIL — `deleteConversation` is not a function

- [ ] **Step 3: Add delete methods to MagpieDb**

In `packages/server/services/db.ts`:

1. Add to `MagpieDb` interface (after `listConversations`):
```typescript
  deleteConversation(id: string): boolean
  deleteConversations(ids: string[]): number
```

2. Add prepared statement (after `listConversations` stmt):
```typescript
    deleteConversation: db.prepare('DELETE FROM conversations WHERE id = ?'),
```

3. Add methods to return object (after `listConversations` method):
```typescript
    deleteConversation(id: string) {
      const result = stmts.deleteConversation.run(id)
      return result.changes > 0
    },

    deleteConversations(ids: string[]) {
      if (ids.length === 0) return 0
      const placeholders = ids.map(() => '?').join(',')
      const stmt = db.prepare(`DELETE FROM conversations WHERE id IN (${placeholders})`)
      const result = stmt.run(...ids)
      return result.changes
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/server && bun test services/__tests__/db.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/services/db.ts packages/server/services/__tests__/db.test.ts
git commit -m "feat: add deleteConversation and deleteConversations to db"
```

---

### Task 2: Add DELETE endpoints to conversations route with tests

**Files:**
- Modify: `packages/server/routes/conversations.ts`
- Modify: `packages/server/routes/__tests__/conversations.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/server/routes/__tests__/conversations.test.ts`:
```typescript
describe('DELETE /api/conversations/:id', () => {
  it('deletes an existing conversation', async () => {
    // First create a conversation
    await app.request('/api/conversations/del-test', {
      method: 'PUT',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: 'hi' }] }),
    })

    const res = await app.request('/api/conversations/del-test', {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    // Verify it's gone
    const get = await app.request('/api/conversations/del-test', { headers: AUTH })
    expect(get.status).toBe(404)
  })

  it('returns 404 for nonexistent conversation', async () => {
    const res = await app.request('/api/conversations/nope', {
      method: 'DELETE',
      headers: AUTH,
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/conversations (batch)', () => {
  it('deletes multiple conversations', async () => {
    // Create two
    for (const id of ['batch-a', 'batch-b']) {
      await app.request(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', text: 'hi' }] }),
      })
    }

    const res = await app.request('/api/conversations', {
      method: 'DELETE',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['batch-a', 'batch-b'] }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(2)
  })

  it('returns 400 when ids is empty', async () => {
    const res = await app.request('/api/conversations', {
      method: 'DELETE',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && bun test routes/__tests__/conversations.test.ts`

- [ ] **Step 3: Add DELETE endpoints**

Add to `packages/server/routes/conversations.ts` (after the GET /:id route):

```typescript
  route.delete('/conversations/:id', (c) => {
    const { id } = c.req.param()
    const deleted = db.deleteConversation(id)
    if (!deleted) return c.json({ error: 'Conversation not found' }, 404)
    return c.json({ ok: true })
  })

  route.delete('/conversations', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>()
    if (!ids?.length) return c.json({ error: 'ids array is required' }, 400)
    const deleted = db.deleteConversations(ids)
    return c.json({ deleted })
  })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/server && bun test routes/__tests__/conversations.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/routes/conversations.ts packages/server/routes/__tests__/conversations.test.ts
git commit -m "feat: add DELETE endpoints for conversations (single + batch)"
```

---

### Task 3: Rewrite ConversationList with date groups, selection, and delete

**Files:**
- Modify: `packages/client/src/routes/ConversationList.tsx`

- [ ] **Step 1: Rewrite ConversationList.tsx**

Full rewrite with:

**Date grouping helper:**
```typescript
function groupByDate(conversations: ConversationSummary[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const last7 = new Date(today.getTime() - 7 * 86400000)
  const last30 = new Date(today.getTime() - 30 * 86400000)

  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 Days', items: [] },
    { label: 'Last 30 Days', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const c of conversations) {
    const d = new Date(c.updatedAt)
    if (d >= today) groups[0].items.push(c)
    else if (d >= yesterday) groups[1].items.push(c)
    else if (d >= last7) groups[2].items.push(c)
    else if (d >= last30) groups[3].items.push(c)
    else groups[4].items.push(c)
  }

  return groups.filter(g => g.items.length > 0)
}
```

**State:**
```typescript
const [conversations, setConversations] = useState<ConversationSummary[]>([])
const [selecting, setSelecting] = useState(false)
const [selected, setSelected] = useState<Set<string>>(new Set())
const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['Last 7 Days', 'Last 30 Days', 'Older']))
const [confirmDelete, setConfirmDelete] = useState(false)
```

**UI structure:**
- Header: h1 "Conversations" + "Select"/"Done" button + "New Chat" button
- Groups: collapsible sections with `ChevronDownIcon`/`ChevronRightIcon`
- Group header: label + count badge + (in selection mode) select-all checkbox
- Conversation rows: checkbox (in selection mode) + preview + meta
- Floating delete bar: when selected.size > 0
- Confirmation dialog: simple overlay

**macOS light theme classes:**
- Group header: `text-xs font-medium text-[#6E6E73] uppercase tracking-wider py-2 cursor-pointer`
- Cards: `bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-4`
- Select button: `text-[#007AFF] text-sm font-medium`
- Checkbox: `w-5 h-5 accent-[#007AFF]`
- Delete bar: `bg-white border-t border-[#D2D2D7] shadow-lg` with `Delete` button in `bg-[#FF3B30] text-white`
- Confirm overlay: `bg-black/40` backdrop with white card

**Delete logic:**
```typescript
async function handleDelete() {
  const ids = Array.from(selected)
  await fetch('/api/conversations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  })
  setConversations(prev => prev.filter(c => !selected.has(c.id)))
  setSelected(new Set())
  setSelecting(false)
  setConfirmDelete(false)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/routes/ConversationList.tsx
git commit -m "feat: conversation history with date groups, selection, and batch delete"
```

---

### Task 4: Update e2e tests and verify

**Files:**
- Modify: `e2e/conversations.spec.ts`

- [ ] **Step 1: Update e2e tests**

The ConversationList now has a "Select" button and date-grouped layout. Update tests:
- "has New Chat button" — should still pass (button still exists)
- "shows page title" — should still pass
- Other tests may need minor adjustments if the DOM structure changed (conversation items are now inside collapsible groups)

Read the current `e2e/conversations.spec.ts` and update selectors if needed. The conversation preview text and "New Chat" button should still be findable by text content.

- [ ] **Step 2: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All tests pass

- [ ] **Step 3: Run all e2e tests**

Run: `bunx playwright test`
Expected: All 38 tests pass

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test: update e2e tests for conversation history management"
```
