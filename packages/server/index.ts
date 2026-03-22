import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { createHealthRoute } from './routes/health'
import { createChatRoute } from './routes/chat'
import { createStreamRoute } from './routes/stream'
import { thumbRoute } from './routes/thumb'
import { createFileRoute } from './routes/file'
import { createFilesRoute } from './routes/files'
import { createPlaylistsRoute } from './routes/playlists'
import { createConversationsRoute } from './routes/conversations'
import { createSettingsRoute } from './routes/settings'
import { createUploadRoute } from './routes/upload'
import { sttRoute } from './routes/stt'
import { ttsRoute } from './routes/tts'
import { bootstrap } from './bootstrap'

const appContext = await bootstrap()

const app = new Hono()

app.use('*', cors())
app.use('/api/*', authMiddleware())

const api = app.basePath('/api')
api.route('/', createHealthRoute(appContext.db, appContext.vectorDb, appContext.getWatchDirs, appContext.providerManager))
api.route('/', createChatRoute(() => appContext.providerManager.getLLMProvider()))
api.route('/', createStreamRoute(appContext.db))
api.route('/', thumbRoute)
api.route('/', createFileRoute(appContext.db))
api.route('/', createFilesRoute(appContext.db))
api.route('/', createPlaylistsRoute(appContext.db))
api.route('/', createConversationsRoute(appContext.db))
api.route('/', createSettingsRoute(appContext.db, appContext.getWatchDirs, appContext.setWatchDirs, appContext.providerManager))
api.route('/', createUploadRoute(appContext.db, appContext.getWatchDirs))
api.route('/', sttRoute)
api.route('/', ttsRoute)

// Serve React PWA static files
app.get('*', async (c) => {
  const path = c.req.path === '/' ? '/index.html' : c.req.path
  const file = Bun.file(`./packages/client/dist${path}`)
  if (await file.exists()) return new Response(file)
  return new Response(Bun.file('./packages/client/dist/index.html'))
})

export default {
  port: Number(process.env.PORT) || 8000,
  idleTimeout: 120,
  fetch: app.fetch,
}
