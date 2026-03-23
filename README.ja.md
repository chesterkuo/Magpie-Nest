# Magpie — AIネイティブ NAS & ストレージエージェント

> あなたのパーソナルAIストレージアシスタント — 自然言語でファイルを管理、検索、再生、整理。デバイス上で100%ローカル動作。

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Magpieとは？

Magpieは**AIネイティブのNAS/ストレージエージェント**で、Mac Mini（またはあらゆるMac）をスマートなファイルサーバーに変えます。iPhone、iPad、PCなどあらゆるデバイスからアクセス可能な単一のウェブアプリを通じて、ファイルを理解し、自然な言葉でファイルを見つけたり、再生したり、整理したり、アップロードしたりするのを手伝うAIアシスタントとチャットできます。

クラウドストレージのセルフホスト型AI対応代替サービスをパーソナルアシスタントの知性で実現したものとお考えください。

**クラウド不要。サブスクリプション不要。データはデバイス外に出ません。**

## 機能

### AIエージェント
- **自然言語検索** — 「先週作業したプレゼンを探して」— ハイブリッド検索（ベクトル＋キーワード再ランク付け）で実現
- **ファイル整理** — 種類・日付別にファイルを整理し、正規表現によるバッチリネームが可能なAI搭載ツール
- **AirDropコントロール** — チャットコマンドでMacのAirDropを有効化/無効化
- **マルチターン会話** — 日付グループ表示とバッチ削除機能付きの永続的なチャット履歴

### メディア
- **ビデオストリーミング** — オンデマンドトランスコーディングとサムネイル生成を備えた内蔵HLSストリーミング
- **オーディオプレーヤー** — アーティスト/アルバム表示、キュー、シャッフル、リピート、音量調整
- **ドキュメントプレビュー** — PDF（フルスクリーン対応）、DOCX、XLSX、PPTXをブラウザ上で直接表示
- **イメージギャラリー** — ライトボックスナビゲーション付きグリッドビュー

### ストレージ
- **ファイルアップロード** — LAN経由でどのデバイス（iPhone、PC）からもドラッグ＆ドロップアップロード（進行状況バー付き）
- **スマートインデックス** — セマンティックベクトル検索による自動ファイル監視
- **リッチメタデータ** — ファイルから再生時間、アーティスト、アルバム、寸法、ページ数を抽出

