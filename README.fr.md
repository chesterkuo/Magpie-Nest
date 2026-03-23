# Magpie — Agent NAS & Stockage Natif IA

> Votre assistant de stockage IA personnel — gérez, recherchez, lisez et organisez vos fichiers en langage naturel. Fonctionne 100% localement sur votre appareil.

[English](./README.md) | [繁體中文](./README.zh-TW.md) | [简体中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [ไทย](./README.th.md) | [Nederlands](./README.nl.md) | [Bahasa Indonesia](./README.id.md)

## Qu'est-ce que Magpie ?

Magpie est un **agent NAS/stockage natif IA** qui transforme votre Mac Mini (ou n'importe quel Mac) en serveur de fichiers intelligent. Grâce à une application web unique accessible depuis n'importe quel appareil — iPhone, iPad, PC — vous pouvez discuter avec un assistant IA qui comprend vos fichiers et vous aide à les trouver, lire, organiser et téléverser en langage naturel.

Considérez-le comme une alternative auto-hébergée et propulsée par l'IA au stockage en nuage — avec l'intelligence d'un assistant personnel.

**Pas de cloud. Pas d'abonnements. Vos données ne quittent jamais votre appareil.**

## Fonctionnalités

### Agent IA
- **Recherche en Langage Naturel** — "Trouve la présentation sur laquelle j'ai travaillé la semaine dernière" via la recherche hybride (vecteur + reclassement par mots-clés)
- **Organisation de Fichiers** — Outils propulsés par l'IA pour organiser les fichiers par type/date et renommer en masse avec regex
- **Contrôle AirDrop** — Activer/désactiver AirDrop sur votre Mac via des commandes de chat
- **Conversations Multi-tours** — Historique de chat persistant avec vue groupée par date et suppression en masse

### Médias
- **Streaming Vidéo** — Streaming HLS intégré avec transcodage à la demande, génération de vignettes
- **Lecteur Audio** — Affichage artiste/album, file d'attente, lecture aléatoire, répétition, contrôle du volume
- **Prévisualisation de Documents** — Consultez des PDF (en plein écran), DOCX, XLSX, PPTX directement dans le navigateur
- **Galerie d'Images** — Vue en grille avec navigation en lightbox

### Stockage
- **Téléversement de Fichiers** — Téléversement par glisser-déposer depuis n'importe quel appareil (iPhone, PC) sur le réseau local avec barres de progression
- **Indexation Intelligente** — Surveillance automatique des fichiers avec recherche vectorielle sémantique
- **Métadonnées Riches** — Extrait la durée, l'artiste, l'album, les dimensions, le nombre de pages des fichiers

### Interface
- **Design Natif macOS** — Thème clair avec polices système Apple, barre latérale en verre dépoli, navigation style iOS
- **Responsive** — Barre latérale bureau + navigation mobile en bas, optimisé pour iPhone
- **10 Langues** — English, 繁體中文, 简体中文, Français, Español, 日本語, 한국어, ไทย, Nederlands, Bahasa Indonesia — détection automatique depuis les paramètres du navigateur/système
- **Interface Vocale** — Saisie vocale push-to-talk (whisper.cpp) et synthèse vocale (Kokoro)
- **PWA** — Installez comme une application autonome avec prise en charge hors ligne

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Runtime | [Bun](https://bun.sh) |
| Serveur | [Hono](https://hono.dev) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| LLM | API compatible OpenAI (par défaut : Gemini 2.5 Flash) ou [Ollama](https://ollama.com) |
| Embeddings | Gemini Embedding ou Ollama (nomic-embed-text) |
| Base de données vectorielle | [LanceDB](https://lancedb.com) |
| Base de données | SQLite (bun:sqlite) |
| i18n | react-i18next (10 langues) |
| STT | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) |
| TTS | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) |

## Démarrage Rapide

### Prérequis

- macOS avec Apple Silicon (M1/M2/M4)
- [Bun](https://bun.sh) >= 1.0
- [FFmpeg](https://ffmpeg.org) (pour le streaming vidéo et les vignettes)
- Une clé API LLM (ex. [Google AI Studio](https://aistudio.google.com) pour Gemini — gratuit) **ou** [Ollama](https://ollama.com) pour une inférence entièrement locale

### 1. Cloner et installer

```bash
git clone https://github.com/chesterkuo/Magpie-Nest.git
cd Magpie-Nest
bun install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
# Modifier .env — définir au minimum LLM_API_KEY et WATCH_DIRS
```

Consultez [Configuration du Fournisseur LLM](#configuration-du-fournisseur-llm) ci-dessous pour les détails.

### 3. (Optionnel) Utiliser Ollama pour l'inférence locale

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

Puis définissez `LLM_PROVIDER=ollama` et `EMBED_PROVIDER=ollama` dans `.env`.

### 4. (Optionnel) Configurer la voix

```bash
bash scripts/setup-models.sh
```

### 5. Lancer

```bash
# Démarrer le serveur + le client (rechargement à chaud)
bun run dev

# Démarrer le worker d'indexation (dans un terminal séparé)
bun run dev:indexer

# Ou lancer les composants séparément
bun run dev:server   # API sur le port 8000
bun run dev:client   # Serveur de développement Vite sur le port 5173
```

> **Important :** Le worker d'indexation doit être en cours d'exécution pour que les fichiers téléversés/surveillés soient indexés et consultables.

### 6. Accès

- **Bureau :** Ouvrez [http://localhost:5173](http://localhost:5173)
- **iPhone/Mobile :** Ouvrez `http://<ip-de-votre-mac>:5173` (ex. `http://192.168.1.108:5173`)
- **Téléverser des fichiers :** Utilisez la page de téléversement ou AirDrop vers votre Mac

### 7. Construire pour la production

```bash
bun run build        # Construire le client
bun run dev:server   # Servir tout sur le port 8000
```

## Structure du Projet

```
Magpie-Nest/
├── packages/
│   ├── server/               # Serveur API Bun + Hono
│   │   ├── agent/            # Boucle ReAct, outils, prompt système
│   │   ├── routes/           # Points de terminaison API REST
│   │   ├── services/         # BDD, LanceDB, indexeur, recherche, HLS, fournisseurs
│   │   │   └── providers/    # Abstraction fournisseur LLM/embedding
│   │   ├── middleware/       # Authentification
│   │   └── workers/          # Worker d'indexation en arrière-plan
│   ├── client/               # PWA React 19
│   │   ├── src/routes/       # Chat, Conversations, Récent, Médias, Téléversement, Paramètres
│   │   ├── src/hooks/        # useSSE, usePlayback, useOnlineStatus
│   │   ├── src/components/   # Composants UI + rendus
│   │   └── src/locales/      # Fichiers de traduction i18n (10 langues)
│   └── shared/               # Types TypeScript partagés
├── e2e/                      # Tests end-to-end Playwright
├── docs/                     # Spécifications et plans d'implémentation
├── docker/                   # Docker Compose (Ollama)
├── scripts/                  # Scripts de configuration (modèles vocaux, génération d'icônes)
└── data/                     # Données d'exécution (SQLite, LanceDB, vignettes, cache HLS)
```

## Points de Terminaison API

| Méthode | Chemin | Auth | Description |
|---------|--------|:----:|-------------|
| POST | `/api/chat` | Oui | Discuter avec l'agent IA (flux SSE) |
| POST | `/api/upload` | Oui | Téléverser des fichiers (multipart/form-data) |
| GET | `/api/files` | Oui | Lister les fichiers avec filtrage et pagination |
| GET | `/api/file/:id` | Oui | Servir un fichier (supporte les requêtes Range) |
| GET | `/api/file/:id/preview` | Oui | Prévisualisation de document (DOCX/XLSX → HTML) |
| GET | `/api/stream/:id/playlist.m3u8` | Non | Playlist vidéo HLS |
| GET | `/api/stream/:id/:segment` | Non | Segment vidéo HLS |
| GET | `/api/thumb/:id` | Non | Vignette de fichier (WebP) |
| GET/POST | `/api/playlists` | Oui | CRUD de playlists |
| GET/PUT/DELETE | `/api/conversations` | Oui | CRUD de conversations (suppression simple + en masse) |
| GET/PUT | `/api/settings` | Oui | Gestion des paramètres |
| POST | `/api/settings/test-connection` | Oui | Tester la connexion au fournisseur LLM/embedding |
| POST | `/api/stt` | Oui | Reconnaissance vocale |
| POST | `/api/tts` | Oui | Synthèse vocale |
| GET | `/api/health` | Non | Vérification de l'état du système |

## Outils de l'Agent

L'agent IA a accès à ces outils via l'appel de fonctions :

| Outil | Description |
|-------|-------------|
| `search_files` | Recherche hybride (vecteur + mots-clés) avec filtres par type/date |
| `play_media` | Diffuser des fichiers vidéo ou audio |
| `open_document` | Prévisualiser des documents (PDF, DOCX, XLSX, PPTX) |
| `list_recent` | Parcourir les fichiers récemment modifiés |
| `get_file_info` | Obtenir les métadonnées et détails d'un fichier |
| `create_playlist` | Créer des playlists avec remplissage automatique optionnel depuis la recherche |
| `list_directory` | Parcourir les fichiers dans un dossier spécifique |
| `get_disk_status` | Vérifier l'utilisation du disque et les statistiques des fichiers |
| `organize_files` | Organiser les fichiers dans des sous-dossiers par type ou date |
| `batch_rename` | Renommer les fichiers correspondant à un modèle regex (aperçu à blanc) |
| `airdrop_control` | Activer/désactiver AirDrop, vérifier l'état |

## Tests

```bash
# Tests API & unitaires (192 tests)
cd packages/server
bun test
bun test --watch

# Tests E2E dans le navigateur (38 tests, Playwright + Chromium)
bunx playwright test
```

> Configuration initiale : `bun add -d @playwright/test && bunx playwright install chromium`

## Configuration du Fournisseur LLM

Magpie prend en charge plusieurs fournisseurs LLM via une interface API compatible OpenAI. Le **fournisseur par défaut est Gemini 2.5 Flash** via le point de terminaison compatible OpenAI de Google. Ollama est pris en charge comme option entièrement locale.

Les modèles de chat et d'embedding peuvent être configurés **indépendamment**. Configuration via `.env` ou la **page Paramètres** dans l'interface.

### Utiliser Gemini (par défaut)

Obtenez une clé API gratuite depuis [Google AI Studio](https://aistudio.google.com) :

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

### Utiliser n'importe quel fournisseur compatible OpenAI

```env
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Compatible avec OpenAI, Groq, OpenRouter, Together, et tout point de terminaison compatible OpenAI.

### Utiliser Ollama (entièrement local)

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b

EMBED_PROVIDER=ollama
OLLAMA_EMBED_MODEL=nomic-embed-text
```

## Variables d'Environnement

### LLM (modèle de chat)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LLM_PROVIDER` | `openai-compatible` | `openai-compatible` ou `ollama` |
| `LLM_API_KEY` | — | Clé API pour le fournisseur de chat |
| `LLM_BASE_URL` | Point de terminaison Gemini | URL de base compatible OpenAI |
| `LLM_MODEL` | `gemini-2.5-flash` | Nom du modèle de chat |

### Modèle d'embedding

| Variable | Défaut | Description |
|----------|--------|-------------|
| `EMBED_PROVIDER` | `openai-compatible` | `openai-compatible` ou `ollama` |
| `EMBED_API_KEY` | — | Clé API pour le fournisseur d'embedding |
| `EMBED_BASE_URL` | Point de terminaison Gemini | URL de base compatible OpenAI |
| `EMBED_MODEL` | `gemini-embedding-2-preview` | Nom du modèle d'embedding |

### Ollama

| Variable | Défaut | Description |
|----------|--------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Point de terminaison API Ollama |
| `OLLAMA_MODEL` | `qwen3:4b` | Modèle de chat Ollama |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Modèle d'embedding Ollama |

### Général

| Variable | Défaut | Description |
|----------|--------|-------------|
| `DATA_DIR` | `./data` | Répertoire de stockage des données |
| `API_SECRET` | `magpie-dev` | Jeton d'authentification API |
| `PORT` | `8000` | Port du serveur |
| `WATCH_DIRS` | — | Chemins séparés par des virgules à surveiller et indexer |

## Licence

Copyright 2026 Plusblocks Technology Ltd.
