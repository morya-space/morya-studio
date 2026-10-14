/**
 * 应用组装：中间件 + 路由挂载。
 */

import type { DatabaseSync } from 'node:sqlite'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getConfig, type AppConfig } from './config/env'
import { getDb } from './db/database'
import { errorHandler } from './middleware/error-handler'
import { requestId } from './middleware/request-id'
import { createIdentityService, type IdentityService } from './services/identity'
import { createAuthRoutes } from './routes/auth'
import { createIdentityRoutes } from './routes/identity'
import { createPageRoutes, createPageStores, type PageStores } from './routes/pages'
import { createDatasourceRoutes, createDatasourceStores, type DatasourceStores } from './routes/datasources'
import { createComponentRoutes, createComponentStores, type ComponentStores } from './routes/components'
import { createTemplateRoutes, createTemplateStores, type TemplateStores } from './routes/templates'
import { createHealthRoutes } from './routes/health'
import type { AppBindings } from './types/context'

export interface StudioContext {
  app: Hono<AppBindings>
  identity: IdentityService
  stores: PageStores & DatasourceStores & ComponentStores & TemplateStores
  db: DatabaseSync
}

export function createStudio(config?: AppConfig, db?: DatabaseSync): StudioContext {
  const resolvedConfig = config ?? getConfig()
  const database = db ?? getDb(resolvedConfig.DB_FILE)
  const identity = createIdentityService(database, resolvedConfig)
  identity.seed()
  const stores = {
    ...createPageStores(database),
    ...createDatasourceStores(database),
    ...createComponentStores(database),
    ...createTemplateStores(database),
  }

  const app = new Hono<AppBindings>()

  app.use('*', requestId)
  app.use(async (c, next) => {
    c.set('config', resolvedConfig)
    c.set('identity', identity)
    await next()
  })
  app.use('/api/*', cors({
    origin: resolvedConfig.APP_ORIGIN.split(',').map(s => s.trim()),
    credentials: true,
  }))

  app.route('/health', createHealthRoutes())
  app.route('/api/auth', createAuthRoutes())
  app.route('/api', createIdentityRoutes())
  app.route('/api/pages', createPageRoutes(stores))
  app.route('/api/datasources', createDatasourceRoutes(stores))
  app.route('/api/components', createComponentRoutes(stores))
  app.route('/api/templates', createTemplateRoutes(stores))

  app.get('/api/routes', (c) => {
    const routes = Array.from(
      new Map(app.routes.map(({ method, path }) => [`${method} ${path}`, { method, path }])).values(),
    ).sort((l, r) => l.method.localeCompare(r.method) || l.path.localeCompare(r.path))
    return c.json({ count: routes.length, routes })
  })

  app.onError(errorHandler)
  app.notFound((c) => c.json({ error: 'not_found', message: '接口不存在' }, 404))

  return { app, identity, stores, db: database }
}

export function createApp(config?: AppConfig) {
  return createStudio(config).app
}
