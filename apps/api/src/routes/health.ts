/**
 * 健康检查路由。
 */

import { Hono } from 'hono'
import type { AppBindings } from '../types/context'

export function createHealthRoutes() {
  const app = new Hono<AppBindings>()
  app.get('/', (c) => c.json({ ok: true, service: 'morya-studio-api', time: new Date().toISOString() }))
  return app
}
