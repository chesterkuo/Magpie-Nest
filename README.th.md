# Magpie — AI-Native NAS & ตัวแทนจัดการสตอเรจ

> ผู้ช่วยจัดการสตอเรจ AI ส่วนตัวของคุณ — จัดการ ค้นหา เล่น และจัดระเบียบไฟล์ด้วยภาษาธรรมชาติ ทำงานในเครื่อง 100% บนอุปกรณ์ของคุณ

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Magpie คืออะไร?

Magpie คือ **ตัวแทนจัดการ NAS/สตอเรจแบบ AI-native** ที่เปลี่ยน Mac Mini (หรือ Mac ทุกรุ่น) ให้กลายเป็นเซิร์ฟเวอร์ไฟล์อัจฉริยะ ผ่านเว็บแอปเดียวที่เข้าถึงได้จากทุกอุปกรณ์ ทั้ง iPhone, iPad, PC คุณสามารถสนทนากับผู้ช่วย AI ที่เข้าใจไฟล์ของคุณ และช่วยค้นหา เล่น จัดระเบียบ และอัปโหลดไฟล์ด้วยภาษาพูดธรรมดา

ลองนึกภาพว่านี่คือทางเลือกแทน cloud storage แบบ self-hosted ที่ขับเคลื่อนด้วย AI พร้อมความฉลาดของผู้ช่วยส่วนตัว

**ไม่มี Cloud ไม่มีค่าสมัครสมาชิก ข้อมูลของคุณไม่ออกจากอุปกรณ์**

## ฟีเจอร์

### AI Agent
- **ค้นหาด้วยภาษาธรรมชาติ** — "หาการนำเสนอที่ฉันทำเมื่อสัปดาห์ที่แล้ว" — ทำงานผ่าน hybrid search (vector + keyword re-ranking)
- **จัดระเบียบไฟล์** — เครื่องมือที่ขับเคลื่อนด้วย AI สำหรับจัดระเบียบไฟล์ตามประเภท/วันที่ และเปลี่ยนชื่อไฟล์เป็นชุดด้วย regex
- **ควบคุม AirDrop** — เปิด/ปิด AirDrop บน Mac ผ่านคำสั่งแชท
- **การสนทนาหลายรอบ** — ประวัติการสนทนาแบบถาวร พร้อมมุมมองจัดกลุ่มตามวันที่และลบเป็นชุด

### มีเดีย
- **สตรีมวิดีโอ** — HLS streaming ในตัวพร้อม transcoding ตามความต้องการและการสร้าง thumbnail
- **เครื่องเล่นเสียง** — แสดงศิลปิน/อัลบั้ม, คิว, สุ่ม, เล่นซ้ำ, ควบคุมระดับเสียง
- **ดูตัวอย่างเอกสาร** — ดู PDF (พร้อมเต็มหน้าจอ), DOCX, XLSX, PPTX โดยตรงในเบราว์เซอร์
- **แกลเลอรีรูปภาพ** — มุมมองกริดพร้อมการนำทางแบบ lightbox

### สตอเรจ
- **อัปโหลดไฟล์** — ลากและวางอัปโหลดจากอุปกรณ์ใดก็ได้ (iPhone, PC) ผ่าน LAN พร้อมแถบแสดงความคืบหน้า
- **การจัดทำดัชนีอัจฉริยะ** — ตรวจสอบไฟล์อัตโนมัติพร้อม semantic vector search
- **Metadata ครบครัน** — แยกข้อมูลระยะเวลา, ศิลปิน, อัลบั้ม, ขนาด, จำนวนหน้าจากไฟล์

### อินเทอร์เฟซ
- **ดีไซน์แบบ macOS native** — ธีมสว่างพร้อมฟอนต์ระบบ Apple, sidebar กระจกฝ้า, การนำทางแบบ iOS
- **Responsive** — sidebar สำหรับเดสก์ท็อป + การนำทางด้านล่างสำหรับมือถือ ปรับแต่งสำหรับ iPhone
- **10 ภาษา** — English, 繁體中文, 简体中文, Français, Español, 日本語, 한국어, ไทย, Nederlands, Bahasa Indonesia — ตรวจจับอัตโนมัติจากการตั้งค่าเบราว์เซอร์/OS
- **อินเทอร์เฟซเสียง** — ป้อนเสียงแบบ push-to-talk (whisper.cpp) และแปลงข้อความเป็นเสียง (Kokoro)
- **PWA** — ติดตั้งเป็นแอปแบบ standalone พร้อมรองรับการใช้งานออฟไลน์

## เทคโนโลยีที่ใช้

