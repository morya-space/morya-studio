/**
 * 面板路由：PageSchema 的 CRUD（按 owner 隔离）。
 * 前端 PageSchema 已含 id/title/cards/meta，后端仅做持久化与归属校验。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { PageSchema } from '@morya-studio/shared'
import type { DatabaseSync } from '../db/mysql'
import type { AppBindings } from '../types/context'
import { requireAuth, requirePermission } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'
import { createEntityStore, type EntityStore } from '../db/entity-store'

const pageSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  layout: z.enum(['grid', 'free']).default('grid'),
  grid: z.record(z.unknown()).optional(),
  cards: z.array(z.record(z.unknown())).default([]),
  theme: z.record(z.unknown()).optional(),
  meta: z.record(z.unknown()).optional(),
})

export interface PageStores {
  pages: EntityStore<PageSchema>
}

export function createPageStores(db: DatabaseSync): PageStores {
  return {
    pages: createEntityStore<PageSchema>(db, 'pages', {
      payloadColumn: 'schema',
      scalarColumns: ['title', 'description'],
      extractScalars: (p) => [p.title ?? '', p.description ?? ''],
      toPayload: (_row, parsed) => parsed as unknown as PageSchema,
    }),
  }
}

export function createPageRoutes(stores: PageStores) {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  app.get('/', requirePermission('panel:read'), (c) => {
    const ownerId = c.get('user').id
    return c.json({ items: stores.pages.list(ownerId).map(r => r.payload) })
  })

  app.get('/:id', requirePermission('panel:read'), (c) => {
    const rec = stores.pages.get(c.get('user').id, c.req.param('id'))
    if (!rec) throw new ApiError(404, 'not_found', '面板不存在')
    return c.json({ page: rec.payload })
  })

  app.post('/', requirePermission('panel:write'), async (c) => {
    const parsed = pageSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '面板数据不完整')
    const ownerId = c.get('user').id
    const rec = stores.pages.create(ownerId, parsed.data as unknown as PageSchema, parsed.data.id)
    return c.json({ page: rec.payload }, 201)
  })

  app.put('/:id', requirePermission('panel:write'), async (c) => {
    const parsed = pageSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '面板数据不完整')
    const ownerId = c.get('user').id
    const rec = stores.pages.update(ownerId, c.req.param('id'), parsed.data as unknown as PageSchema)
    if (!rec) throw new ApiError(404, 'not_found', '面板不存在')
    return c.json({ page: rec.payload })
  })

  app.delete('/:id', requirePermission('panel:write'), (c) => {
    const ok = stores.pages.remove(c.get('user').id, c.req.param('id'))
    if (!ok) throw new ApiError(404, 'not_found', '面板不存在')
    return c.json({ ok: true })
  })

  return app
}
