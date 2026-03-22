# Magpie — 本地 AI 儲存代理

> 用自然語言管理、搜尋、播放所有數位檔案 — 100% 本地運行，零雲端依賴。

[English](./README.md)

## Magpie 是什麼？

Magpie 是一套完全運行於 Mac Mini 本地端的 AI 儲存代理。透過單一 Web App 介面，你可以用自然語言與 AI 助理對話，管理所有個人數位資產——文件、影片、音樂、圖片——找檔案、播影片、開文件、整理資料，全在一個 App 中完成。

**不上雲、不訂閱、資料永遠不離開你的設備。**

## 功能特色

- **自然語言搜尋** — 說「找上週做的簡報」就能找到檔案，採用混合搜尋（向量 + 關鍵字重排序）
- **媒體播放** — 內建影片串流（HLS）附時長顯示，音樂播放器顯示歌手/專輯，支援佇列、隨機、循環
- **文件預覽** — 直接在瀏覽器中檢視 PDF（支援全螢幕）、DOCX、XLSX、PPTX
- **智慧索引** — 自動監控資料夾變動（30 秒防抖），語義向量搜尋，日期標記切片
- **檔案整理** — AI 驅動的檔案分類（依類型/日期）及批次重新命名（正則表達式）
- **語音介面** — 按住說話語音輸入（whisper.cpp）+ 語音朗讀回覆（Kokoro TTS）
- **對話歷史** — 多輪對話，持久化對話記錄
- **播放清單** — 透過聊天或介面建立、管理音樂播放清單
- **豐富元資料** — 自動提取影音時長、歌手、專輯、圖片尺寸等資訊
- **PWA** — 可安裝為獨立應用程式，支援離線瀏覽
- **隱私優先** — 所有運算都在你的硬體上執行

## 技術架構

