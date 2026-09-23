/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves the /api routes from `dev/api.ts` against an in-memory store, so the
 * whole product can be walked without a Supabase project.
 *
 * `apply: 'serve'` keeps it out of the production build entirely: on Vercel the
 * real handlers in `api/` take over. The module is loaded through
 * `ssrLoadModule` so it picks up edits without restarting the server.
 */
function devApi(): Plugin {
  return {
    name: 'do-teruel-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        server
          .ssrLoadModule('/dev/api.ts')
          .then(async (module) => {
            const handled = await (
              module as { handleDevApi: (req: unknown, res: unknown) => Promise<boolean> }
            ).handleDevApi(req, res)
            if (!handled) next()
          })
          .catch((error: unknown) => {
            server.config.logger.error(`[dev-api] ${String(error)}`)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: String(error) }))
          })
      })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Vite only exposes VITE_-prefixed variables, and only to the browser. The
  // dev API runs in Node and needs the real ones, so `.env` is read into
  // process.env here — during `serve` only, never for a production build.
  if (command === 'serve') {
    Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  }

  return {
    plugins: [react(), devApi()],

    build: {
      outDir: 'dist',
      // The admin panel is a separate chunk so respondents never download it.
      chunkSizeWarningLimit: 700,
    },

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      // The flow tests drive a 13-row rating grid one click at a time, which
      // takes longer than the 5 s default when the suites run in parallel.
      testTimeout: 30_000,
      include: ['tests/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  }
})
