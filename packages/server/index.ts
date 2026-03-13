import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { createHealthRoute } from './routes/health'
import { chatRoute } from './routes/chat'
import { streamRoute } from './routes/stream'
import { thumbRoute } from './routes/thumb'
import { createFileRoute } from './routes/file'
import { createFilesRoute } from './routes/files'
import { createPlaylistsRoute } from './routes/playlists'
import { createConversationsRoute } from './routes/conversations'
import { createSettingsRoute } from './routes/settings'
import { sttRoute } from './routes/stt'
import { bootstrap } from './bootstrap'

const appContext = await bootstrap()

const app = new Hono()

app.use('*', cors())
app.use('/api/*', authMiddleware())

const api = app.basePath('/api')
api.route('/', createHealthRoute(appContext.db, appContext.vectorDb))
api.route('/', chatRoute)
api.route('/', streamRoute)
api.route('/', thumbRoute)
api.route('/', createFileRoute(appContext.db))
api.route('/', createFilesRoute(appContext.db))
api.route('/', createPlaylistsRoute(appContext.db))
api.route('/', createConversationsRoute(appContext.db))
api.route('/', createSettingsRoute(appContext.db, appContext.getWatchDirs, appContext.setWatchDirs))
api.route('/', sttRoute)

// Serve React PWA static files
app.get('*', async (c) => {
  const path = c.req.path === '/' ? '/index.html' : c.req.path
  const file = Bun.file(`./packages/client/dist${path}`)
  if (await file.exists()) return new Response(file)
  return new Response(Bun.file('./packages/client/dist/index.html'))
})

export default {
  port: Number(process.env.PORT) || 8000,
  fetch: app.fetch,
}
