# Magpie — AI 原生 NAS 與儲存代理

> 你的個人 AI 儲存助理 — 用自然語言管理、搜尋、播放及整理檔案。100% 在本機執行。

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Magpie 是什麼？

Magpie 是一套 **AI 原生的 NAS／儲存代理**，能將你的 Mac Mini（或任何 Mac）變成一台智慧型檔案伺服器。透過單一 Web App，你可以從任何裝置（iPhone、iPad、PC）連線，並與一位理解你的檔案的 AI 助理對話，用日常語言來搜尋、播放、整理及上傳檔案。

把它想像成一個自架、AI 驅動的雲端儲存替代方案 — 兼具個人助理的智慧。

**不上雲、不訂閱、資料永遠不離開你的裝置。**

## 功能特色

### AI 代理
- **自然語言搜尋** — 說「找上週做的簡報」就能找到檔案，採用混合搜尋（向量 + 關鍵字重排序）
- **檔案整理** — AI 驅動工具，可依類型／日期整理檔案並以正則表達式批次重新命名
- **AirDrop 控制** — 透過對話指令啟用／停用 Mac 上的 AirDrop
- **多輪對話** — 持久化對話記錄，支援日期分組顯示及批次刪除

### 媒體
- **影片串流** — 內建 HLS 串流，支援按需轉碼及縮圖產生
- **音樂播放器** — 顯示歌手／專輯，支援佇列、隨機播放、循環及音量控制
- **文件預覽** — 直接在瀏覽器中檢視 PDF（支援全螢幕）、DOCX、XLSX、PPTX
- **圖片圖庫** — 格狀顯示並支援燈箱導覽

### 儲存
- **檔案上傳** — 透過 LAN 從任何裝置（iPhone、PC）拖放上傳，附進度條
- **智慧索引** — 自動監控檔案變動，支援語義向量搜尋
- **豐富元資料** — 自動提取影音時長、歌手、專輯、圖片尺寸、頁數等資訊

### 介面
- **macOS 原生設計** — 淺色主題，使用 Apple 系統字型、毛玻璃側欄及 iOS 風格導覽
- **響應式** — 桌面側欄 + 手機底部導覽列，針對 iPhone 優化
- **10 種語言** — English、繁體中文、简体中文、Français、Español、日本語、한국어、ไทย、Nederlands、Bahasa Indonesia — 自動偵測瀏覽器／系統設定
- **語音介面** — 按住說話語音輸入（whisper.cpp）+ 文字轉語音（Kokoro）
- **PWA** — 可安裝為獨立應用程式，支援離線瀏覽

## 技術架構