### インターフェース
- **macOSネイティブデザイン** — Appleシステムフォント、フロストガラスサイドバー、iOSスタイルナビゲーションによるライトテーマ
- **レスポンシブ** — デスクトップサイドバー＋モバイルボトムナビゲーション、iPhone向けに最適化
- **10言語対応** — English、繁體中文、简体中文、Français、Español、日本語、한국어、ไทย、Nederlands、Bahasa Indonesia — ブラウザ/OS設定から自動検出
- **音声インターフェース** — プッシュトゥトーク音声入力（whisper.cpp）とテキスト読み上げ（Kokoro）
- **PWA** — オフラインサポート付きのスタンドアロンアプリとしてインストール可能

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| ランタイム | [Bun](https://bun.sh) |
| サーバー | [Hono](https://hono.dev) |
| フロントエンド | React 19 + Vite + Tailwind CSS 4 |
| LLM | OpenAI互換API（デフォルト：Gemini 2.5 Flash）または [Ollama](https://ollama.com) |
| エンベディング | Gemini Embedding または Ollama（nomic-embed-text） |
| ベクトルDB | [LanceDB](https://lancedb.com) |
| データベース | SQLite（bun:sqlite） |
| i18n | react-i18next（10言語） |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## クイックスタート

### 前提条件

- Apple Silicon搭載のmacOS（M1/M2/M4）
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org)（ビデオストリーミングとサムネイル生成に必要）
- LLM APIキー（例：[Google AI Studio](https://aistudio.google.com)のGemini — 無料）**または** 完全ローカル推論用の[Ollama](https://ollama.com)

### 1. クローンとインストール

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. 環境設定

```bash
cp .env.example .env
# .envを編集 — 最低限 LLM_API_KEY と WATCH_DIRS を設定してください
```

詳細は下記の[LLMプロバイダー設定](#llmプロバイダー設定)を参照してください。

### 3. （オプション）ローカル推論にOllamaを使用

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

その後、`.env`で`LLM_PROVIDER=ollama`および`EMBED_PROVIDER=ollama`を設定します。

### 4. （オプション）音声機能のセットアップ

```bash
bash scripts/setup-models.sh
```

### 5. 実行

```bash
# サーバー＋クライアントを起動（ホットリロード）
bun run dev

# インデクサーワーカーを起動（別のターミナルで）
bun run dev:indexer

# またはコンポーネントを個別に実行
bun run dev:server   # ポート8000でAPI
bun run dev:client   # ポート5173でVite開発サーバー
```

> **重要:** アップロード/監視されたファイルをインデックスして検索可能にするには、インデクサーワーカーが実行されている必要があります。

### 6. アクセス

- **デスクトップ:** [http://localhost:5173](http://localhost:5173) を開く
- **iPhone/モバイル:** `http://<MacのIPアドレス>:5173` を開く（例：`http://192.168.1.108:5173`）
- **ファイルアップロード:** アップロードページを使用するか、MacへAirDropで送信

### 7. 本番環境用ビルド

```bash
bun run build        # クライアントをビルド
bun run dev:server   # ポート8000ですべてを提供
```

## プロジェクト構成

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono APIサーバー
│   │   ├── agent/            # ReActループ、ツール、システムプロンプト
│   │   ├── routes/           # REST APIエンドポイント
│   │   ├── services/         # DB、LanceDB、インデクサー、検索、HLS、プロバイダー
│   │   │   └── providers/    # LLM/エンベディングプロバイダー抽象化
│   │   ├── middleware/       # 認証
│   │   └── workers/          # バックグラウンドインデクサーワーカー
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # チャット、会話、最近、メディア、アップロード、設定
│   │   ├── src/hooks/        # useSSE、usePlayback、useOnlineStatus
│   │   ├── src/components/   # UIコンポーネント＋レンダラー
│   │   └── src/locales/      # i18n翻訳ファイル（10言語）
│   └── shared/               # 共有TypeScript型
├── e2e/                      # PlaywrightエンドツーエンドTestかを
├── docs/                     # 仕様と実装計画
├── docker/                   # Docker Compose（Ollama）
├── scripts/                  # セットアップスクリプト（音声モデル、アイコン生成）
└── data/                     # ランタイムデータ（SQLite、LanceDB、サムネイル、HLSキャッシュ）
```

## APIエンドポイント

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/chat` | 要 | AIエージェントとチャット（SSEストリーム） |
| POST | `/api/upload` | 要 | ファイルアップロード（multipart/form-data） |
| GET | `/api/files` | 要 | フィルタリングとページネーション付きファイル一覧 |
| GET | `/api/file/:id` | 要 | ファイル提供（Rangeリクエスト対応） |
| GET | `/api/file/:id/preview` | 要 | ドキュメントプレビュー（DOCX/XLSX → HTML） |
| GET | `/api/stream/:id/playlist.m3u8` | 不要 | HLSビデオプレイリスト |
| GET | `/api/stream/:id/:segment` | 不要 | HLSビデオセグメント |
| GET | `/api/thumb/:id` | 不要 | ファイルサムネイル（WebP） |
| GET/POST | `/api/playlists` | 要 | プレイリストCRUD |
| GET/PUT/DELETE | `/api/conversations` | 要 | 会話CRUD（単体＋バッチ削除） |
| GET/PUT | `/api/settings` | 要 | 設定管理 |
| POST | `/api/settings/test-connection` | 要 | LLM/エンベディングプロバイダー接続テスト |
| POST | `/api/stt` | 要 | 音声認識 |
| POST | `/api/tts` | 要 | テキスト読み上げ |
| GET | `/api/health` | 不要 | システムヘルスチェック |

## エージェントツール

AIエージェントはファンクションコーリングを通じてこれらのツールにアクセスできます：

| ツール | 説明 |
|-------|------|
| `search_files` | 種類/日付フィルター付きハイブリッド検索（ベクトル＋キーワード） |
| `play_media` | ビデオまたはオーディオファイルをストリーミング |
| `open_document` | ドキュメントをプレビュー（PDF、DOCX、XLSX、PPTX） |
| `list_recent` | 最近更新されたファイルを閲覧 |
| `get_file_info` | ファイルのメタデータと詳細を取得 |
| `create_playlist` | 検索からの自動入力オプション付きプレイリストを作成 |
| `list_directory` | 特定のフォルダ内のファイルを閲覧 |
| `get_disk_status` | ディスク使用量とファイル統計を確認 |
| `organize_files` | 種類または日付別にサブフォルダへファイルを整理 |
| `batch_rename` | 正規表現パターンにマッチするファイルをリネーム（ドライラン プレビュー） |
| `airdrop_control` | AirDropの有効化/無効化、状態確認 |

## テスト

```bash
# API＆ユニットテスト（192テスト）
cd packages/server
bun test
bun test --watch

# E2Eブラウザテスト（38テスト、Playwright + Chromium）
bunx playwright test
```

> 初回セットアップ: `bun add -d @playwright/test && bunx playwright install chromium`

## LLMプロバイダー設定

MagpieはOpenAI互換APIインターフェースを通じて複数のLLMプロバイダーをサポートします。**デフォルトプロバイダーはGoogle のOpenAI互換エンドポイントを通じたGemini 2.5 Flash**です。Ollamaは完全ローカルオプションとしてサポートされています。

チャットモデルとエンベディングモデルは**独立して**設定できます。`.env`またはUIの**設定ページ**から設定可能です。

### Geminiを使用する（デフォルト）

[Google AI Studio](https://aistudio.google.com)から無料のAPIキーを取得：

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

### OpenAI互換プロバイダーを使用する

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

OpenAI、Groq、OpenRouter、Together、およびあらゆるOpenAI互換エンドポイントで動作します。

### Ollamaを使用する（完全ローカル）

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## 環境変数

### LLM（チャットモデル）

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` または `ollama` |
| `LLM_API_KEY` | — | チャットプロバイダーのAPIキー |
| `LLM_BASE_URL` | Geminiエンドポイント | OpenAI互換ベースURL |
| `LLM_MODEL` | `gemini-2.5-flash` | チャットモデル名 |

### エンベディングモデル

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` または `ollama` |
| `EMBED_API_KEY` | — | エンベディングプロバイダーのAPIキー |
| `EMBED_BASE_URL` | Geminiエンドポイント | OpenAI互換ベースURL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | エンベディングモデル名 |

### Ollama

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama APIエンドポイント |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollamaチャットモデル |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollamaエンベディングモデル |

### 一般

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `DATA_DIR` | `./data` | データストレージディレクトリ |
| `API_SECRET` | `magpie-dev` | API認証トークン |
| `PORT` | `8000` | サーバーポート |
| `WATCH_DIRS` | — | 監視してインデックスするパスのカンマ区切りリスト |

## ライセンス

Copyright 2026 Plusblocks Technology Ltd.
