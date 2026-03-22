# File Upload & AirDrop Control — Design Spec

## Goal

Allow users to upload files to Magpie from any device (iPhone, PC) via the web UI, and control AirDrop on the Mac Mini through chat commands. Uploaded and AirDropped files both land in `~/Downloads/` and are auto-indexed by the existing pipeline.

## Context

Magpie runs on a Mac Mini as a local file assistant. Currently, files must already exist in watch directories to be indexed. Users want to:
- Upload files from iPhone/PC over the LAN via browser
- AirDrop files from iPhone to Mac Mini and have them auto-indexed
- Control AirDrop discoverability via chat (enable/disable from phone)

The Mac Mini already watches `~/Downloads/` (configured in `WATCH_DIRS`). AirDrop-received files land there by default. If the iPhone and Mac Mini share the same Apple Account, AirDrop is auto-accepted.

---

## Section 1: File Upload

### 1.1 Server — Upload Endpoint

**`POST /api/upload`** (multipart/form-data)

- Accepts multiple files in the `files` field
- Auth: Bearer token (same as all `/api/*` routes)
- Destination: first directory from `WATCH_DIRS` (defaults to `~/Downloads`)
- Filename conflicts: append ` (1)`, ` (2)`, etc. before the extension
- After saving each file, call `db.enqueue(filePath, 'created')` to trigger indexing
- No file size or type restrictions

**Request:** `multipart/form-data` with one or more `files` fields

**Response:**
```json
{
  "uploaded": [
    { "name": "photo.jpg", "path": "/Users/chester/Downloads/photo.jpg", "size": 204800, "status": "ok" },
    { "name": "doc.pdf", "path": "/Users/chester/Downloads/doc.pdf", "size": 102400, "status": "ok" }
  ]
}
```

**Error per file:** `{ "name": "bad.zip", "status": "error", "error": "Write failed" }`

**Implementation file:** `packages/server/routes/upload.ts`

### 1.2 Client — Upload Page

**Route:** `/upload`

**Components:**
- Create `packages/client/src/routes/Upload.tsx`
- Drag-and-drop zone covering the main content area
- "Browse files" button (triggers `<input type="file" multiple>`)
- File list with per-file progress bars
- Per-file states: pending → uploading (progress %) → done (checkmark) → auto-fade after 3s
- Error state: red text with retry option

**Upload mechanism:**
- Use `XMLHttpRequest` (not fetch) for `upload.onprogress` events
- Send all selected files in a single `FormData` request
- Show individual progress by tracking total bytes (approximate per-file split based on file sizes)

**UI design:**
- Drop zone: `border-2 border-dashed border-gray-700 rounded-xl` with `ArrowUpTrayIcon` centered
- Drag hover: `border-blue-500 bg-blue-500/10`
- File rows: filename, size, progress bar, status icon
- Progress bar: `h-1 bg-blue-500 rounded-full transition-all`

### 1.3 Navigation

Add upload link to Sidebar and BottomNav:
- Icon: `ArrowUpTrayIcon` from `@heroicons/react/24/outline`
- Label: "Upload"
- Position: between Media and Settings
- Route: `/upload`

### 1.4 Data Flow

```
Browser (iPhone/PC) → POST /api/upload → ~/Downloads/file.jpg
                                              ↓
                                      db.enqueue('created')
                                              ↓
                                      indexer worker (5s poll)
                                              ↓
                                      metadata + thumbnail + embedding
                                              ↓
                                      searchable in Magpie
```

No changes needed to watcher, indexer, search, or browse — the existing pipeline handles everything after the file lands on disk and is enqueued.

---

## Section 2: AirDrop Control via Chat

### 2.1 Agent Tools

**Tool: `airdrop_control`**

```typescript
{
  name: 'airdrop_control',
  description: 'Control AirDrop discoverability on this Mac. Can enable (everyone/contacts) or disable AirDrop, and check current status.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'everyone', 'contacts', 'off'],
        description: 'Get current status or set AirDrop mode'
      }
    },
    required: ['action']
  }
}
```

**Implementation in `packages/server/agent/tools/registry.ts`:**

For `status`:
```bash
defaults read com.apple.sharingd DiscoverableMode
```
Returns: `"Everyone"`, `"Contacts Only"`, or `"Off"`

For `everyone` / `contacts` / `off`:
```bash
defaults write com.apple.sharingd DiscoverableMode -string "Everyone"
killall -HUP sharingd
```

Map: `everyone` → `"Everyone"`, `contacts` → `"Contacts Only"`, `off` → `"Off"`

**Response format:**
```json
{ "mode": "Everyone", "message": "AirDrop is now visible to everyone. Files received via AirDrop will appear in ~/Downloads and be auto-indexed." }
```

### 2.2 User Interaction Examples

- "Enable AirDrop" → `airdrop_control({ action: 'everyone' })`
- "Turn off AirDrop" → `airdrop_control({ action: 'off' })`
- "Is AirDrop on?" → `airdrop_control({ action: 'status' })`
- "Set AirDrop to contacts only" → `airdrop_control({ action: 'contacts' })`

### 2.3 Security Note

AirDrop set to "Everyone" means any nearby Apple device can send files. The tool should remind users to turn it off when done. The LLM system prompt should include guidance: when enabling AirDrop for everyone, suggest turning it off after use.

---

## What's NOT in Scope

- Bluetooth OBEX file transfer (no macOS CLI support)
- Resumable/chunked uploads (unnecessary for LAN use)
- Upload from chat (attach files in conversation) — future enhancement
- AirDrop sending from Magpie (only receiving)

---

## Files to Create/Modify

**New files:**
- `packages/server/routes/upload.ts` — upload endpoint
- `packages/client/src/routes/Upload.tsx` — upload page

**Modified files:**
- `packages/server/index.ts` — wire upload route
- `packages/server/agent/tools/registry.ts` — add airdrop_control tool + tool definition
- `packages/client/src/App.tsx` — add /upload route
- `packages/client/src/components/Sidebar.tsx` — add Upload link
- `packages/client/src/components/BottomNav.tsx` — add Upload link

**Test files:**
- `packages/server/routes/__tests__/upload.test.ts`
