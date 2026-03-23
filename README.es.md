# Magpie — Agente NAS y Almacenamiento Nativo de IA

> Tu asistente de almacenamiento IA personal — gestiona, busca, reproduce y organiza archivos con lenguaje natural. Funciona 100% localmente en tu dispositivo.

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## ¿Qué es Magpie?

Magpie es un **agente NAS/almacenamiento nativo de IA** que convierte tu Mac Mini (o cualquier Mac) en un servidor de archivos inteligente. A través de una sola aplicación web accesible desde cualquier dispositivo — iPhone, iPad, PC — puedes chatear con un asistente IA que entiende tus archivos y te ayuda a encontrarlos, reproducirlos, organizarlos y subirlos usando lenguaje natural.

Piénsalo como una alternativa autoalojada e impulsada por IA al almacenamiento en la nube — con la inteligencia de un asistente personal.

**Sin nube. Sin suscripciones. Tus datos nunca salen de tu dispositivo.**

## Características

### Agente IA
- **Búsqueda en Lenguaje Natural** — "Encuentra la presentación en la que trabajé la semana pasada" mediante búsqueda híbrida (vector + reclasificación por palabras clave)
- **Organización de Archivos** — Herramientas impulsadas por IA para organizar archivos por tipo/fecha y renombrar en lote con regex
- **Control de AirDrop** — Habilitar/deshabilitar AirDrop en tu Mac mediante comandos de chat
- **Conversaciones Multi-turno** — Historial de chat persistente con vista agrupada por fecha y eliminación en lote

### Multimedia
- **Streaming de Vídeo** — Streaming HLS integrado con transcodificación bajo demanda, generación de miniaturas
- **Reproductor de Audio** — Visualización de artista/álbum, cola, reproducción aleatoria, repetición, control de volumen
- **Vista Previa de Documentos** — Visualiza PDF (con pantalla completa), DOCX, XLSX, PPTX directamente en el navegador
- **Galería de Imágenes** — Vista en cuadrícula con navegación en lightbox

### Almacenamiento
- **Subida de Archivos** — Subida mediante arrastrar y soltar desde cualquier dispositivo (iPhone, PC) por LAN con barras de progreso
- **Indexación Inteligente** — Monitorización automática de archivos con búsqueda vectorial semántica
- **Metadatos Enriquecidos** — Extrae duración, artista, álbum, dimensiones y número de páginas de los archivos