| 層級 | 技術 |
|------|------|
| 執行環境 | [Bun](https://bun.sh) |
| 伺服器 | [Hono](https://hono.dev) |
| 前端 | React 19 + Vite + Tailwind CSS 4 |
| 大型語言模型 | OpenAI 相容 API（預設：Gemini 2.5 Flash）或 [Ollama](https://ollama.com) 本地推理 |
| 嵌入向量 | Gemini Embedding 或 Ollama（nomic-embed-text） |
| 向量資料庫 | [LanceDB](https://lancedb.com) |
| 關聯式資料庫 | SQLite（bun:sqlite） |
| 國際化 | react-i18next（10 種語言） |
| 語音轉文字 | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| 文字轉語音 | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## 快速開始

### 前置需求

- macOS + Apple Silicon（M1/M2/M4）
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org)（影片串流與縮圖產生）
- LLM API 金鑰（例如 [Google AI Studio](https://aistudio.google.com) 的 Gemini — 免費）**或** [Ollama](https://ollama.com) 進行完全本地推理

### 1. 下載並安裝

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env — 至少需設定 LLM_API_KEY 與 WATCH_DIRS
```

請參閱下方的 [LLM 供應商設定](#llm-供應商設定) 了解詳細說明。

### 3.（選用）使用 Ollama 進行本地推理

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

然後在 `.env` 中設定 `LLM_PROVIDER=ollama` 與 `EMBED_PROVIDER=ollama`。

### 4.（選用）設定語音功能

```bash
bash scripts/setup-models.sh
```

### 5. 啟動

```bash
# 啟動伺服器 + 用戶端（熱重載）
bun run dev

# 啟動索引器 Worker（在另一個終端機視窗）
bun run dev:indexer

# 或分別啟動各元件
bun run dev:server   # API 服務 port 8000
bun run dev:client   # Vite 開發伺服器 port 5173
```

> **重要：** 索引器 Worker 必須保持執行，上傳或監控的檔案才能被索引並可搜尋。

### 6. 開啟應用程式

- **桌面：** 開啟 [http://localhost:5173](http://localhost:5173)
- **iPhone／手機：** 開啟 `http://<你的-Mac-IP>:5173`（例如 `http://192.168.1.108:5173`）
- **上傳檔案：** 使用上傳頁面，或透過 AirDrop 傳到你的 Mac

### 7. 建置正式版本

```bash
bun run build        # 建置前端
bun run dev:server   # 在 port 8000 提供所有服務
```

## 專案結構

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono API 伺服器
│   │   ├── agent/            # ReAct 迴圈、工具、系統提示
│   │   ├── routes/           # REST API 端點
│   │   ├── services/         # 資料庫、LanceDB、索引器、搜尋、HLS、供應商
│   │   │   └── providers/    # LLM／嵌入向量供應商抽象層
│   │   ├── middleware/       # 認證中介層
│   │   └── workers/          # 背景索引 Worker
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # 聊天、對話列表、近期檔案、媒體庫、上傳、設定
│   │   ├── src/hooks/        # useSSE、usePlayback、useOnlineStatus
│   │   ├── src/components/   # UI 元件 + 渲染器
│   │   └── src/locales/      # i18n 翻譯檔案（10 種語言）
│   └── shared/               # 共用 TypeScript 型別
├── e2e/                      # Playwright 端對端測試
├── docs/                     # 規格與實作計畫
├── docker/                   # Docker Compose（Ollama）
├── scripts/                  # 設定腳本（語音模型、圖示產生）
└── data/                     # 執行時資料（SQLite、LanceDB、縮圖、HLS 快取）
```

## API 端點

| 方法 | 路徑 | 認證 | 說明 |
|------|------|:----:|------|
| POST | `/api/chat` | 是 | 與 AI 代理對話（SSE 串流） |
| POST | `/api/upload` | 是 | 上傳檔案（multipart/form-data） |
| GET | `/api/files` | 是 | 檔案列表，支援篩選與分頁 |
| GET | `/api/file/:id` | 是 | 取得檔案（支援 Range 請求） |
| GET | `/api/file/:id/preview` | 是 | 文件預覽（DOCX/XLSX 轉 HTML） |
| GET | `/api/stream/:id/playlist.m3u8` | 否 | HLS 影片播放清單 |
| GET | `/api/stream/:id/:segment` | 否 | HLS 影片片段 |
| GET | `/api/thumb/:id` | 否 | 檔案縮圖（WebP） |
| GET/POST | `/api/playlists` | 是 | 播放清單 CRUD |
| GET/PUT/DELETE | `/api/conversations` | 是 | 對話紀錄 CRUD（單筆 + 批次刪除） |
| GET/PUT | `/api/settings` | 是 | 設定管理 |
| POST | `/api/settings/test-connection` | 是 | 測試 LLM／嵌入向量供應商連線 |
| POST | `/api/stt` | 是 | 語音轉文字 |
| POST | `/api/tts` | 是 | 文字轉語音 |
| GET | `/api/health` | 否 | 系統健康檢查 |

## AI 代理工具

AI 代理透過 Function Calling 可使用以下工具：

| 工具 | 說明 |
|------|------|
| `search_files` | 混合搜尋（向量 + 關鍵字），支援類型／日期篩選 |
| `play_media` | 串流播放影片或音樂 |
| `open_document` | 預覽文件（PDF、DOCX、XLSX、PPTX） |
| `list_recent` | 瀏覽最近修改的檔案 |
| `get_file_info` | 取得檔案元資料與詳細資訊 |
| `create_playlist` | 建立播放清單，可自動從搜尋結果填入 |
| `list_directory` | 瀏覽指定資料夾的檔案 |
| `get_disk_status` | 查看磁碟使用量與檔案統計 |
| `organize_files` | 將檔案依類型或日期整理至子資料夾 |
| `batch_rename` | 用正則表達式批次重新命名檔案（支援預覽模式） |
| `airdrop_control` | 啟用／停用 AirDrop，查看狀態 |

## 測試

```bash
# API 與單元測試（192 項測試）
cd packages/server
bun test
bun test --watch

# E2E 瀏覽器測試（38 項測試，Playwright + Chromium）
bunx playwright test
```

> 首次設定：`bun add -d @playwright/test && bunx playwright install chromium`

## LLM 供應商設定

Magpie 透過 OpenAI 相容 API 介面支援多種 LLM 供應商。**預設供應商為 Gemini 2.5 Flash**，使用 Google 的 OpenAI 相容端點。Ollama 作為完全本地執行的選項亦受到支援。

聊天模型與嵌入向量模型可以**獨立設定**。設定可透過 `.env` 或 UI 的**設定頁面**進行。

### 使用 Gemini（預設）

從 [Google AI Studio](https://aistudio.google.com) 取得免費 API 金鑰：

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

### 使用任何 OpenAI 相容供應商

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

適用於 OpenAI、Groq、OpenRouter、Together 及任何 OpenAI 相容端點。

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
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` 或 `ollama` |
| `LLM_API_KEY` | — | 聊天供應商的 API 金鑰 |
| `LLM_BASE_URL` | Gemini 端點 | OpenAI 相容聊天端點的基礎 URL |
| `LLM_MODEL` | `gemini-2.5-flash` | 聊天模型名稱 |

### 嵌入向量模型

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` 或 `ollama` |
| `EMBED_API_KEY` | — | 嵌入向量供應商的 API 金鑰 |
| `EMBED_BASE_URL` | Gemini 端點 | OpenAI 相容嵌入向量端點的基礎 URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | 嵌入向量模型名稱 |

### Ollama

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
| `WATCH_DIRS` | — | 以逗號分隔要監控並索引的路徑 |

## 授權

Copyright 2026 Plusblocks Technology Ltd.
