# Magpie — AI 네이티브 NAS & 스토리지 에이전트

> 개인 AI 스토리지 어시스턴트 — 자연어로 파일을 관리, 검색, 재생, 정리하세요. 기기에서 100% 로컬로 실행됩니다.

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Magpie란?

Magpie는 Mac Mini(또는 모든 Mac)를 스마트 파일 서버로 전환하는 **AI 네이티브 NAS/스토리지 에이전트**입니다. iPhone, iPad, PC 등 모든 기기에서 접근 가능한 단일 웹 앱을 통해 파일을 이해하고 자연스러운 언어로 파일을 찾고, 재생하고, 정리하고, 업로드하는 것을 도와주는 AI 어시스턴트와 대화할 수 있습니다.

개인 어시스턴트의 지능을 갖춘 셀프 호스팅 AI 기반 클라우드 스토리지 대안으로 생각하세요.

**클라우드 없음. 구독 없음. 데이터가 기기를 벗어나지 않습니다.**

## 기능

### AI 에이전트
- **자연어 검색** — "지난주에 작업한 프레젠테이션 찾아줘" — 하이브리드 검색(벡터 + 키워드 재순위)으로 구현
- **파일 정리** — 종류/날짜별로 파일을 정리하고 정규식으로 일괄 이름 변경이 가능한 AI 기반 도구
- **AirDrop 제어** — 채팅 명령으로 Mac의 AirDrop 활성화/비활성화
- **멀티턴 대화** — 날짜 그룹 보기와 일괄 삭제 기능이 있는 영구 채팅 기록

### 미디어
- **비디오 스트리밍** — 온디맨드 트랜스코딩과 썸네일 생성이 포함된 내장 HLS 스트리밍
- **오디오 플레이어** — 아티스트/앨범 표시, 대기열, 셔플, 반복, 볼륨 조절
- **문서 미리보기** — 브라우저에서 PDF(전체화면 지원), DOCX, XLSX, PPTX 직접 보기
- **이미지 갤러리** — 라이트박스 탐색이 가능한 그리드 보기

### 스토리지
- **파일 업로드** — LAN을 통해 모든 기기(iPhone, PC)에서 진행 표시줄과 함께 드래그 앤 드롭 업로드
- **스마트 인덱싱** — 시맨틱 벡터 검색이 포함된 자동 파일 감시
- **풍부한 메타데이터** — 파일에서 재생 시간, 아티스트, 앨범, 크기, 페이지 수 추출

