# Magpie — AI-Native NAS & Opslagagent

> Uw persoonlijke AI-opslagassistent — beheer, zoek, speel af en organiseer bestanden met natuurlijke taal. Draait 100% lokaal op uw apparaat.

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Wat is Magpie?

Magpie is een **AI-native NAS/opslagagent** die uw Mac Mini (of elke Mac) omzet in een slimme bestandsserver. Via één webapplicatie die toegankelijk is vanaf elk apparaat — iPhone, iPad, PC — kunt u chatten met een AI-assistent die uw bestanden begrijpt en u helpt ze te vinden, af te spelen, te organiseren en te uploaden met gewone taal.

Beschouw het als een zelf-gehoste, AI-aangedreven alternatief voor cloudopslag — met de intelligentie van een persoonlijke assistent.

**Geen cloud. Geen abonnementen. Uw gegevens verlaten uw apparaat nooit.**

## Functies

### AI-agent
- **Zoeken in Natuurlijke Taal** — "Vind de presentatie waaraan ik vorige week werkte" via hybride zoeken (vector + trefwoord herrangschikking)
- **Bestandsorganisatie** — AI-aangedreven tools om bestanden te organiseren op type/datum en batchgewijs te hernoemen met regex
- **AirDrop-beheer** — AirDrop in- of uitschakelen op uw Mac via chatopdrachten
- **Multi-beurt Gesprekken** — Persistent chatgeschiedenis met datumgegroepeerde weergave en batchgewijs verwijderen

### Media
- **Video Streaming** — Ingebouwde HLS-streaming met on-demand transcodering, miniatuurafbeelding genereren
- **Audiospeler** — Artiest/album-weergave, wachtrij, willekeurig afspelen, herhalen, volumebeheer
- **Documentvoorvertoning** — Bekijk PDF's (met volledig scherm), DOCX, XLSX, PPTX rechtstreeks in de browser
- **Afbeeldingsgalerij** — Rasterweergave met lightbox-navigatie

### Opslag
- **Bestanden Uploaden** — Slepen-en-neerzetten uploaden vanaf elk apparaat (iPhone, PC) via LAN met voortgangsbalken
- **Slimme Indexering** — Automatische bestandsbewaking met semantisch vectorzoeken
- **Rijke Metadata** — Extraheert duur, artiest, album, afmetingen, paginatelling uit bestanden

### Interface
- **macOS-Native Ontwerp** — Licht thema met Apple-systeemlettertypen, frosted glass-zijbalk, iOS-stijl navigatie
- **Responsief** — Desktop-zijbalk + mobiele ondernavigatie, geoptimaliseerd voor iPhone
- **10 Talen** — English, 繁體中文, 简体中文, Français, Español, 日本語, 한국어, ไทย, Nederlands, Bahasa Indonesia — automatisch gedetecteerd vanuit browser/OS-instellingen
- **Spraakinterface** — Push-to-talk spraakinvoer (whisper.cpp) en tekst-naar-spraak (Kokoro)
- **PWA** — Installeer als zelfstandige app met offline ondersteuning

## Tech Stack

