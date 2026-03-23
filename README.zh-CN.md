# Magpie — AI 原生 NAS 与存储代理

> 你的个人 AI 存储助理 — 用自然语言管理、搜索、播放及整理文件。100% 在本地运行。

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Magpie 是什么？

Magpie 是一套 **AI 原生的 NAS／存储代理**，能将你的 Mac Mini（或任何 Mac）变成一台智能文件服务器。通过单一 Web App，你可以从任何设备（iPhone、iPad、PC）连接，并与一位理解你的文件的 AI 助理对话，用日常语言来搜索、播放、整理及上传文件。

把它想象成一个自托管、AI 驱动的云存储替代方案 — 兼具个人助理的智慧。

**不上云、不订阅、数据永远不离开你的设备。**

## 功能特色

### AI 代理
- **自然语言搜索** — 说「找上周做的演示文稿」就能找到文件，采用混合搜索（向量 + 关键字重排序）
- **文件整理** — AI 驱动工具，可按类型／日期整理文件并以正则表达式批量重命名
- **AirDrop 控制** — 通过对话指令启用／禁用 Mac 上的 AirDrop
- **多轮对话** — 持久化对话记录，支持日期分组显示及批量删除

### 媒体
- **视频流** — 内置 HLS 流媒体，支持按需转码及缩略图生成
- **音乐播放器** — 显示歌手／专辑，支持队列、随机播放、循环及音量控制
- **文档预览** — 直接在浏览器中查看 PDF（支持全屏）、DOCX、XLSX、PPTX
- **图片画廊** — 网格显示并支持灯箱导航

### 存储
- **文件上传** — 通过局域网从任何设备（iPhone、PC）拖放上传，附进度条
- **智能索引** — 自动监控文件变动，支持语义向量搜索
- **丰富元数据** — 自动提取音视频时长、歌手、专辑、图片尺寸、页数等信息

### 界面
- **macOS 原生设计** — 浅色主题，使用 Apple 系统字体、毛玻璃侧边栏及 iOS 风格导航
- **响应式** — 桌面侧边栏 + 手机底部导航栏，针对 iPhone 优化
- **10 种语言** — English、繁體中文、简体中文、Français、Español、日本語、한국어、ไทย、Nederlands、Bahasa Indonesia — 自动检测浏览器／系统设置
- **语音界面** — 按住说话语音输入（whisper.cpp）+ 文字转语音（Kokoro）
- **PWA** — 可安装为独立应用程序，支持离线浏览

## 技术架构