### 인터페이스
- **macOS 네이티브 디자인** — Apple 시스템 폰트, 젖빛 유리 사이드바, iOS 스타일 네비게이션이 있는 라이트 테마
- **반응형** — 데스크톱 사이드바 + 모바일 하단 네비게이션, iPhone에 최적화
- **10개 언어** — English, 繁體中文, 简体中文, Français, Español, 日本語, 한국어, ไทย, Nederlands, Bahasa Indonesia — 브라우저/OS 설정에서 자동 감지
- **음성 인터페이스** — 푸시 투 토크 음성 입력(whisper.cpp)과 텍스트 음성 변환(Kokoro)
- **PWA** — 오프라인 지원이 있는 독립 실행형 앱으로 설치 가능

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 런타임 | [Bun](https://bun.sh) |
| 서버 | [Hono](https://hono.dev) |
| 프론트엔드 | React 19 + Vite + Tailwind CSS 4 |
| LLM | OpenAI 호환 API(기본값: Gemini 2.5 Flash) 또는 [Ollama](https://ollama.com) |
| 임베딩 | Gemini Embedding 또는 Ollama(nomic-embed-text) |
| 벡터 DB | [LanceDB](https://lancedb.com) |
| 데이터베이스 | SQLite(bun:sqlite) |
| i18n | react-i18next(10개 언어) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## 빠른 시작

### 사전 요구 사항

- Apple Silicon이 탑재된 macOS(M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org)(비디오 스트리밍 및 썸네일 생성에 필요)
- LLM API 키(예: [Google AI Studio](https://aistudio.google.com)의 Gemini — 무료) **또는** 완전 로컬 추론을 위한 [Ollama](https://ollama.com)

### 1. 클론 및 설치

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. 환경 설정

```bash
cp .env.example .env
# .env 편집 — 최소한 LLM_API_KEY와 WATCH_DIRS를 설정하세요
```

자세한 내용은 아래의 [LLM 프로바이더 설정](#llm-프로바이더-설정)을 참조하세요.

### 3. (선택사항) 로컬 추론에 Ollama 사용

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

그런 다음 `.env`에서 `LLM_PROVIDER=ollama`와 `EMBED_PROVIDER=ollama`를 설정하세요.

### 4. (선택사항) 음성 기능 설정

```bash
bash scripts/setup-models.sh
```

### 5. 실행

```bash
# 서버 + 클라이언트 시작(핫 리로드)
bun run dev

# 인덱서 워커 시작(별도 터미널에서)
bun run dev:indexer

# 또는 컴포넌트를 개별적으로 실행
bun run dev:server   # 포트 8000에서 API
bun run dev:client   # 포트 5173에서 Vite 개발 서버
```

> **중요:** 업로드/감시된 파일이 인덱싱되고 검색 가능하려면 인덱서 워커가 실행 중이어야 합니다.

### 6. 접속

- **데스크톱:** [http://localhost:5173](http://localhost:5173) 열기
- **iPhone/모바일:** `http://<Mac IP 주소>:5173` 열기(예: `http://192.168.1.108:5173`)
- **파일 업로드:** 업로드 페이지를 사용하거나 Mac으로 AirDrop

### 7. 프로덕션용 빌드

```bash
bun run build        # 클라이언트 빌드
bun run dev:server   # 포트 8000에서 모든 것 제공
```

## 프로젝트 구조

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono API 서버
│   │   ├── agent/            # ReAct 루프, 도구, 시스템 프롬프트
│   │   ├── routes/           # REST API 엔드포인트
│   │   ├── services/         # DB, LanceDB, 인덱서, 검색, HLS, 프로바이더
│   │   │   └── providers/    # LLM/임베딩 프로바이더 추상화
│   │   ├── middleware/       # 인증
│   │   └── workers/          # 백그라운드 인덱서 워커
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # 채팅, 대화, 최근, 미디어, 업로드, 설정
│   │   ├── src/hooks/        # useSSE, usePlayback, useOnlineStatus
│   │   ├── src/components/   # UI 컴포넌트 + 렌더러
│   │   └── src/locales/      # i18n 번역 파일(10개 언어)
│   └── shared/               # 공유 TypeScript 타입
├── e2e/                      # Playwright 엔드투엔드 테스트
├── docs/                     # 사양 및 구현 계획
├── docker/                   # Docker Compose(Ollama)
├── scripts/                  # 설정 스크립트(음성 모델, 아이콘 생성)
└── data/                     # 런타임 데이터(SQLite, LanceDB, 썸네일, HLS 캐시)
```

## API 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/api/chat` | 필요 | AI 에이전트와 채팅(SSE 스트림) |
| POST | `/api/upload` | 필요 | 파일 업로드(multipart/form-data) |
| GET | `/api/files` | 필요 | 필터링과 페이지네이션이 있는 파일 목록 |
| GET | `/api/file/:id` | 필요 | 파일 제공(Range 요청 지원) |
| GET | `/api/file/:id/preview` | 필요 | 문서 미리보기(DOCX/XLSX → HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | 불필요 | HLS 비디오 재생 목록 |
| GET | `/api/stream/:id/:segment` | 불필요 | HLS 비디오 세그먼트 |
| GET | `/api/thumb/:id` | 불필요 | 파일 썸네일(WebP) |
| GET/POST | `/api/playlists` | 필요 | 재생 목록 CRUD |
| GET/PUT/DELETE | `/api/conversations` | 필요 | 대화 CRUD(단일 + 일괄 삭제) |
| GET/PUT | `/api/settings` | 필요 | 설정 관리 |
| POST | `/api/settings/test-connection` | 필요 | LLM/임베딩 프로바이더 연결 테스트 |
| POST | `/api/stt` | 필요 | 음성 인식 |
| POST | `/api/tts` | 필요 | 텍스트 음성 변환 |
| GET | `/api/health` | 불필요 | 시스템 상태 확인 |

## 에이전트 도구

AI 에이전트는 함수 호출을 통해 다음 도구에 접근할 수 있습니다:

| 도구 | 설명 |
|------|------|
| `search_files` | 종류/날짜 필터가 있는 하이브리드 검색(벡터 + 키워드) |
| `play_media` | 비디오 또는 오디오 파일 스트리밍 |
| `open_document` | 문서 미리보기(PDF, DOCX, XLSX, PPTX) |
| `list_recent` | 최근 수정된 파일 탐색 |
| `get_file_info` | 파일 메타데이터 및 세부 정보 가져오기 |
| `create_playlist` | 검색에서 자동 채우기 옵션이 있는 재생 목록 만들기 |
| `list_directory` | 특정 폴더의 파일 탐색 |
| `get_disk_status` | 디스크 사용량 및 파일 통계 확인 |
| `organize_files` | 종류 또는 날짜별로 하위 폴더에 파일 정리 |
| `batch_rename` | 정규식 패턴과 일치하는 파일 이름 변경(드라이 런 미리보기) |
| `airdrop_control` | AirDrop 활성화/비활성화, 상태 확인 |

## 테스트

```bash
# API & 유닛 테스트(192개 테스트)
cd packages/server
bun test
bun test --watch

# E2E 브라우저 테스트(38개 테스트, Playwright + Chromium)
bunx playwright test
```

> 최초 설정: `bun add -d @playwright/test && bunx playwright install chromium`

## LLM 프로바이더 설정

Magpie는 OpenAI 호환 API 인터페이스를 통해 여러 LLM 프로바이더를 지원합니다. **기본 프로바이더는 Google의 OpenAI 호환 엔드포인트를 통한 Gemini 2.5 Flash**입니다. Ollama는 완전 로컬 옵션으로 지원됩니다.

채팅 모델과 임베딩 모델은 **독립적으로** 설정할 수 있습니다. `.env` 또는 UI의 **설정 페이지**를 통해 설정 가능합니다.

### Gemini 사용(기본값)

[Google AI Studio](https://aistudio.google.com)에서 무료 API 키 받기:

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

### OpenAI 호환 프로바이더 사용

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

OpenAI, Groq, OpenRouter, Together 및 모든 OpenAI 호환 엔드포인트와 함께 작동합니다.

### Ollama 사용(완전 로컬)

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## 환경 변수

### LLM (채팅 모델)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` 또는 `ollama` |
| `LLM_API_KEY` | — | 채팅 프로바이더의 API 키 |
| `LLM_BASE_URL` | Gemini 엔드포인트 | OpenAI 호환 기본 URL |
| `LLM_MODEL` | `gemini-2.5-flash` | 채팅 모델 이름 |

### 임베딩 모델

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` 또는 `ollama` |
| `EMBED_API_KEY` | — | 임베딩 프로바이더의 API 키 |
| `EMBED_BASE_URL` | Gemini 엔드포인트 | OpenAI 호환 기본 URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | 임베딩 모델 이름 |

### Ollama

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API 엔드포인트 |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama 채팅 모델 |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama 임베딩 모델 |

### 일반

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATA_DIR` | `./data` | 데이터 저장 디렉터리 |
| `API_SECRET` | `magpie-dev` | API 인증 토큰 |
| `PORT` | `8000` | 서버 포트 |
| `WATCH_DIRS` | — | 감시 및 인덱싱할 경로의 쉼표로 구분된 목록 |

## 라이선스

Copyright 2026 Plusblocks Technology Ltd.
