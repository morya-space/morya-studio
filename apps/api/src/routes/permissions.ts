import type { AppBindings } from '../types/context'
import { Hono } from 'hono'
import { requireAuth, requirePermission } from '../middleware/auth'

export function createPermissionRoutes() {
  const routes = new Hono<AppBindings>()
  routes.use('*', requireAuth)
  routes.get('/', requirePermission('permissions.read', 'roles.read', 'roles.write'), (c) => {
    return c.json({ items: c.get('identity').listPermissions() })
  })
  return routes
}
