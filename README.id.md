# Magpie — Agen NAS & Penyimpanan Berbasis AI

> Asisten penyimpanan AI pribadi Anda — kelola, cari, putar, dan atur file dengan bahasa alami. Berjalan 100% secara lokal di perangkat Anda.

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Apa itu Magpie?

Magpie adalah **agen NAS/penyimpanan berbasis AI** yang mengubah Mac Mini (atau Mac apa pun) menjadi server file yang cerdas. Melalui satu aplikasi web yang dapat diakses dari perangkat mana pun — iPhone, iPad, PC — Anda dapat mengobrol dengan asisten AI yang memahami file Anda dan membantu Anda menemukan, memutar, mengatur, dan mengunggahnya menggunakan bahasa sehari-hari.

Bayangkan ini sebagai alternatif penyimpanan cloud yang di-hosting sendiri dan ditenagai AI — dengan kecerdasan asisten pribadi.

**Tanpa cloud. Tanpa langganan. Data Anda tidak pernah meninggalkan perangkat Anda.**

## Fitur

### AI Agent
- **Pencarian Bahasa Alami** — "Temukan presentasi yang saya kerjakan minggu lalu" — menggunakan hybrid search (vector + keyword re-ranking)
- **Pengorganisasian File** — Alat bertenaga AI untuk mengatur file berdasarkan jenis/tanggal dan ubah nama secara massal dengan regex
- **Kontrol AirDrop** — Aktifkan/nonaktifkan AirDrop di Mac Anda melalui perintah chat
- **Percakapan Multi-gilir** — Riwayat chat persisten dengan tampilan grup berdasarkan tanggal dan hapus massal

### Media
- **Streaming Video** — HLS streaming bawaan dengan transcoding sesuai permintaan dan pembuatan thumbnail
- **Pemutar Audio** — Tampilan artis/album, antrian, acak, ulangi, kontrol volume
- **Pratinjau Dokumen** — Lihat PDF (dengan layar penuh), DOCX, XLSX, PPTX langsung di browser
- **Galeri Gambar** — Tampilan grid dengan navigasi lightbox

### Penyimpanan
- **Unggah File** — Unggah drag-and-drop dari perangkat mana pun (iPhone, PC) melalui LAN dengan progress bar
- **Pengindeksan Cerdas** — Pemantauan file otomatis dengan semantic vector search
- **Metadata Lengkap** — Mengekstrak durasi, artis, album, dimensi, jumlah halaman dari file

### Antarmuka
- **Desain Native macOS** — Tema terang dengan font sistem Apple, sidebar kaca buram, navigasi gaya iOS
- **Responsif** — Sidebar desktop + navigasi bawah mobile, dioptimalkan untuk iPhone
- **10 Bahasa** — English, 繁體中文, 简体中文, Français, Español, 日本語, 한국어, ไทย, Nederlands, Bahasa Indonesia — terdeteksi otomatis dari pengaturan browser/OS
- **Antarmuka Suara** — Input suara push-to-talk (whisper.cpp) dan text-to-speech (Kokoro)
- **PWA** — Instal sebagai aplikasi mandiri dengan dukungan offline

## Tumpukan Teknologi

