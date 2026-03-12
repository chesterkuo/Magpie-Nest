# Magpie — 產品需求文件（PRD）

> **AI Storage Agent for Your Digital Life**
> Version 1.0 · March 2026 · Plusblocks Technology Ltd.

| 欄位 | 內容 |
|------|------|
| 產品名稱 | Magpie — Local AI Storage Agent |
| 版本 | v1.0 MVP |
| 日期 | March 2026 |
| 作者 | Plusblocks Technology Ltd. |
| 目標硬體 | Apple Mac Mini M4 / M5（16GB+） |
| 部署模式 | 全本地離線，Zero Cloud Dependency |

---

## 目錄

1. [產品概覽](#1-產品概覽)
2. [技術架構](#2-技術架構)
3. [功能需求](#3-功能需求)
4. [API 設計](#4-api-設計)
5. [前端介面設計](#5-前端介面設計)
6. [系統資源分配](#6-系統資源分配)
7. [實施里程碑](#7-實施里程碑)
8. [風險評估](#8-風險評估)
9. [附錄](#9-附錄)

---

## 1. 產品概覽

### 1.1 產品願景

Magpie 是一套運行於 Mac Mini 本地端的 **AI 個人儲存代理（AI Storage Agent）**。透過單一 React Web App 介面，使用者以自然語言對話的方式管理、搜尋、播放所有個人數位資產——文件、影片、音樂、圖片——無需任何雲端依賴，資料永遠不離開自己的設備。

> 💡 **核心理念**
>
> 讓 LLM 成為唯一大腦，Tool Calling 作為手腳，React Web App 作為統一入口。使用者只需開口說話，Magpie 就能理解並執行——找檔案、播影片、開文件、整理資料夾，全在一個 App 中完成。

### 1.2 目標使用者

| 用戶類型 | 需求痛點 | Magpie 解決方案 |
|---------|---------|---------------|
| 個人用戶 | 檔案散落各處，找不到舊文件 | 自然語言搜尋，秒找目標 |
| 家庭用戶 | 影片照片管理混亂，無統一平台 | 自動分類媒體庫，一個 App 播放 |
| 創作者 | 素材龐大，難以快速查找 | 語義搜尋 + AI 自動標籤 |
| 科技愛好者 | 重視隱私，不想資料上雲 | 100% 本地運行，Zero Cloud |

### 1.3 競品對比

| 功能 | Magpie | Kickstarter Friday | Jellyfin + 多 App | Nextcloud |
|-----|:---------:|:-----------------:|:----------------:|:---------:|
| 統一單一介面 | ✅ | ✅ | ❌ | ⚠️ |
| 自然語言搜尋 | ✅ | ✅ | ❌ | ❌ |
| 完全本地離線 | ✅ | ✅ | ✅ | ✅ |
| 語音對話 | ✅ | ✅ | ❌ | ❌ |
| 開源可自建 | ✅ | ❌ | ✅ | ✅ |
| 費用 | 硬體一次性 | 訂閱制 | 免費 | 免費 |

---

## 2. 技術架構

### 2.1 目標硬體規格

| 規格 | MVP 推薦（入門） | 理想配置 |
|------|--------------|---------|
| 機器 | Mac Mini M4 16GB 256GB | Mac Mini M4 24GB 512GB |
| 外接儲存 | 外接 HDD 4TB（媒體）+ 外接 SSD 1TB（索引） | 外接 SSD 2TB NVMe + HDD 8TB |
| 記憶體頻寬 | 120 GB/s | 120–273 GB/s（M4 Pro） |
| LLM 推論速度 | Qwen3 8B @ ~25-35 tok/s | Qwen3 14B @ ~15-20 tok/s |
| 作業系統 | macOS 15 Sequoia（原機） | macOS 15 + Docker Desktop |
| 網路 | 區域網路 Wi-Fi 6E | Gigabit Ethernet + Tailscale VPN |

### 2.2 系統分層架構

```
┌──────────────────────────────────────────────────────────────┐
│  L6  使用者介面層                                               │
│       React PWA / Web App                                     │
│       統一入口：AI 對話 + 媒體播放 + 檔案管理                    │
├──────────────────────────────────────────────────────────────┤
│  L5  AI 推論層                                                 │
│       Ollama + Qwen3 8B · whisper.cpp (STT) · Kokoro TTS     │
├──────────────────────────────────────────────────────────────┤
│  L4  Agent 協調層                                              │
│       Bun + Hono API Server · Tool Registry · ReAct Loop     │
├──────────────────────────────────────────────────────────────┤
│  L3  語義搜尋層                                                 │
│       LanceDB · nomic-embed-text · LlamaIndex.TS             │
├──────────────────────────────────────────────────────────────┤
│  L2  檔案索引層                                                 │
│       Apache Tika · ExifTool · FFprobe · Python watchdog     │
├──────────────────────────────────────────────────────────────┤
│  L1  基礎設施層                                                 │
│       Docker Compose · SMB (Samba) · Tailscale VPN           │
│       Mac Mini M4 · 外接 HDD/SSD                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 核心技術選型

| 類別 | 選用技術 | 替代方案 | 選擇理由 |
|------|---------|---------|---------|
| 後端框架 | **Bun + Hono + TypeScript** | FastAPI (Python) | 符合 TS 技術棧，檔案 I/O 極快 |
| LLM 引擎 | **Ollama + Qwen3 8B (Q4_K_M)** | MLX-LM | TS SDK 完整，Tool Calling 支援好 |
| 嵌入模型 | **nomic-embed-text-v1.5** | e5-small | 1024 維，8192 上下文，Ollama 原生 |
| 向量資料庫 | **LanceDB (@lancedb/lancedb)** | ChromaDB, Qdrant | 磁碟導向，幾乎不佔 RAM |
| STT | **whisper.cpp (base.en)** | faster-whisper | Docker 部署，~500MB RAM |
| TTS | **Kokoro-82M (FastAPI)** | Piper TTS | 82M 參數，CPU 100-300ms |
| 前端 | **React + Vite + TailwindCSS (PWA)** | Next.js | 加入主畫面 = 原生 App 體驗 |
| 影片串流 | **HLS（FFmpeg 轉封裝）** | Range Request | 手機原生 HLS 播放，支援 seek |
| 文件提取 | **Apache Tika (Docker)** | Python 原生庫 | 1000+ 格式支援 |
| 外網連線 | **Tailscale VPN** | WireGuard 手動配置 | 零配置 P2P，跨網路存取 |

---

## 3. 功能需求

### 3.1 功能模組總覽

| # | 模組名稱 | 核心功能 | 優先級 | 里程碑 |
|---|---------|---------|:-----:|:-----:|
| F1 | 自然語音對話 | 喚醒詞 → STT → LLM → TTS 完整管道 | P0 | MVP |
| F2 | 智慧檔案搜尋 | 自然語言查詢，向量語義搜尋，結果渲染 | P0 | MVP |
| F3 | 影音串流播放 | HLS 影片串流，音樂播放，手機直播 | P0 | MVP |
| F4 | 文件預覽 | PDF.js 線上預覽，Office 轉 PDF | P0 | MVP |
| F5 | 自動檔案索引 | watchdog 監控 → Tika 提取 → 向量嵌入 | P0 | MVP |
| F6 | 媒體自動分類 | 影片按類型/年份分類，音樂 ID3，照片 EXIF | P1 | Phase 2 |
| F7 | 主動防護與備份 | Borgmatic 排程備份，磁碟告警，去重掃描 | P1 | Phase 2 |
| F8 | 外網遠端存取 | Tailscale VPN 安全連線，出門在外也能用 | P1 | Phase 2 |
| F9 | AI 自動整理 | 自然語言下令整理資料夾，AI 建議分類 | P2 | Phase 3 |
| F10 | 多設備同步 | Syncthing 多裝置點對點同步 | P2 | Phase 3 |

---

### 3.2 F1 — 自然語音對話

**功能描述**

使用者可透過語音或文字與 Magpie 對話，系統理解意圖後透過 Tool Calling 執行對應操作，並以語音回應。

**使用流程**

1. 使用者說出喚醒詞（如「Hey Magpie」）或點擊麥克風按鈕
2. 手機收音 → 上傳音訊 → whisper.cpp 轉文字（~0.5-2 秒）
3. 文字送入 Ollama Qwen3 8B，LLM 決定呼叫哪個 Tool
4. Tool 執行完畢，LLM 組織回應文字（串流輸出）
5. Kokoro TTS 將文字轉語音（~100-300 ms），播放給使用者

**完整管道延遲估計**

| 環節 | 延遲 |
|------|------|
| 喚醒詞偵測 | ~10–50 ms |
| STT（base.en，5 秒語音） | 0.5–2 秒 |
| LLM 首 Token（Qwen3 8B） | ~1 秒 |
| TTS 合成首句（Kokoro） | 100–300 ms |
| **使用串流的感知延遲** | **~2–4 秒** |

**驗收標準**

- 語音識別準確率 ≥ 90%（普通話 / 英文）
- 完整對話往返延遲 ≤ 4 秒（區域網路環境）
- 支援中文、英文混合輸入
- 無喚醒詞時，支援直接文字輸入

---

### 3.3 F2 — 智慧檔案搜尋

**自然語言查詢範例**

| 使用者輸入 | 系統解析 | Tool 呼叫 |
|-----------|---------|---------|
| 找出去年所有合約文件 | 類型=PDF，關鍵字=合約，日期=2025 | `search_files({ type:"pdf", query:"合約", year:2025 })` |
| 播放上個月下載的科幻電影 | 類型=影片，關鍵字=科幻，日期=近30天 | `search_files + play_media` |
| 找一下那個關於行銷企劃的 PPT | 類型=PPTX，語義=行銷企劃 | `search_files({ type:"pptx", query:"行銷企劃" })` |
| 最近新增了什麼檔案？ | 時間=近7天，類型=任意 | `list_recent({ days:7 })` |

**搜尋結果渲染規則**

搜尋結果依檔案類型自動渲染對應 UI 元件：

- 影片 → `VideoCard`（縮圖 + 播放按鈕 + 時長）
- 音樂 → `AudioPlayer`（專輯封面 + 播放控制）
- PDF → `PDFPreview`（縮略圖 + 開啟按鈕）
- 圖片 → `ImageGrid`（縮圖網格）
- 其他文件 → `FileRow`（圖示 + 檔名 + 大小 + 日期）

---

### 3.4 F3 — 影音串流播放

**影片播放規格**

- 使用 HLS（HTTP Live Streaming）協定，支援手機原生播放
- 支援 Range Request，允許任意拖拽進度條
- 自動產生影片縮圖（FFmpeg 截取第 10 秒幀）
- 支援常見格式：MP4、MKV、AVI、MOV、WebM
- 區域網路：最高原始畫質；外網 Tailscale：自動降轉碼

**音樂播放規格**

- 支援 MP3、FLAC、AAC、WAV、OGG
- 自動讀取 ID3 標籤（歌名、藝人、專輯、封面）
- 支援播放清單、隨機播放、單曲循環

---

### 3.5 F5 — 自動檔案索引管道

索引管道在後台持續運行，監控所有指定目錄的新增 / 修改 / 刪除事件：

```
Python watchdog 監控目錄
  ↓ 新檔案偵測（防抖 30 秒）
  ↓
MIME 類型判斷（python-magic）
  ├── 文件（PDF/DOCX/XLSX/PPTX）→ Apache Tika 提取文字
  ├── 圖片（JPEG/PNG/HEIC）     → ExifTool（元資料）
  ├── 音訊（MP3/FLAC）           → ExifTool（ID3 標籤）
  └── 影片（MP4/MKV）            → ExifTool + FFprobe
  ↓
文本分塊：512-1024 字元，前綴元資料（檔名、路徑、日期）
  ↓
嵌入生成：nomic-embed-text via Ollama（768 維）
  ↓
寫入 LanceDB（向量）+ SQLite（檔案追蹤狀態）
```

| 步驟 | 元件 | 處理內容 | 輸出 |
|------|------|---------|------|
| 1 | Python watchdog | 監控目錄變更（防抖 30 秒） | 檔案事件 |
| 2 | MIME 判斷 | python-magic 判斷真實檔案類型 | 類型分類 |
| 3a | Apache Tika | 文件文字提取（PDF/DOCX/XLSX） | 純文字 |
| 3b | ExifTool | 圖片/影片/音訊元資料 | 結構化元資料 |
| 3c | FFprobe | 媒體技術規格 | 媒體技術資訊 |
| 4 | 文本分塊 | 512-1024 字元分塊 | 文本塊陣列 |
| 5 | nomic-embed-text | 生成 768 維向量嵌入 | 向量陣列 |
| 6 | LanceDB + SQLite | 寫入向量 + 更新追蹤狀態 | 索引完成 |

---

## 4. API 設計（Bun + Hono）

### 4.1 API 端點總覽

| 方法 | 端點 | 功能 | 回應類型 |
|------|------|------|---------|
| `POST` | `/api/chat` | 主要對話入口，接收訊息，觸發 Agent Loop | SSE 串流（AgentChunk[]） |
| `POST` | `/api/stt` | 語音轉文字（接收音訊 blob） | `JSON { text: string }` |
| `GET` | `/api/stream/:id` | HLS 影片 / 音訊串流（支援 Range Request） | Stream（video/* 或 audio/*） |
| `GET` | `/api/thumb/:id` | 檔案縮圖（影片截幀 / 文件首頁 / 圖片壓縮） | `image/webp` |
| `GET` | `/api/file/:id` | 下載或線上預覽原始檔案 | 原始 MIME Type |
| `GET` | `/api/health` | 服務健康狀態（Ollama、LanceDB、磁碟空間） | `JSON { status, services }` |
| `POST` | `/api/tts` | 文字轉語音（接收文字，回傳音訊） | `audio/mpeg` |

### 4.2 Agent Tool 清單

| Tool 名稱 | 功能描述 | 關鍵參數 | 優先級 |
|----------|---------|---------|:-----:|
| `search_files` | 語義搜尋所有本地檔案 | query, file_type, days_ago, limit | P0 |
| `play_media` | 播放影片或音樂，回傳串流 URL | file_id, media_type | P0 |
| `open_document` | 開啟文件，回傳預覽 URL | file_id | P0 |
| `list_recent` | 列出最近新增或存取的檔案 | days, file_type, limit | P0 |
| `get_file_info` | 取得特定檔案的詳細資訊與元資料 | file_id | P0 |
| `list_directory` | 瀏覽指定資料夾的內容 | path, sort_by, file_type | P1 |
| `organize_files` | 依規則自動整理資料夾 | source_path, rule | P1 |
| `get_disk_status` | 查詢磁碟用量、各類型檔案統計 | path | P1 |
| `create_playlist` | 依條件建立播放清單 | query, media_type, limit | P2 |
| `batch_rename` | 批次重新命名檔案 | file_ids[], pattern, preview | P2 |

### 4.3 共用型別定義（TypeScript）

```typescript
// types/shared.ts — 前後端共用

type RenderType =
  | 'video_card'
  | 'audio_player'
  | 'pdf_preview'
  | 'image_grid'
  | 'file_list'

interface FileItem {
  id:         string
  name:       string
  type:       'video' | 'audio' | 'pdf' | 'image' | 'doc'
  size:       number
  modified:   string
  renderType: RenderType
  streamUrl:  string
  thumbUrl:   string
}

interface AgentChunk {
  type:     'thinking' | 'text' | 'render' | 'error'
  content?: string      // type === 'text'
  tool?:    string      // type === 'thinking'
  items?:   FileItem[]  // type === 'render'
  message?: string      // type === 'error'
}
```

### 4.4 Agent ReAct Loop（核心邏輯）

```typescript
// server/agent/llm.ts
export async function* runAgent(userMessage: string) {
  const messages = [{ role: 'user', content: userMessage }]

  while (true) {
    const response = await ollama.chat({
      model: 'qwen3:8b',
      messages,
      tools,
      stream: false,
    })

    // LLM 決定呼叫 Tool
    if (response.message.tool_calls?.length) {
      for (const toolCall of response.message.tool_calls) {
        yield { type: 'thinking', tool: toolCall.function.name }

        const result = await toolRunner(
          toolCall.function.name,
          toolCall.function.arguments
        )
        messages.push(response.message)
        messages.push({ role: 'tool', content: JSON.stringify(result) })

        // 如果結果含檔案，直接推送 render chunk
        if (result.files?.length) {
          yield { type: 'render', items: result.files }
        }
      }
      continue
    }

    // LLM 產出最終回應（串流）
    const finalStream = await ollama.chat({
      model: 'qwen3:8b',
      messages,
      stream: true,
    })
    for await (const chunk of finalStream) {
      yield { type: 'text', content: chunk.message.content }
    }
    break
  }
}
```

---

## 5. 前端介面設計

### 5.1 App 結構

```
手機瀏覽器 → 加入主畫面 → PWA（等同原生 App）

┌─────────────────────────────┐
│  🎙️ [語音輸入]  [⌨️ 文字]    │  ← 頂部輸入列
├─────────────────────────────┤
│                             │
│  AI：找到 3 部科幻電影：       │
│  ┌────────────────────┐    │
│  │ 🎬 星際效應  2:49  ▶ │   │  ← VideoCard
│  │ 🎬 沙丘      2:35  ▶ │   │
│  │ 🎬 奧本海默  3:00  ▶ │   │
│  └────────────────────┘    │
│                             │
│  你：播放上個月的科幻電影      │  ← 使用者訊息
└─────────────────────────────┘
│ 首頁 │ 最近 │ 媒體庫 │ 設定 │   ← 底部導航
```

### 5.2 動態渲染元件

| RenderType | 元件 | 顯示內容 |
|-----------|------|---------|
| `video_card` | `<VideoCard>` | 影片縮圖 + 標題 + 時長 + ▶ 播放按鈕 |
| `audio_player` | `<AudioPlayer>` | 專輯封面 + 歌名 + 藝人 + 播放控制 |
| `pdf_preview` | `<PDFViewer>` | PDF.js 渲染首頁 + 展開全頁預覽 |
| `image_grid` | `<ImageGrid>` | 3 欄縮圖網格 + 點擊全螢幕 |
| `file_list` | `<FileList>` | 清單：圖示 + 檔名 + 大小 + 日期 |

```tsx
// 前端動態渲染邏輯
function RenderItem({ item }: { item: FileItem }) {
  switch (item.renderType) {
    case 'video_card':    return <VideoCard item={item} />
    case 'audio_player':  return <AudioPlayer item={item} />
    case 'pdf_preview':   return <PDFViewer item={item} />
    case 'image_grid':    return <ImageGrid item={item} />
    default:              return <FileRow item={item} />
  }
}
```

### 5.3 PWA 配置要求

- `manifest.json`：App 名稱、圖示（512x512）、顯示模式（`standalone`）
- Service Worker：快取靜態資源，支援離線存取介面
- HTTPS 或 localhost 環境（PWA 必要條件）
- 支援深色模式（`prefers-color-scheme: dark`）
- iOS Safari / Android Chrome 均可加入主畫面

---

## 6. 系統資源分配

### 6.1 Mac Mini M4 16GB RAM 分配計劃

| 服務 | RAM 上限 | 運行模式 | 備註 |
|------|:-------:|:-------:|------|
| macOS + Docker Engine | ~2.5 GB | 常駐 | 系統保留 |
| Bun + Hono API Server | 256 MB | 常駐 | 核心 Agent 服務 |
| LanceDB（嵌入式） | 200–500 MB | 常駐 | 磁碟導向，實際佔用極低 |
| SQLite（檔案索引） | ~50 MB | 常駐 | 輕量無伺服器資料庫 |
| React PWA 服務（Nginx） | ~64 MB | 常駐 | 靜態資源伺服 |
| Syncthing | 512 MB | 常駐 | 多設備同步 |
| **常駐小計** | **~3.5–4 GB** | | |
| Ollama + Qwen3 8B | ~5–6 GB | 按需啟動 | 語音 / 對話觸發時載入 |
| nomic-embed-text | ~800 MB | 索引時 | 與 Ollama 同進程 |
| whisper.cpp (base.en) | ~500 MB | 語音時 | STT 服務 |
| Kokoro TTS | ~300 MB | 語音時 | TTS 服務 |
| Apache Tika | ~1 GB | 索引時 | 批次索引後自動停止 |
| **按需服務小計（峰值）** | **~8–8.6 GB** | | |
| **總計（峰值）** | **~12–13 GB** | | 保留 ~3 GB 緩衝 |

> ⚠️ **核心設計原則**
>
> Apache Tika 和 Ollama **不同時運行**。透過 cron 排程在凌晨 2:00–4:00 執行批次索引，確保日常使用不受影響。設定 `OLLAMA_MAX_LOADED_MODELS=1`，避免同時載入多個模型。

### 6.2 外接儲存掛載策略

```
外接 HDD（大容量，媒體）：
  /mnt/external_hdd/media    → 影片、音樂庫（Jellyfin 可選）
  /mnt/external_hdd/photos   → 圖片相簿
  /mnt/external_hdd/backups  → Borgmatic 備份目的地
  /mnt/external_hdd/sync     → Syncthing 同步目錄

內建 SSD（高 IOPS，索引）：
  ~/friday/data/lancedb      → LanceDB 向量索引
  ~/friday/data/sqlite       → 檔案追蹤資料庫
  ~/friday/data/ollama       → 模型檔案
  ~/friday/data/thumbs       → 縮圖快取
```

---

## 7. 實施里程碑

### 7.1 三階段路線圖

| 階段 | 名稱 | 交付內容 | 時程 |
|:----:|------|---------|:----:|
| **MVP** | 核心 AI NAS | Ollama + API Server + LanceDB 索引 + React PWA + 影片串流 + PDF 預覽 + 基本語音對話 | 第 1–6 週 |
| **Phase 2** | 完整媒體中樞 | 媒體自動分類 + Tailscale 外網 + Borgmatic 備份 + Syncthing 同步 + 喚醒詞偵測 | 第 7–10 週 |
| **Phase 3** | 智能自動化 | AI 主動整理資料夾 + 批次重命名 + 播放清單生成 + 磁碟智能分析報告 | 第 11–14 週 |

### 7.2 MVP 詳細任務拆解（第 1–6 週）

#### Week 1–2：基礎設施

- [ ] 安裝 Docker Desktop for Mac，建立 Docker Compose 目錄結構
- [ ] 建立 Bun + Hono 專案骨架（TypeScript，前後端型別共用）
- [ ] 部署 Ollama，拉取 `qwen3:8b` 和 `nomic-embed-text` 模型
- [ ] 撰寫 Ollama Tool Calling 基礎封裝，驗證 LLM 能正確呼叫空 Tool
- [ ] 設定外接硬碟掛載、SMB 分享（Samba Docker）

#### Week 3–4：索引核心

- [ ] 部署 Apache Tika Docker，撰寫 REST API 呼叫封裝
- [ ] 實作 Python watchdog 檔案監控服務（Docker 容器）
- [ ] 實作完整索引管道：Tika → 分塊 → nomic-embed → LanceDB
- [ ] 實作 `search_files` Tool，驗證自然語言搜尋準確度
- [ ] SQLite 檔案追蹤資料庫（避免重複索引）

#### Week 5–6：影音與前端

- [ ] 實作 HLS 串流端點（FFmpeg 即時轉封裝）
- [ ] 實作縮圖生成服務（影片 / 圖片 / PDF 首頁）
- [ ] 建立 React PWA 基礎介面（對話框 + SSE 接收 + 動態渲染元件）
- [ ] 實作 STT（whisper.cpp）和 TTS（Kokoro）容器與 API
- [ ] 完整 E2E 測試：語音輸入 → 找到電影 → 手機直接播放

### 7.3 非功能性需求

| 類別 | 指標 | 目標值 |
|------|------|:------:|
| 回應延遲 | 語音對話完整往返（區域網路） | ≤ 4 秒 |
| 搜尋延遲 | 語義搜尋 10 萬文件 | ≤ 500 ms |
| STT 延遲 | 5 秒音訊轉文字 | ≤ 2 秒 |
| 影片串流 | 1080p 影片開始播放 | ≤ 3 秒（區域網路） |
| 索引吞吐 | 批次索引速度 | ≥ 100 文件 / 分鐘 |
| 可用性 | NAS 核心服務（非 AI） | 99.9% 正常運行 |
| 資料安全 | 所有資料儲存位置 | 100% 本地，零雲端傳輸 |
| 並發用戶 | 同時連線設備數 | MVP：1–3 台；Phase 2：5 台 |

---

## 8. 風險評估

| # | 風險描述 | 影響 | 機率 | 對策 |
|---|---------|:----:|:----:|------|
| R1 | 16GB RAM 峰值時記憶體不足 | 高 | 中 | Tika 和 Ollama 不同時運行；排程索引於離峰時段 |
| R2 | Apple Silicon 生態更新導致相容性問題 | 中 | 低 | 鎖定 Docker 映像版本；定期升級測試；保留回滾機制 |
| R3 | LLM Tool Calling 意圖識別不準確 | 高 | 中 | 設計清晰的 Tool description；加入 few-shot 範例；建立測試集 |
| R4 | 大量媒體檔案初次索引時間過長 | 低 | 高 | 分批索引（每次 500 檔案）；顯示進度指示；優先索引近期檔案 |
| R5 | 中文語音識別準確率不足 | 中 | 低 | 使用 whisper.cpp `medium` 模型（中文更準）；或 faster-whisper |
| R6 | M5 Mac Mini 即將推出，M4 可能降價 | 低 | 高 | 等待 M5 發布（預計 2026 Q2-Q3）或趁 M4 降價時入手 |

---

## 9. 附錄

### 9.1 專案目錄結構

```
friday-ai/
├── server/                    # Bun + Hono 後端
│   ├── index.ts               # 入口，路由設定
│   ├── agent/
│   │   ├── llm.ts             # Ollama 封裝 + ReAct Loop
│   │   └── tools/             # 各 Tool 實作
│   │       ├── searchFiles.ts
│   │       ├── playMedia.ts
│   │       ├── openDocument.ts
│   │       ├── listRecent.ts
│   │       └── organizeFiles.ts
│   ├── services/
│   │   ├── lancedb.ts         # 向量搜尋服務
│   │   ├── indexer.ts         # 檔案索引管道
│   │   ├── thumbnail.ts       # 縮圖生成
│   │   └── hls.ts             # FFmpeg HLS 串流
│   └── types/
│       └── shared.ts          # 前後端共用型別
│
├── client/                    # React + Vite PWA
│   ├── components/
│   │   ├── ChatInterface.tsx
│   │   ├── VoiceInput.tsx
│   │   └── renderers/
│   │       ├── VideoCard.tsx
│   │       ├── AudioPlayer.tsx
│   │       ├── PDFViewer.tsx
│   │       ├── ImageGrid.tsx
│   │       └── FileList.tsx
│   └── hooks/
│       └── useSSE.ts          # SSE 串流接收
│
├── docker/
│   ├── compose.core.yml       # 核心服務（常駐）
│   ├── compose.ai.yml         # AI 服務（按需）
│   ├── compose.index.yml      # 索引服務（排程）
│   └── .env                   # 環境變數
│
└── scripts/
    ├── file_watcher.py        # watchdog 監控
    ├── indexing_pipeline.py   # 索引主程式
    └── dedup_scan.sh          # 去重掃描
```

### 9.2 Docker Compose 服務拓樸

```yaml
# compose.core.yml（常駐服務）
services:
  api:          # Bun + Hono，Port 8000
  nginx:        # React PWA，Port 3000
  samba:        # SMB 檔案分享，Port 445
  syncthing:    # 多設備同步，Port 8384

# compose.ai.yml（按需啟動）
services:
  ollama:       # LLM 推論，Port 11434
  whisper:      # STT 服務，Port 10300
  kokoro:       # TTS 服務，Port 8880

# compose.index.yml（排程執行）
services:
  tika:         # 文件提取，Port 9998
  indexer:      # Python 索引管道（cron 觸發）
```

### 9.3 開源元件授權

| 元件 | 授權 | 商業使用 | 備註 |
|------|------|:-------:|------|
| Ollama | MIT | ✅ | 含 Qwen3 模型（Apache 2.0） |
| LanceDB | Apache 2.0 | ✅ | `@lancedb/lancedb` npm 套件 |
| Hono | MIT | ✅ | Web Framework |
| whisper.cpp | MIT | ✅ | Whisper 模型：MIT |
| Kokoro-82M | Apache 2.0 | ✅ | TTS 模型 |
| Apache Tika | Apache 2.0 | ✅ | 文件提取 |
| Bun | MIT | ✅ | JavaScript Runtime |
| React | MIT | ✅ | 前端框架 |
| TailwindCSS | MIT | ✅ | CSS 框架 |
| FFmpeg | LGPL 2.1+ | ⚠️ | 注意動態連結要求 |

### 9.4 環境變數清單

```bash
# .env
# === LLM 設定 ===
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_CTX=4096

# === 檔案系統 ===
MEDIA_PATH=/mnt/external_hdd/media
PHOTOS_PATH=/mnt/external_hdd/photos
DOCS_PATH=/mnt/external_hdd/docs
THUMB_CACHE_PATH=/data/thumbs
LANCEDB_PATH=/data/lancedb
SQLITE_PATH=/data/friday.db

# === 服務端點 ===
TIKA_URL=http://tika:9998
WHISPER_URL=http://whisper:10300
KOKORO_URL=http://kokoro:8880

# === 安全 ===
API_SECRET=your-secret-key
TAILSCALE_AUTH_KEY=your-tailscale-key

# === 索引排程 ===
INDEX_CRON=0 2 * * *   # 每天凌晨 2:00
INDEX_BATCH_SIZE=500
```

---

*Magpie AI PRD v1.0 · Plusblocks Technology Ltd. · March 2026 · Confidential*