| เลเยอร์ | เทคโนโลยี |
|---------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Server | [Hono](https://hono.dev) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| LLM | OpenAI-compatible API (ค่าเริ่มต้น: Gemini 2.5 Flash) หรือ [Ollama](https://ollama.com) |
| Embeddings | Gemini Embedding หรือ Ollama (nomic-embed-text) |
| Vector DB | [LanceDB](https://lancedb.com) |
| Database | SQLite (bun:sqlite) |
| i18n | react-i18next (10 ภาษา) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## เริ่มต้นใช้งาน

### ข้อกำหนดเบื้องต้น

- macOS พร้อม Apple Silicon (M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org) (สำหรับสตรีมวิดีโอและ thumbnail)
- LLM API key (เช่น [Google AI Studio](https://aistudio.google.com) สำหรับ Gemini — ฟรี) **หรือ** [Ollama](https://ollama.com) สำหรับการประมวลผลในเครื่องทั้งหมด

### 1. Clone และติดตั้ง

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. ตั้งค่าสภาพแวดล้อม

```bash
cp .env.example .env
# แก้ไข .env — ตั้งค่า LLM_API_KEY และ WATCH_DIRS อย่างน้อย
```

ดูรายละเอียดที่ [การตั้งค่า LLM Provider](#การตั้งค่า-llm-provider) ด้านล่าง

### 3. (ไม่บังคับ) ใช้ Ollama สำหรับการประมวลผลในเครื่อง

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

จากนั้นตั้งค่า `LLM_PROVIDER=ollama` และ `EMBED_PROVIDER=ollama` ใน `.env`

### 4. (ไม่บังคับ) ตั้งค่าเสียง

```bash
bash scripts/setup-models.sh
```

### 5. รัน

```bash
# เริ่ม server + client (hot reload)
bun run dev

# เริ่ม indexer worker (ในเทอร์มินัลแยก)
bun run dev:indexer

# หรือรันแต่ละส่วนแยกกัน
bun run dev:server   # API บนพอร์ต 8000
bun run dev:client   # Vite dev server บนพอร์ต 5173
```

> **สำคัญ:** ต้องรัน indexer worker อยู่เสมอเพื่อให้ไฟล์ที่อัปโหลด/ตรวจสอบได้รับการจัดทำดัชนีและค้นหาได้

### 6. เข้าถึง

- **เดสก์ท็อป:** เปิด [http://localhost:5173](http://localhost:5173)
- **iPhone/มือถือ:** เปิด `http://<IP ของ Mac>:5173` (เช่น `http://192.168.1.108:5173`)
- **อัปโหลดไฟล์:** ใช้หน้า Upload หรือ AirDrop ไปที่ Mac ของคุณ

### 7. Build สำหรับ production

```bash
bun run build        # Build client
bun run dev:server   # ให้บริการทุกอย่างบนพอร์ต 8000
```

## โครงสร้างโปรเจกต์

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono API server
│   │   ├── agent/            # ReAct loop, tools, system prompt
│   │   ├── routes/           # REST API endpoints
│   │   ├── services/         # DB, LanceDB, indexer, search, HLS, providers
│   │   │   └── providers/    # LLM/embedding provider abstraction
│   │   ├── middleware/       # การยืนยันตัวตน
│   │   └── workers/          # Background indexer worker
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # Chat, Conversations, Recent, Media, Upload, Settings
│   │   ├── src/hooks/        # useSSE, usePlayback, useOnlineStatus
│   │   ├── src/components/   # UI components + renderers
│   │   └── src/locales/      # ไฟล์แปลภาษา i18n (10 ภาษา)
│   └── shared/               # TypeScript types ที่ใช้ร่วมกัน
├── e2e/                      # Playwright end-to-end tests
├── docs/                     # ข้อกำหนดและแผนการพัฒนา
├── docker/                   # Docker Compose (Ollama)
├── scripts/                  # Setup scripts (voice models, icon generation)
└── data/                     # ข้อมูล runtime (SQLite, LanceDB, thumbs, HLS cache)
```

## API Endpoints

| Method | Path | Auth | คำอธิบาย |
|--------|------|:----:|----------|
| POST | `/api/chat` | ใช่ | แชทกับ AI agent (SSE stream) |
| POST | `/api/upload` | ใช่ | อัปโหลดไฟล์ (multipart/form-data) |
| GET | `/api/files` | ใช่ | แสดงรายการไฟล์พร้อมการกรองและแบ่งหน้า |
| GET | `/api/file/:id` | ใช่ | ให้บริการไฟล์ (รองรับ Range requests) |
| GET | `/api/file/:id/preview` | ใช่ | ดูตัวอย่างเอกสาร (DOCX/XLSX → HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | ไม่ | HLS video playlist |
| GET | `/api/stream/:id/:segment` | ไม่ | HLS video segment |
| GET | `/api/thumb/:id` | ไม่ | Thumbnail ของไฟล์ (WebP) |
| GET/POST | `/api/playlists` | ใช่ | Playlist CRUD |
| GET/PUT/DELETE | `/api/conversations` | ใช่ | Conversation CRUD (ลบเดี่ยว + ลบเป็นชุด) |
| GET/PUT | `/api/settings` | ใช่ | จัดการการตั้งค่า |
| POST | `/api/settings/test-connection` | ใช่ | ทดสอบการเชื่อมต่อ LLM/embedding provider |
| POST | `/api/stt` | ใช่ | แปลงเสียงเป็นข้อความ |
| POST | `/api/tts` | ใช่ | แปลงข้อความเป็นเสียง |
| GET | `/api/health` | ไม่ | ตรวจสอบสถานะระบบ |

## เครื่องมือของ Agent

AI agent เข้าถึงเครื่องมือเหล่านี้ผ่าน function calling:

| เครื่องมือ | คำอธิบาย |
|-----------|----------|
| `search_files` | Hybrid search (vector + keyword) พร้อมตัวกรองประเภท/วันที่ |
| `play_media` | สตรีมไฟล์วิดีโอหรือเสียง |
| `open_document` | ดูตัวอย่างเอกสาร (PDF, DOCX, XLSX, PPTX) |
| `list_recent` | เรียกดูไฟล์ที่แก้ไขล่าสุด |
| `get_file_info` | ดู metadata และรายละเอียดของไฟล์ |
| `create_playlist` | สร้าง playlist พร้อมตัวเลือกเติมอัตโนมัติจากการค้นหา |
| `list_directory` | เรียกดูไฟล์ในโฟลเดอร์ที่ระบุ |
| `get_disk_status` | ตรวจสอบการใช้พื้นที่ดิสก์และสถิติไฟล์ |
| `organize_files` | จัดระเบียบไฟล์ลงในโฟลเดอร์ย่อยตามประเภทหรือวันที่ |
| `batch_rename` | เปลี่ยนชื่อไฟล์ที่ตรงกับ regex pattern (พร้อม dry-run preview) |
| `airdrop_control` | เปิด/ปิด AirDrop, ตรวจสอบสถานะ |

## การทดสอบ

```bash
# API & unit tests (192 tests)
cd packages/server
bun test
bun test --watch

# E2E browser tests (38 tests, Playwright + Chromium)
bunx playwright test
```

> ครั้งแรก: `bun add -d @playwright/test && bunx playwright install chromium`

## การตั้งค่า LLM Provider

Magpie รองรับ LLM provider หลายรายผ่าน OpenAI-compatible API interface **provider เริ่มต้นคือ Gemini 2.5 Flash** ผ่าน endpoint ที่เข้ากันได้กับ OpenAI ของ Google รองรับ Ollama เป็นตัวเลือกในเครื่องทั้งหมด

Chat model และ embedding model สามารถตั้งค่าได้**อิสระจากกัน** ตั้งค่าผ่าน `.env` หรือ**หน้า Settings** ใน UI

### ใช้ Gemini (ค่าเริ่มต้น)

รับ API key ฟรีจาก [Google AI Studio](https://aistudio.google.com):

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-google-api-key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.5-flash

EMBED_PROVIDER=openai-compatible
EMBED_API_KEY=your-google-api-key
EMBED_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
EMBED_MODEL=gemini-embedding-2-preview
```

### ใช้ OpenAI-compatible provider ใดก็ได้

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

ใช้งานได้กับ OpenAI, Groq, OpenRouter, Together และ endpoint ที่เข้ากันได้กับ OpenAI ทุกรายการ

### ใช้ Ollama (ในเครื่องทั้งหมด)

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## ตัวแปรสภาพแวดล้อม

### LLM (chat model)

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|--------|------------|----------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` หรือ `ollama` |
| `LLM_API_KEY` | — | API key สำหรับ chat provider |
| `LLM_BASE_URL` | Gemini endpoint | OpenAI-compatible base URL |
| `LLM_MODEL` | `gemini-2.5-flash` | ชื่อ chat model |

### Embedding model

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|--------|------------|----------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` หรือ `ollama` |
| `EMBED_API_KEY` | — | API key สำหรับ embedding provider |
| `EMBED_BASE_URL` | Gemini endpoint | OpenAI-compatible base URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | ชื่อ embedding model |

### Ollama

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|--------|------------|----------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama chat model |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |

### ทั่วไป

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|--------|------------|----------|
| `DATA_DIR` | `./data` | ไดเรกทอรีจัดเก็บข้อมูล |
| `API_SECRET` | `magpie-dev` | โทเค็นการยืนยันตัวตน API |
| `PORT` | `8000` | พอร์ตเซิร์ฟเวอร์ |
| `WATCH_DIRS` | — | เส้นทางที่คั่นด้วยเครื่องหมายจุลภาคสำหรับตรวจสอบและจัดทำดัชนี |

## ใบอนุญาต

Copyright 2026 Plusblocks Technology Ltd.