| Lapisan | Teknologi |
|---------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Server | [Hono](https://hono.dev) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| LLM | OpenAI-compatible API (default: Gemini 2.5 Flash) atau [Ollama](https://ollama.com) |
| Embeddings | Gemini Embedding atau Ollama (nomic-embed-text) |
| Vector DB | [LanceDB](https://lancedb.com) |
| Database | SQLite (bun:sqlite) |
| i18n | react-i18next (10 bahasa) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## Mulai Cepat

### Prasyarat

- macOS dengan Apple Silicon (M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org) (untuk streaming video dan thumbnail)
- API key LLM (mis. [Google AI Studio](https://aistudio.google.com) untuk Gemini — gratis) **atau** [Ollama](https://ollama.com) untuk inferensi lokal sepenuhnya

### 1. Clone dan instal

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. Konfigurasi lingkungan

```bash
cp .env.example .env
# Edit .env — set LLM_API_KEY dan WATCH_DIRS minimal
```

Lihat [Konfigurasi LLM Provider](#konfigurasi-llm-provider) di bawah untuk detailnya.

### 3. (Opsional) Gunakan Ollama untuk inferensi lokal

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

Kemudian set `LLM_PROVIDER=ollama` dan `EMBED_PROVIDER=ollama` di `.env`.

### 4. (Opsional) Siapkan fitur suara

```bash
bash scripts/setup-models.sh
```

### 5. Jalankan

```bash
# Mulai server + client (hot reload)
bun run dev

# Mulai indexer worker (di terminal terpisah)
bun run dev:indexer

# Atau jalankan komponen secara terpisah
bun run dev:server   # API di port 8000
bun run dev:client   # Vite dev server di port 5173
```

> **Penting:** Indexer worker harus berjalan agar file yang diunggah/dipantau dapat diindeks dan dicari.

### 6. Akses

- **Desktop:** Buka [http://localhost:5173](http://localhost:5173)
- **iPhone/Mobile:** Buka `http://<IP Mac Anda>:5173` (mis. `http://192.168.1.108:5173`)
- **Unggah file:** Gunakan halaman Upload atau AirDrop ke Mac Anda

### 7. Build untuk produksi

```bash
bun run build        # Build client
bun run dev:server   # Sajikan semuanya di port 8000
```

## Struktur Proyek

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono API server
│   │   ├── agent/            # ReAct loop, tools, system prompt
│   │   ├── routes/           # REST API endpoints
│   │   ├── services/         # DB, LanceDB, indexer, search, HLS, providers
│   │   │   └── providers/    # Abstraksi LLM/embedding provider
│   │   ├── middleware/       # Autentikasi
│   │   └── workers/          # Background indexer worker
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # Chat, Conversations, Recent, Media, Upload, Settings
│   │   ├── src/hooks/        # useSSE, usePlayback, useOnlineStatus
│   │   ├── src/components/   # Komponen UI + renderer
│   │   └── src/locales/      # File terjemahan i18n (10 bahasa)
│   └── shared/               # Tipe TypeScript bersama
├── e2e/                      # Pengujian end-to-end Playwright
├── docs/                     # Spesifikasi dan rencana implementasi
├── docker/                   # Docker Compose (Ollama)
├── scripts/                  # Script setup (model suara, pembuatan ikon)
└── data/                     # Data runtime (SQLite, LanceDB, thumbs, HLS cache)
```

## API Endpoints

| Method | Path | Auth | Deskripsi |
|--------|------|:----:|-----------|
| POST | `/api/chat` | Ya | Chat dengan AI agent (SSE stream) |
| POST | `/api/upload` | Ya | Unggah file (multipart/form-data) |
| GET | `/api/files` | Ya | Daftar file dengan filter dan paginasi |
| GET | `/api/file/:id` | Ya | Sajikan file (mendukung Range requests) |
| GET | `/api/file/:id/preview` | Ya | Pratinjau dokumen (DOCX/XLSX → HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | Tidak | HLS video playlist |
| GET | `/api/stream/:id/:segment` | Tidak | HLS video segment |
| GET | `/api/thumb/:id` | Tidak | Thumbnail file (WebP) |
| GET/POST | `/api/playlists` | Ya | Playlist CRUD |
| GET/PUT/DELETE | `/api/conversations` | Ya | Conversation CRUD (hapus tunggal + massal) |
| GET/PUT | `/api/settings` | Ya | Manajemen pengaturan |
| POST | `/api/settings/test-connection` | Ya | Uji koneksi LLM/embedding provider |
| POST | `/api/stt` | Ya | Speech-to-text |
| POST | `/api/tts` | Ya | Text-to-speech |
| GET | `/api/health` | Tidak | Pemeriksaan kesehatan sistem |

## Alat Agent

AI agent memiliki akses ke alat-alat ini melalui function calling:

| Alat | Deskripsi |
|------|-----------|
| `search_files` | Hybrid search (vector + keyword) dengan filter jenis/tanggal |
| `play_media` | Stream file video atau audio |
| `open_document` | Pratinjau dokumen (PDF, DOCX, XLSX, PPTX) |
| `list_recent` | Jelajahi file yang baru-baru ini dimodifikasi |
| `get_file_info` | Dapatkan metadata dan detail file |
| `create_playlist` | Buat playlist dengan opsi pengisian otomatis dari pencarian |
| `list_directory` | Jelajahi file di folder tertentu |
| `get_disk_status` | Periksa penggunaan disk dan statistik file |
| `organize_files` | Atur file ke dalam subfolder berdasarkan jenis atau tanggal |
| `batch_rename` | Ubah nama file yang cocok dengan pola regex (pratinjau dry-run) |
| `airdrop_control` | Aktifkan/nonaktifkan AirDrop, periksa status |

## Pengujian

```bash
# API & unit tests (192 tests)
cd packages/server
bun test
bun test --watch

# E2E browser tests (38 tests, Playwright + Chromium)
bunx playwright test
```

> Setup pertama kali: `bun add -d @playwright/test && bunx playwright install chromium`

## Konfigurasi LLM Provider

Magpie mendukung beberapa LLM provider melalui antarmuka OpenAI-compatible API. **Provider default adalah Gemini 2.5 Flash** melalui endpoint OpenAI-compatible Google. Ollama didukung sebagai opsi lokal sepenuhnya.

Model chat dan embedding dapat dikonfigurasi **secara independen**. Konfigurasi melalui `.env` atau **halaman Settings** di UI.

### Menggunakan Gemini (default)

Dapatkan API key gratis dari [Google AI Studio](https://aistudio.google.com):

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

### Menggunakan provider OpenAI-compatible mana pun

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Bekerja dengan OpenAI, Groq, OpenRouter, Together, dan endpoint OpenAI-compatible mana pun.

### Menggunakan Ollama (lokal sepenuhnya)

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## Variabel Lingkungan

### LLM (chat model)

| Variabel | Default | Deskripsi |
|----------|---------|-----------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` atau `ollama` |
| `LLM_API_KEY` | — | API key untuk chat provider |
| `LLM_BASE_URL` | Gemini endpoint | OpenAI-compatible base URL |
| `LLM_MODEL` | `gemini-2.5-flash` | Nama chat model |

### Embedding model

| Variabel | Default | Deskripsi |
|----------|---------|-----------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` atau `ollama` |
| `EMBED_API_KEY` | — | API key untuk embedding provider |
| `EMBED_BASE_URL` | Gemini endpoint | OpenAI-compatible base URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | Nama embedding model |

### Ollama

| Variabel | Default | Deskripsi |
|----------|---------|-----------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama chat model |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |

### Umum

| Variabel | Default | Deskripsi |
|----------|---------|-----------|
| `DATA_DIR` | `./data` | Direktori penyimpanan data |
| `API_SECRET` | `magpie-dev` | Token autentikasi API |
| `PORT` | `8000` | Port server |
| `WATCH_DIRS` | — | Jalur yang dipisahkan koma untuk dipantau dan diindeks |

## Lisensi

Copyright 2026 Plusblocks Technology Ltd.
