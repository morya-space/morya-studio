import type { AppConfig } from './config/env'
import type { AppBindings } from './types/context'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getConfig } from './config/env'
import { errorHandler } from './middleware/error-handler'
import { requestId } from './middleware/request-id'
import { createDocsRoutes } from './routes/docs'
import { createHealthRoutes } from './routes/health'
import { createAuthRoutes } from './routes/auth'
import { createAuthService } from './services/auth'
import { createMySqlAuthStore, createMySqlPool } from './services/auth-store'

export function createApp(config?: AppConfig) {
  const app = new Hono<AppBindings>()
  const resolvedConfig = config ?? getConfig()
  const auth = createAuthService(config ? createMySqlAuthStore(createMySqlPool(resolvedConfig)) : undefined)

  app.use('*', requestId)
  app.use(async (c, next) => {
    c.set('config', resolvedConfig)
    await next()
  })
  app.use('/api/*', cors({ origin: resolvedConfig.APP_ORIGIN, credentials: true }))
  app.route('/health', createHealthRoutes())
  app.route('/', createDocsRoutes())
  app.route('/api/auth', createAuthRoutes(auth))

  app.get('/api/routes', (context) => {
    const routes = Array.from(
      new Map(
        app.routes.map(({ method, path }) => [`${method} ${path}`, { method, path }]),
      ).values(),
    ).sort((left, right) => {
      const methodOrder = left.method.localeCompare(right.method)
      return methodOrder || left.path.localeCompare(right.path)
    })

    return context.json({ count: routes.length, routes })
  })

  app.onError(errorHandler)

  return app
}