### Interfaz
- **Diseño Nativo de macOS** — Tema claro con fuentes del sistema Apple, barra lateral de vidrio esmerilado, navegación estilo iOS
- **Responsive** — Barra lateral de escritorio + navegación inferior móvil, optimizado para iPhone
- **10 Idiomas** — English, 繁體中文, 简体中文, Français, Español, 日本語, 한국어, ไทย, Nederlands, Bahasa Indonesia — detección automática desde la configuración del navegador/sistema
- **Interfaz de Voz** — Entrada de voz push-to-talk (whisper.cpp) y síntesis de voz (Kokoro)
- **PWA** — Instala como aplicación independiente con soporte sin conexión

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Servidor | [Hono](https://hono.dev) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| LLM | API compatible con OpenAI (por defecto: Gemini 2.5 Flash) o [Ollama](https://ollama.com) |
| Embeddings | Gemini Embedding u Ollama (nomic-embed-text) |
| Base de datos vectorial | [LanceDB](https://lancedb.com) |
| Base de datos | SQLite (bun:sqlite) |
| i18n | react-i18next (10 idiomas) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## Inicio Rápido

### Requisitos Previos

- macOS con Apple Silicon (M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org) (para streaming de vídeo y miniaturas)
- Una clave de API LLM (ej. [Google AI Studio](https://aistudio.google.com) para Gemini — gratuito) **o** [Ollama](https://ollama.com) para inferencia completamente local

### 1. Clonar e instalar

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. Configurar el entorno

```bash
cp .env.example .env
# Editar .env — establecer como mínimo LLM_API_KEY y WATCH_DIRS
```

Consulta [Configuración del Proveedor LLM](#configuración-del-proveedor-llm) a continuación para más detalles.

### 3. (Opcional) Usar Ollama para inferencia local

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

Luego establece `LLM_PROVIDER=ollama` y `EMBED_PROVIDER=ollama` en `.env`.

### 4. (Opcional) Configurar voz

```bash
bash scripts/setup-models.sh
```

### 5. Ejecutar

```bash
# Iniciar servidor + cliente (recarga en caliente)
bun run dev

# Iniciar el worker del indexador (en una terminal separada)
bun run dev:indexer

# O ejecutar componentes por separado
bun run dev:server   # API en el puerto 8000
bun run dev:client   # Servidor de desarrollo Vite en el puerto 5173
```

> **Importante:** El worker del indexador debe estar en ejecución para que los archivos subidos/monitorizados sean indexados y consultables.

### 6. Acceso

- **Escritorio:** Abre [http://localhost:5173](http://localhost:5173)
- **iPhone/Móvil:** Abre `http://<ip-de-tu-mac>:5173` (ej. `http://192.168.1.108:5173`)
- **Subir archivos:** Usa la página de subida o AirDrop a tu Mac

### 7. Compilar para producción

```bash
bun run build        # Compilar el cliente
bun run dev:server   # Servir todo en el puerto 8000
```

## Estructura del Proyecto

```
Magpie-Nest/
├── packages/
│   ├── server/               # Servidor API Bun + Hono
│   │   ├── agent/            # Bucle ReAct, herramientas, prompt del sistema
│   │   ├── routes/           # Endpoints de la API REST
│   │   ├── services/         # BDD, LanceDB, indexador, búsqueda, HLS, proveedores
│   │   │   └── providers/    # Abstracción de proveedor LLM/embedding
│   │   ├── middleware/       # Autenticación
│   │   └── workers/          # Worker de indexación en segundo plano
│   ├── client/               # PWA React 19
│   │   ├── src/routes/       # Chat, Conversaciones, Reciente, Multimedia, Subida, Ajustes
│   │   ├── src/hooks/        # useSSE, usePlayback, useOnlineStatus
│   │   ├── src/components/   # Componentes UI + renderizadores
│   │   └── src/locales/      # Archivos de traducción i18n (10 idiomas)
│   └── shared/               # Tipos TypeScript compartidos
├── e2e/                      # Tests end-to-end con Playwright
├── docs/                     # Especificaciones y planes de implementación
├── docker/                   # Docker Compose (Ollama)
├── scripts/                  # Scripts de configuración (modelos de voz, generación de iconos)
└── data/                     # Datos de ejecución (SQLite, LanceDB, miniaturas, caché HLS)
```

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/api/chat` | Sí | Chatear con el agente IA (flujo SSE) |
| POST | `/api/upload` | Sí | Subir archivos (multipart/form-data) |
| GET | `/api/files` | Sí | Listar archivos con filtrado y paginación |
| GET | `/api/file/:id` | Sí | Servir archivo (admite solicitudes Range) |
| GET | `/api/file/:id/preview` | Sí | Vista previa de documento (DOCX/XLSX → HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | No | Lista de reproducción de vídeo HLS |
| GET | `/api/stream/:id/:segment` | No | Segmento de vídeo HLS |
| GET | `/api/thumb/:id` | No | Miniatura de archivo (WebP) |
| GET/POST | `/api/playlists` | Sí | CRUD de listas de reproducción |
| GET/PUT/DELETE | `/api/conversations` | Sí | CRUD de conversaciones (eliminación individual + en lote) |
| GET/PUT | `/api/settings` | Sí | Gestión de ajustes |
| POST | `/api/settings/test-connection` | Sí | Probar conexión al proveedor LLM/embedding |
| POST | `/api/stt` | Sí | Reconocimiento de voz |
| POST | `/api/tts` | Sí | Síntesis de voz |
| GET | `/api/health` | No | Comprobación de estado del sistema |

## Herramientas del Agente

El agente IA tiene acceso a estas herramientas mediante llamadas a funciones:

| Herramienta | Descripción |
|-------------|-------------|
| `search_files` | Búsqueda híbrida (vector + palabras clave) con filtros por tipo/fecha |
| `play_media` | Reproducir archivos de vídeo o audio |
| `open_document` | Vista previa de documentos (PDF, DOCX, XLSX, PPTX) |
| `list_recent` | Explorar archivos modificados recientemente |
| `get_file_info` | Obtener metadatos y detalles de un archivo |
| `create_playlist` | Crear listas de reproducción con relleno automático opcional desde la búsqueda |
| `list_directory` | Explorar archivos en una carpeta específica |
| `get_disk_status` | Comprobar el uso del disco y estadísticas de archivos |
| `organize_files` | Organizar archivos en subcarpetas por tipo o fecha |
| `batch_rename` | Renombrar archivos que coincidan con un patrón regex (vista previa en seco) |
| `airdrop_control` | Habilitar/deshabilitar AirDrop, verificar estado |

## Pruebas

```bash
# Pruebas de API y unitarias (192 pruebas)
cd packages/server
bun test
bun test --watch

# Pruebas E2E en el navegador (38 pruebas, Playwright + Chromium)
bunx playwright test
```

> Configuración inicial: `bun add -d @playwright/test && bunx playwright install chromium`

## Configuración del Proveedor LLM

Magpie admite múltiples proveedores LLM a través de una interfaz API compatible con OpenAI. El **proveedor por defecto es Gemini 2.5 Flash** a través del endpoint compatible con OpenAI de Google. Ollama es compatible como opción completamente local.

Los modelos de chat y embedding pueden configurarse **de forma independiente**. Configuración mediante `.env` o la **página de Ajustes** en la interfaz.

### Usar Gemini (por defecto)

Obtén una clave de API gratuita en [Google AI Studio](https://aistudio.google.com):

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

### Usar cualquier proveedor compatible con OpenAI

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Compatible con OpenAI, Groq, OpenRouter, Together y cualquier endpoint compatible con OpenAI.

### Usar Ollama (completamente local)

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## Variables de Entorno

### LLM (modelo de chat)

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` u `ollama` |
| `LLM_API_KEY` | — | Clave API para el proveedor de chat |
| `LLM_BASE_URL` | Endpoint de Gemini | URL base compatible con OpenAI |
| `LLM_MODEL` | `gemini-2.5-flash` | Nombre del modelo de chat |

### Modelo de embedding

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` u `ollama` |
| `EMBED_API_KEY` | — | Clave API para el proveedor de embedding |
| `EMBED_BASE_URL` | Endpoint de Gemini | URL base compatible con OpenAI |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | Nombre del modelo de embedding |

### Ollama

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Endpoint de la API de Ollama |
| `OLLAMA_MODEL` | `qwen3:4b` | Modelo de chat de Ollama |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Modelo de embedding de Ollama |

### General

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `DATA_DIR` | `./data` | Directorio de almacenamiento de datos |
| `API_SECRET` | `magpie-dev` | Token de autenticación de la API |
| `PORT` | `8000` | Puerto del servidor |
| `WATCH_DIRS` | — | Rutas separadas por comas a monitorizar e indexar |

## Licencia

Copyright 2026 Plusblocks Technology Ltd.