| Laag | Technologie |
|------|-------------|
| Runtime | [Bun](https://bun.sh) |
| Server | [Hono](https://hono.dev) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| LLM | OpenAI-compatibele API (standaard: Gemini 2.5 Flash) of [Ollama](https://ollama.com) |
| Embeddings | Gemini Embedding of Ollama (nomic-embed-text) |
| Vector DB | [LanceDB](https://lancedb.com) |
| Database | SQLite (bun:sqlite) |
| i18n | react-i18next (10 talen) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## Snel Starten

### Vereisten

- macOS met Apple Silicon (M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org) (voor video streaming en miniaturen)
- Een LLM API-sleutel (bijv. [Google AI Studio](https://aistudio.google.com) voor Gemini — gratis) **of** [Ollama](https://ollama.com) voor volledig lokale inferentie

### 1. Klonen en installeren

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. Omgeving configureren

```bash
cp .env.example .env
# Bewerk .env — stel minimaal LLM_API_KEY en WATCH_DIRS in
```

Zie [LLM-provider Configuratie](#llm-provider-configuratie) hieronder voor details.

### 3. (Optioneel) Ollama gebruiken voor lokale inferentie

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

Stel vervolgens `LLM_PROVIDER=ollama` en `EMBED_PROVIDER=ollama` in in `.env`.

### 4. (Optioneel) Spraak instellen

```bash
bash scripts/setup-models.sh
```

### 5. Uitvoeren

```bash
# Server + client starten (hot reload)
bun run dev

# De indexeringsworker starten (in een apart terminal)
bun run dev:indexer

# Of componenten afzonderlijk uitvoeren
bun run dev:server   # API op poort 8000
bun run dev:client   # Vite dev server op poort 5173
```

> **Belangrijk:** De indexeringsworker moet actief zijn om geüploade/bewatchte bestanden te indexeren en doorzoekbaar te maken.

### 6. Toegang

- **Desktop:** Open [http://localhost:5173](http://localhost:5173)
- **iPhone/Mobiel:** Open `http://<ip-van-uw-mac>:5173` (bijv. `http://192.168.1.108:5173`)
- **Bestanden uploaden:** Gebruik de uploadpagina of AirDrop naar uw Mac

### 7. Bouwen voor productie

```bash
bun run build        # Client bouwen
bun run dev:server   # Alles serveren op poort 8000
```

## Projectstructuur

```
Magpie-Nest/
├── packages/
│   ├── server/               # Bun + Hono API-server
│   │   ├── agent/            # ReAct-lus, tools, systeemprompt
│   │   ├── routes/           # REST API-eindpunten
│   │   ├── services/         # DB, LanceDB, indexeerder, zoeken, HLS, providers
│   │   │   └── providers/    # LLM/embedding provider-abstractie
│   │   ├── middleware/       # Authenticatie
│   │   └── workers/          # Achtergrond indexeringsworker
│   ├── client/               # React 19 PWA
│   │   ├── src/routes/       # Chat, Gesprekken, Recent, Media, Upload, Instellingen
│   │   ├── src/hooks/        # useSSE, usePlayback, useOnlineStatus
│   │   ├── src/components/   # UI-componenten + renderers
│   │   └── src/locales/      # i18n vertaalbestanden (10 talen)
│   └── shared/               # Gedeelde TypeScript-typen
├── e2e/                      # Playwright end-to-end tests
├── docs/                     # Specificaties en implementatieplannen
├── docker/                   # Docker Compose (Ollama)
├── scripts/                  # Installatiescripts (spraakmodellen, icoon genereren)
└── data/                     # Runtimegegevens (SQLite, LanceDB, miniaturen, HLS-cache)
```

## API-eindpunten

| Methode | Pad | Auth | Beschrijving |
|---------|-----|:----:|-------------|
| POST | `/api/chat` | Ja | Chatten met AI-agent (SSE-stream) |
| POST | `/api/upload` | Ja | Bestanden uploaden (multipart/form-data) |
| GET | `/api/files` | Ja | Bestanden weergeven met filtering en paginering |
| GET | `/api/file/:id` | Ja | Bestand serveren (ondersteunt Range-verzoeken) |
| GET | `/api/file/:id/preview` | Ja | Documentvoorvertoning (DOCX/XLSX → HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | Nee | HLS-videoafspeellijst |
| GET | `/api/stream/:id/:segment` | Nee | HLS-videosegment |
| GET | `/api/thumb/:id` | Nee | Bestandsminiatuur (WebP) |
| GET/POST | `/api/playlists` | Ja | Afspeellijst CRUD |
| GET/PUT/DELETE | `/api/conversations` | Ja | Gesprek CRUD (enkelvoudig + batchgewijs verwijderen) |
| GET/PUT | `/api/settings` | Ja | Instellingenbeheer |
| POST | `/api/settings/test-connection` | Ja | LLM/embedding provider-verbinding testen |
| POST | `/api/stt` | Ja | Spraak-naar-tekst |
| POST | `/api/tts` | Ja | Tekst-naar-spraak |
| GET | `/api/health` | Nee | Systeemgezondheidscontrole |

## Agent-tools

De AI-agent heeft toegang tot deze tools via functieaanroepen:

| Tool | Beschrijving |
|------|-------------|
| `search_files` | Hybride zoeken (vector + trefwoord) met type/datum-filters |
| `play_media` | Video- of audiobestanden streamen |
| `open_document` | Documenten voorvertonen (PDF, DOCX, XLSX, PPTX) |
| `list_recent` | Onlangs gewijzigde bestanden bekijken |
| `get_file_info` | Bestandsmetadata en details ophalen |
| `create_playlist` | Afspeellijsten maken met optioneel automatisch vullen vanuit zoeken |
| `list_directory` | Bestanden in een specifieke map bekijken |
| `get_disk_status` | Schijfgebruik en bestandsstatistieken controleren |
| `organize_files` | Bestanden ordenen in submappen op type of datum |
| `batch_rename` | Bestanden hernoemen die overeenkomen met een regex-patroon (proefweergave) |
| `airdrop_control` | AirDrop in- of uitschakelen, status controleren |

## Testen

```bash
# API- en unittests (192 tests)
cd packages/server
bun test
bun test --watch

# E2E browsertests (38 tests, Playwright + Chromium)
bunx playwright test
```

> Eerste keer instellen: `bun add -d @playwright/test && bunx playwright install chromium`

## LLM-provider Configuratie

Magpie ondersteunt meerdere LLM-providers via een OpenAI-compatibele API-interface. De **standaard provider is Gemini 2.5 Flash** via het OpenAI-compatibele eindpunt van Google. Ollama wordt ondersteund als volledig lokale optie.

Chat- en embeddingmodellen kunnen **onafhankelijk** worden geconfigureerd. Configuratie via `.env` of de **Instellingenpagina** in de interface.

### Gemini gebruiken (standaard)

Haal een gratis API-sleutel op bij [Google AI Studio](https://aistudio.google.com):

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

### Een OpenAI-compatibele provider gebruiken

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Werkt met OpenAI, Groq, OpenRouter, Together en elk OpenAI-compatibel eindpunt.

### Ollama gebruiken (volledig lokaal)

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## Omgevingsvariabelen

### LLM (chatmodel)

| Variabele | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` of `ollama` |
| `LLM_API_KEY` | — | API-sleutel voor chatprovider |
| `LLM_BASE_URL` | Gemini-eindpunt | OpenAI-compatibele basis-URL |
| `LLM_MODEL` | `gemini-2.5-flash` | Naam van het chatmodel |

### Embeddingmodel

| Variabele | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` of `ollama` |
| `EMBED_API_KEY` | — | API-sleutel voor embeddingprovider |
| `EMBED_BASE_URL` | Gemini-eindpunt | OpenAI-compatibele basis-URL |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | Naam van het embeddingmodel |

### Ollama

| Variabele | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API-eindpunt |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama chatmodel |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embeddingmodel |

### Algemeen

| Variabele | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `DATA_DIR` | `./data` | Gegevensopslagmap |
| `API_SECRET` | `magpie-dev` | API-authenticatietoken |
| `PORT` | `8000` | Serverpoort |
| `WATCH_DIRS` | — | Door komma's gescheiden paden om te bewaken en indexeren |

## Licentie

Copyright 2026 Plusblocks Technology Ltd.
