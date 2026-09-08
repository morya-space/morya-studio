import type { HealthResponse } from '@wise-kit/shared'
import type { AppBindings } from '../types/context'
import { Hono } from 'hono'

export function createHealthRoutes() {
  const router = new Hono<AppBindings>()
  router.get('/', (context) => {
    const response: HealthResponse = { status: 'ok', service: 'api' }
    return context.json(response)
  })
  return router
}
