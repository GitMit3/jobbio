import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * I produktion körs allt under /api som Vercel-funktioner. Lokalt finns ingen
 * sådan runtime, så vi monterar samma handlers som middleware i dev-servern.
 * Handlers använder bara vanliga Node req/res och fungerar därför i båda lägena.
 */
function apiRoutes() {
  return {
    name: 'jobbio-api-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname
        if (!pathname.startsWith('/api/')) return next()

        const route = pathname.slice('/api/'.length)
        if (!/^[a-z0-9-]+$/i.test(route)) return next()

        const handlerFile = path.join(rootDir, 'api', `${route}.js`)
        if (!fs.existsSync(handlerFile)) return next()

        // Cache-bust så att ändringar i handlern slår igenom utan omstart.
        import(`${pathToFileURL(handlerFile).href}?t=${Date.now()}`)
          .then((mod) => mod.default(req, res))
          .catch((error) => {
            server.config.logger.error(`[api] ${route}: ${error.stack || error}`)
            res.statusCode = 500
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: String(error.message || error) }))
          })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Serverhemligheter (t.ex. ANTHROPIC_API_KEY) ligger i .env utan VITE_-prefix
  // och når därför inte klienten. De behövs däremot i dev-serverns Node-process.
  const env = loadEnv(mode, rootDir, '')
  const serverKeys = [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_MODEL',
    'ANTHROPIC_EFFORT',
    'JOBBIO_LOCAL_MODEL',
    'JOBBIO_LOCAL_EFFORT',
    'JOBBIO_LOCAL_TIMEOUT_MS',
  ]
  for (const key of serverKeys) {
    if (!process.env[key] && env[key]) process.env[key] = env[key]
  }

  // Grinden för Claude Code-läget: sätts bara här, alltså bara när dev-servern
  // kör. På Vercel finns ingen CLI att anropa och endpointen svarar 403.
  process.env.JOBBIO_LOCAL_RUNTIME = '1'

  return {
    plugins: [react(), apiRoutes()],
    server: { port: 5173 },
  }
})
