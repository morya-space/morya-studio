/**
 * 组件路由：自定义组件（CustomComponent）的 CRUD（按 owner 隔离）。
 * name/baseType 提取为标量列。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { DatabaseSync } from 'node:sqlite'
import type { AppBindings } from '../types/context'
import { requireAuth, requirePermission } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'
import { createEntityStore, type EntityStore } from '../db/entity-store'

/** 自定义组件负载（与前端 services/component 对齐） */
export interface CustomComponentPayload {
  id: string
  name: string
  baseType: string
  description?: string
  icon?: string
  config?: Record<string, unknown>
  meta?: { createdAt?: string; updatedAt?: string }
}

const compSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  baseType: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  meta: z.record(z.unknown()).optional(),
})

export interface ComponentStores {
  components: EntityStore<CustomComponentPayload>
}

export function createComponentStores(db: DatabaseSync): ComponentStores {
  return {
    components: createEntityStore<CustomComponentPayload>(db, 'components', {
      payloadColumn: 'config',
      scalarColumns: ['name', 'base_type'],
      extractScalars: (p) => [p.name ?? '', p.baseType ?? ''],
      toPayload: (row, parsed) => ({
        ...(parsed as unknown as CustomComponentPayload),
        id: row.id,
        name: String(row.name ?? parsed.name ?? ''),
        baseType: String(row.base_type ?? parsed.baseType ?? ''),
      }),
    }),
  }
}

export function createComponentRoutes(stores: ComponentStores) {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  app.get('/', requirePermission('component:read'), (c) => {
    return c.json({ items: stores.components.list(c.get('user').id).map(r => r.payload) })
  })

  app.get('/:id', requirePermission('component:read'), (c) => {
    const rec = stores.components.get(c.get('user').id, c.req.param('id'))
    if (!rec) throw new ApiError(404, 'not_found', '组件不存在')
    return c.json({ component: rec.payload })
  })

  app.post('/', requirePermission('component:write'), async (c) => {
    const parsed = compSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '组件数据不完整或格式不正确')
    const rec = stores.components.create(c.get('user').id, parsed.data as CustomComponentPayload, parsed.data.id)
    return c.json({ component: rec.payload }, 201)
  })

  app.put('/:id', requirePermission('component:write'), async (c) => {
    const parsed = compSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '组件数据不完整或格式不正确')
    const rec = stores.components.update(c.get('user').id, c.req.param('id'), parsed.data as CustomComponentPayload)
    if (!rec) throw new ApiError(404, 'not_found', '组件不存在')
    return c.json({ component: rec.payload })
  })

  app.delete('/:id', requirePermission('component:write'), (c) => {
    const ok = stores.components.remove(c.get('user').id, c.req.param('id'))
    if (!ok) throw new ApiError(404, 'not_found', '组件不存在')
    return c.json({ ok: true })
  })

  return app
}