| 層級 | 技術 |
|------|------|
| 執行環境 | [Bun](https://bun.sh) |
| 伺服器 | [Hono](https://hono.dev) |
| 前端 | React 19 + Vite + TailwindCSS v4 |
| 大型語言模型 | OpenAI 相容 API（預設：Gemini）或 [Ollama](https://ollama.com) 本地推理 |
| 向量資料庫 | [LanceDB](https://lancedb.com) |
| 關聯式資料庫 | SQLite（bun:sqlite） |
| 語音轉文字 | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| 文字轉語音 | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## 快速開始

### 前置需求

- macOS + Apple Silicon（M1/M2/M4）
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org)（媒體串流與縮圖產生）
- LLM API 金鑰（例如 Google AI Studio 的 Gemini）**或** [Ollama](https://ollama.com) 進行完全本地推理
- [Docker](https://docker.com) _（選用 — 僅在你想以容器方式執行 Ollama 時需要）_

### 1. 下載並安裝

```bash
git clone https://github.com/plusblocks/magpie.git
cd magpie
bun install
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env — 至少需設定 LLM_API_KEY 與 WATCH_DIRS
```

請參閱下方的 [LLM 供應商設定](#llm-供應商設定) 了解如何設定你偏好的 LLM 供應商。

### 3.（選用）使用 Ollama 進行本地推理

如果你偏好完全本地推理而非外部 API，請安裝 Ollama 並拉取模型：

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

然後在 `.env` 中設定 `LLM_PROVIDER=ollama` 與 `EMBED_PROVIDER=ollama`。

> **Docker 替代方案：** 若你偏好以容器方式執行 Ollama，可使用 `docker compose -f docker/compose.yml up -d`，並透過 `docker exec magpie-ollama ollama pull <model>` 拉取模型。

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
│   │   ├── services/     # 資料庫、LanceDB、嵌入向量、索引器、搜尋、HLS、STT、TTS
│   │   ├── middleware/   # 認證中介層
│   │   └── workers/      # 背景索引 Worker
│   ├── client/           # React 19 PWA
│   │   ├── src/routes/   # 聊天、對話列表、近期檔案、媒體庫、設定頁面
│   │   ├── src/hooks/    # useSSE、usePlayback、useOnlineStatus
│   │   └── src/components/ # UI 元件 + 渲染器
│   └── shared/           # 共用 TypeScript 型別
├── e2e/                  # Playwright 端對端測試
├── docker/               # Docker Compose（Ollama）
├── scripts/              # 設定腳本（語音模型、圖示產生）
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

- `search_files` — 混合搜尋（向量 + 關鍵字）所有已索引檔案，支援類型/日期篩選
- `play_media` — 串流播放影片或音樂
- `open_document` — 預覽文件（PDF、DOCX、XLSX、PPTX）
- `list_recent` — 瀏覽最近修改的檔案
- `get_file_info` — 取得檔案元資料與詳細資訊
- `create_playlist` — 建立播放清單，可自動從搜尋結果填入
- `list_directory` — 瀏覽指定資料夾的檔案
- `get_disk_status` — 查看磁碟使用量與檔案統計
- `organize_files` — 將檔案依類型或日期整理至子資料夾
- `batch_rename` — 用正則表達式批次重新命名檔案（支援預覽模式）

## 測試

```bash
# API 與單元測試（165 項測試）
cd packages/server
bun test
bun test --watch      # 監聽模式

# E2E 瀏覽器測試（38 項測試，Playwright + Chromium）
bunx playwright test
```

> 首次設定：`bun add -d @playwright/test && bunx playwright install chromium && sudo bunx playwright install-deps chromium`

## LLM 供應商設定

Magpie 透過 OpenAI 相容 API 介面支援多種 LLM 供應商。**預設供應商為 Gemini**，使用 Google 的 OpenAI 相容端點。Ollama 仍作為完全本地運行的選項繼續支援。

聊天模型與嵌入向量模型可以獨立設定 — 例如，你可以使用 Gemini 進行聊天，同時使用本地 Ollama 模型產生嵌入向量，或任意組合。

設定可透過 `.env` 中的環境變數設定，**也可以**在執行時透過 UI 的**設定頁面**調整。

### 使用 Gemini（預設）

從 [Google AI Studio](https://aistudio.google.com) 取得免費 API 金鑰，然後在 `.env` 中設定：

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=你的-google-api-金鑰
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.5-flash

EMBED_PROVIDER=openai-compatible
EMBED_API_KEY=你的-google-api-金鑰
EMBED_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
EMBED_MODEL=gemini-embedding-2-preview
```

### 使用任何 OpenAI 相容供應商

設定 `LLM_PROVIDER=openai-compatible` 並將 `LLM_BASE_URL` 指向任何 OpenAI 相容端點（OpenAI、Groq、OpenRouter 等）：

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=你的-api-金鑰
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### 使用 Ollama（完全本地）

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## 環境變數

### LLM（聊天模型）

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `LLM_PROVIDER` | `openai-compatible` | 供應商：`openai-compatible` 或 `ollama` |
| `LLM_API_KEY` | _（空）_ | 聊天 LLM 供應商的 API 金鑰 |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | OpenAI 相容聊天端點的基礎 URL |
| `LLM_MODEL` | `gemini-2.5-flash` | 聊天模型名稱 |

### 嵌入向量模型

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `EMBED_PROVIDER` | `openai-compatible` | 供應商：`openai-compatible` 或 `ollama` |
| `EMBED_API_KEY` | _（空）_ | 嵌入向量供應商的 API 金鑰 |
| `EMBED_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | OpenAI 相容嵌入向量端點的基礎 URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | 嵌入向量模型名稱 |

### Ollama（供應商設為 `ollama` 時使用）

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API 位址 |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama 聊天模型 |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama 嵌入向量模型 |

### 一般設定

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DATA_DIR` | `./data` | 資料儲存目錄 |
| `API_SECRET` | `magpie-dev` | API 認證令牌 |
| `PORT` | `8000` | 伺服器埠號 |
| `WATCH_DIRS` | _（空）_ | 以逗號分隔要監控並索引的路徑 |

## 授權

Copyright 2026 Plusblocks Technology Ltd.
