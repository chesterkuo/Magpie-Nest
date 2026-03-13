# Magpie — 本地 AI 儲存代理

> 用自然語言管理、搜尋、播放所有數位檔案 — 100% 本地運行，零雲端依賴。

[English](./README.md)

## Magpie 是什麼？

Magpie 是一套完全運行於 Mac Mini 本地端的 AI 儲存代理。透過單一 Web App 介面，你可以用自然語言與 AI 助理對話，管理所有個人數位資產——文件、影片、音樂、圖片——找檔案、播影片、開文件、整理資料，全在一個 App 中完成。

**不上雲、不訂閱、資料永遠不離開你的設備。**

## 功能特色

- **自然語言搜尋** — 說「找上週做的簡報」就能找到檔案
- **媒體播放** — 內建影片串流（HLS）及音樂播放器，支援佇列、隨機、循環
- **文件預覽** — 直接在瀏覽器中檢視 PDF、DOCX、XLSX
- **智慧索引** — 自動監控資料夾變動，語義向量搜尋
- **語音介面** — 按住說話語音輸入（whisper.cpp）+ 語音朗讀回覆（Kokoro TTS）
- **播放清單** — 透過聊天或介面建立、管理音樂播放清單
- **PWA** — 可安裝為獨立應用程式，支援離線瀏覽
- **隱私優先** — 所有運算都在你的硬體上執行

## 技術架構

| 層級 | 技術 |
|------|------|
| 執行環境 | [Bun](https://bun.sh) |
| 伺服器 | [Hono](https://hono.dev) |
| 前端 | React 19 + Vite + TailwindCSS v4 |
| 大型語言模型 | [Ollama](https://ollama.com) + Qwen3 8B |
| 向量資料庫 | [LanceDB](https://lancedb.com) |
| 關聯式資料庫 | SQLite（bun:sqlite） |
| 語音轉文字 | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| 文字轉語音 | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## 快速開始

### 前置需求

- macOS + Apple Silicon（M1/M2/M4）
- [Bun](https://bun.sh) >= 1.0
- [Docker](https://docker.com)（僅供 Ollama 使用）
- [FFmpeg](https://ffmpeg.org)（媒體串流與縮圖產生）

### 1. 下載並安裝

```bash
git clone https://github.com/plusblocks/magpie.git
cd magpie
bun install
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env，設定 WATCH_DIRS（以逗號分隔要索引的路徑）
```

### 3. 啟動 Ollama

```bash
docker compose -f docker/compose.yml up -d
docker exec magpie-ollama ollama pull qwen3:8b
docker exec magpie-ollama ollama pull nomic-embed-text
```

### 4.（選用）設定語音功能

```bash
bash scripts/setup-models.sh
```

### 5. 啟動開發環境

```bash
# 開發模式（熱重載）
bun run dev

# 或分別啟動前後端
bun run dev:server   # API 服務 port 8000
bun run dev:client   # Vite 開發伺服器 port 5173
```

### 6. 建置正式版本

```bash
bun run build        # 建置前端
bun run dev:server   # 在 port 8000 提供所有服務
```

開啟瀏覽器前往 [http://localhost:8000](http://localhost:8000)。

## 專案結構

```
magpie/
├── packages/
│   ├── server/           # Bun + Hono API 伺服器
│   │   ├── agent/        # ReAct 迴圈、工具、系統提示
│   │   ├── routes/       # REST API 端點
│   │   ├── services/     # 資料庫、LanceDB、嵌入向量、索引器、HLS、STT、TTS
│   │   ├── middleware/   # 認證中介層
│   │   └── workers/      # 背景索引 Worker
│   ├── client/           # React 19 PWA
│   │   ├── src/routes/   # 聊天、近期檔案、媒體庫、設定頁面
│   │   ├── src/hooks/    # useSSE、usePlayback、useOnlineStatus
│   │   └── src/components/ # UI 元件 + 渲染器
│   └── shared/           # 共用 TypeScript 型別
├── docker/               # Docker Compose（Ollama）
├── scripts/              # 設定腳本（語音模型）
└── data/                 # 執行時資料（SQLite、LanceDB、縮圖、HLS 快取）
```

## API 端點

| 方法 | 路徑 | 認證 | 說明 |
|------|------|:----:|------|
| POST | `/api/chat` | 是 | 與 AI 代理對話（SSE 串流） |
| GET | `/api/files` | 是 | 檔案列表，支援篩選與分頁 |
| GET | `/api/file/:id` | 是 | 取得檔案（支援 Range 請求） |
| GET | `/api/file/:id/preview` | 是 | 文件預覽（DOCX/XLSX 轉 HTML） |
| GET | `/api/stream/:id/playlist.m3u8` | 是 | HLS 影片播放清單 |
| GET | `/api/thumb/:id` | 是 | 檔案縮圖（WebP） |
| GET/POST | `/api/playlists` | 是 | 播放清單 CRUD |
| GET/PUT | `/api/conversations/:id` | 是 | 對話紀錄持久化 |
| GET/PUT | `/api/settings` | 是 | 設定管理 |
| POST | `/api/stt` | 是 | 語音轉文字 |
| POST | `/api/tts` | 是 | 文字轉語音 |
| GET | `/api/health` | 否 | 系統健康檢查 |

## AI 代理工具

AI 代理透過 Function Calling 可使用以下工具：

- `search_files` — 語義向量搜尋所有已索引檔案
- `play_media` — 串流播放影片或音樂
- `open_document` — 預覽文件（PDF、DOCX、XLSX）
- `list_recent` — 瀏覽最近修改的檔案
- `get_file_info` — 取得檔案元資料與詳細資訊
- `create_playlist` — 建立播放清單，可自動從搜尋結果填入
- `list_directory` — 瀏覽指定資料夾的檔案
- `get_disk_status` — 查看磁碟使用量與檔案統計

## 測試

```bash
cd packages/server
bun test              # 執行全部 127 項測試
bun test --watch      # 監聽模式
```

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API 位址 |
| `OLLAMA_MODEL` | `qwen3:8b` | 聊天模型 |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | 嵌入向量模型 |
| `DATA_DIR` | `./data` | 資料儲存目錄 |
| `API_SECRET` | `magpie-dev` | API 認證令牌 |
| `PORT` | `8000` | 伺服器埠號 |
| `WATCH_DIRS` | _（空）_ | 以逗號分隔要監控並索引的路徑 |

## 授權

Copyright 2026 Plusblocks Technology Ltd.
