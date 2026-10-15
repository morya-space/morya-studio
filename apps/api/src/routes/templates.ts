/**
 * 模板路由：PanelTemplate 的 CRUD（按 owner 隔离）。
 * title/icon 提取为标量列，page 为面板快照 JSON。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { PageSchema } from '@morya-studio/shared'
import type { DatabaseSync } from '../db/mysql'
import type { AppBindings } from '../types/context'
import { requireAuth, requirePermission } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'
import { createEntityStore, type EntityStore } from '../db/entity-store'

export interface PanelTemplatePayload {
  id: string
  title: string
  description?: string
  icon?: string
  cardCount?: number
  page: PageSchema
  meta?: { createdAt?: string; updatedAt?: string }
}

const tplSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  cardCount: z.number().optional(),
  page: z.record(z.unknown()),
  meta: z.record(z.unknown()).optional(),
})

export interface TemplateStores {
  templates: EntityStore<PanelTemplatePayload>
}

export function createTemplateStores(db: DatabaseSync): TemplateStores {
  return {
    templates: createEntityStore<PanelTemplatePayload>(db, 'templates', {
      payloadColumn: 'page',
      scalarColumns: ['title', 'description', 'icon'],
      extractScalars: (p) => [p.title ?? '', p.description ?? '', p.icon ?? 'layout'],
      toPayload: (row, parsed) => ({
        ...(parsed as unknown as { page: PageSchema }),
        id: row.id,
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        icon: String(row.icon ?? 'layout'),
        // payload JSON 里整个 PanelTemplate（含 page），取出 page 字段
        page: (parsed.page ?? parsed) as PageSchema,
      } as unknown as PanelTemplatePayload),
    }),
  }
}

export function createTemplateRoutes(stores: TemplateStores) {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  app.get('/', requirePermission('template:read'), (c) => {
    return c.json({ items: stores.templates.list(c.get('user').id).map(r => r.payload) })
  })

  app.get('/:id', requirePermission('template:read'), (c) => {
    const rec = stores.templates.get(c.get('user').id, c.req.param('id'))
    if (!rec) throw new ApiError(404, 'not_found', '模板不存在')
    return c.json({ template: rec.payload })
  })

  app.post('/', requirePermission('template:write'), async (c) => {
    const parsed = tplSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '模板数据不完整或格式不正确')
    const rec = stores.templates.create(c.get('user').id, parsed.data as unknown as PanelTemplatePayload, parsed.data.id)
    return c.json({ template: rec.payload }, 201)
  })

  app.put('/:id', requirePermission('template:write'), async (c) => {
    const parsed = tplSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '模板数据不完整或格式不正确')
    const rec = stores.templates.update(c.get('user').id, c.req.param('id'), parsed.data as unknown as PanelTemplatePayload)
    if (!rec) throw new ApiError(404, 'not_found', '模板不存在')
    return c.json({ template: rec.payload })
  })

  app.delete('/:id', requirePermission('template:write'), (c) => {
    const ok = stores.templates.remove(c.get('user').id, c.req.param('id'))
    if (!ok) throw new ApiError(404, 'not_found', '模板不存在')
    return c.json({ ok: true })
  })

  return app
}
