import type { AppConfig } from './config/env'
import type { AppBindings } from './types/context'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getConfig } from './config/env'
import { errorHandler } from './middleware/error-handler'
import { requestId } from './middleware/request-id'
import { createAuthRoutes } from './routes/auth'
import { createDocsRoutes } from './routes/docs'
import { createHealthRoutes } from './routes/health'
import { createPermissionRoutes } from './routes/permissions'
import { createRoleRoutes } from './routes/roles'
import { createUserRoutes } from './routes/users'
import { createIdentityService } from './services/identity'
import { createMySqlIdentityStore, createMySqlPool } from './services/identity-store'

export function createStudio(config?: AppConfig) {
  const app = new Hono<AppBindings>()
  const resolvedConfig = config ?? getConfig()
  const identity = createIdentityService(
    config ? createMySqlIdentityStore(createMySqlPool(resolvedConfig)) : undefined,
  )

  app.use('*', requestId)
  app.use(async (c, next) => {
    c.set('config', resolvedConfig)
    c.set('identity', identity)
    await next()
  })
  app.use('/api/*', cors({ origin: resolvedConfig.APP_ORIGIN, credentials: true }))
  app.route('/health', createHealthRoutes())
  app.route('/', createDocsRoutes())
  app.route('/api/auth', createAuthRoutes())
  app.route('/api/users', createUserRoutes())
  app.route('/api/roles', createRoleRoutes())
  app.route('/api/permissions', createPermissionRoutes())

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

  return { app, identity }
}

export function createApp(config?: AppConfig) {
  return createStudio(config).app
}