| 层级 | 技术 |
|------|------|
| 运行环境 | [Bun](https://bun.sh) |
| 服务器 | [Hono](https://hono.dev) |
| 前端 | React 19 + Vite + Tailwind CSS 4 |
| 大语言模型 | OpenAI 兼容 API（默认：Gemini 2.5 Flash）或 [Ollama](https://ollama.com) 本地推理 |
| 向量嵌入 | Gemini Embedding 或 Ollama（nomic-embed-text） |
| 向量数据库 | [LanceDB](https://lancedb.com) |
| 关系型数据库 | SQLite（bun:sqlite） |
| 国际化 | react-i18next（10 种语言） |
| 语音转文字 | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| 文字转语音 | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## 快速开始

### 前置要求

- macOS + Apple Silicon（M1/M2/M4）
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org)（视频流媒体与缩略图生成）
- LLM API 密钥（例如 [Google AI Studio](https://aistudio.google.com) 的 Gemini — 免费）**或** [Ollama](https://ollama.com) 进行完全本地推理

### 1. 克隆并安装

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env — 至少需设置 LLM_API_KEY 与 WATCH_DIRS
```

请参阅下方的 [LLM 提供商配置](#llm-提供商配置) 了解详细说明。

### 3.（可选）使用 Ollama 进行本地推理

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

然后在 `.env` 中设置 `LLM_PROVIDER=ollama` 与 `EMBED_PROVIDER=ollama`。

### 4.（可选）配置语音功能

```bash
bash scripts/setup-models.sh
```

### 5. 运行

```bash
# 启动服务器 + 客户端（热重载）
bun run dev

# 启动索引器 Worker（在另一个终端窗口）
bun run dev:indexer

# 或分别启动各组件
bun run dev:server   # API 服务 port 8000
bun run dev:client   # Vite 开发服务器 port 5173
```

> **重要：** 索引器 Worker 必须保持运行，上传或监控的文件才能被索引并可搜索。

### 6. 访问

- **桌面：** 打开 [http://localhost:5173](http://localhost:5173)
- **iPhone／手机：** 打开 `http://<你的-Mac-IP>:5173`（例如 `http://192.168.1.108:5173`）
- **上传文件：** 使用上传页面，或通过 AirDrop 传到你的 Mac

### 7. 构建生产版本

```bash
bun run build        # 构建前端
bun run dev:server   # 在 port 8000 提供所有服务
```

## 项目结构

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono API 服务器
│   │   ├── agent/            # ReAct 循环、工具、系统提示
│   │   ├── routes/           # REST API 端点
│   │   ├── services/         # 数据库、LanceDB、索引器、搜索、HLS、提供商
│   │   │   └── providers/    # LLM／向量嵌入提供商抽象层
│   │   ├── middleware/       # 认证中间件
│   │   └── workers/          # 后台索引 Worker
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # 聊天、对话列表、近期文件、媒体库、上传、设置
│   │   ├── src/hooks/        # useSSE、usePlayback、useOnlineStatus
│   │   ├── src/components/   # UI 组件 + 渲染器
│   │   └── src/locales/      # i18n 翻译文件（10 种语言）
│   └── shared/               # 共享 TypeScript 类型
├── e2e/                      # Playwright 端到端测试
├── docs/                     # 规格与实现计划
├── docker/                   # Docker Compose（Ollama）
├── scripts/                  # 配置脚本（语音模型、图标生成）
└── data/                     # 运行时数据（SQLite、LanceDB、缩略图、HLS 缓存）
```

## API 端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|:----:|------|
| POST | `/api/chat` | 是 | 与 AI 代理对话（SSE 流） |
| POST | `/api/upload` | 是 | 上传文件（multipart/form-data） |
| GET | `/api/files` | 是 | 文件列表，支持筛选与分页 |
| GET | `/api/file/:id` | 是 | 获取文件（支持 Range 请求） |
| GET | `/api/file/:id/preview` | 是 | 文档预览（DOCX/XLSX 转 HTML） |
| GET | `/api/stream/:id/playlist.m3u8` | 否 | HLS 视频播放列表 |
| GET | `/api/stream/:id/:segment` | 否 | HLS 视频片段 |
| GET | `/api/thumb/:id` | 否 | 文件缩略图（WebP） |
| GET/POST | `/api/playlists` | 是 | 播放列表 CRUD |
| GET/PUT/DELETE | `/api/conversations` | 是 | 对话记录 CRUD（单条 + 批量删除） |
| GET/PUT | `/api/settings` | 是 | 设置管理 |
| POST | `/api/settings/test-connection` | 是 | 测试 LLM／向量嵌入提供商连接 |
| POST | `/api/stt` | 是 | 语音转文字 |
| POST | `/api/tts` | 是 | 文字转语音 |
| GET | `/api/health` | 否 | 系统健康检查 |

## AI 代理工具

AI 代理通过 Function Calling 可使用以下工具：

| 工具 | 说明 |
|------|------|
| `search_files` | 混合搜索（向量 + 关键字），支持类型／日期筛选 |
| `play_media` | 流媒体播放视频或音乐 |
| `open_document` | 预览文档（PDF、DOCX、XLSX、PPTX） |
| `list_recent` | 浏览最近修改的文件 |
| `get_file_info` | 获取文件元数据与详细信息 |
| `create_playlist` | 创建播放列表，可自动从搜索结果填充 |
| `list_directory` | 浏览指定文件夹的文件 |
| `get_disk_status` | 查看磁盘使用量与文件统计 |
| `organize_files` | 将文件按类型或日期整理至子文件夹 |
| `batch_rename` | 用正则表达式批量重命名文件（支持预览模式） |
| `airdrop_control` | 启用／禁用 AirDrop，查看状态 |

## 测试

```bash
# API 与单元测试（192 项测试）
cd packages/server
bun test
bun test --watch

# E2E 浏览器测试（38 项测试，Playwright + Chromium）
bunx playwright test
```

> 首次配置：`bun add -d @playwright/test && bunx playwright install chromium`

## LLM 提供商配置

Magpie 通过 OpenAI 兼容 API 接口支持多种 LLM 提供商。**默认提供商为 Gemini 2.5 Flash**，使用 Google 的 OpenAI 兼容端点。Ollama 作为完全本地运行的选项亦受到支持。

聊天模型与向量嵌入模型可以**独立配置**。配置可通过 `.env` 或 UI 的**设置页面**进行。

### 使用 Gemini（默认）

从 [Google AI Studio](https://aistudio.google.com) 获取免费 API 密钥：

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

### 使用任何 OpenAI 兼容提供商

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

适用于 OpenAI、Groq、OpenRouter、Together 及任何 OpenAI 兼容端点。

### 使用 Ollama（完全本地）

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## 环境变量

### LLM（聊天模型）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` 或 `ollama` |
| `LLM_API_KEY` | — | 聊天提供商的 API 密钥 |
| `LLM_BASE_URL` | Gemini 端点 | OpenAI 兼容聊天端点的基础 URL |
| `LLM_MODEL` | `gemini-2.5-flash` | 聊天模型名称 |

### 向量嵌入模型

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` 或 `ollama` |
| `EMBED_API_KEY` | — | 向量嵌入提供商的 API 密钥 |
| `EMBED_BASE_URL` | Gemini 端点 | OpenAI 兼容向量嵌入端点的基础 URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | 向量嵌入模型名称 |

### Ollama

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API 地址 |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama 聊天模型 |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama 向量嵌入模型 |

### 通用设置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATA_DIR` | `./data` | 数据存储目录 |
| `API_SECRET` | `magpie-dev` | API 认证令牌 |
| `PORT` | `8000` | 服务器端口 |
| `WATCH_DIRS` | — | 以逗号分隔要监控并索引的路径 |

## 许可证

Copyright 2026 Plusblocks Technology Ltd.
