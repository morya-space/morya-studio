/**
 * 数据源路由：DataSourceConfig 的 CRUD（按 owner 隔离）。
 * type/staticData/url 提取为标量列，便于列表展示与约束。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { DataSourceConfig } from '@morya-studio/shared'
import type { DatabaseSync } from 'node:sqlite'
import type { AppBindings } from '../types/context'
import { requireAuth, requirePermission } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'
import { createEntityStore, type EntityStore } from '../db/entity-store'

const dsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(['static', 'api', 'mock', 'websocket', 'sql']),
  url: z.string().optional(),
  method: z.enum(['GET', 'POST']).optional(),
  headers: z.record(z.string()).optional(),
  params: z.record(z.unknown()).optional(),
  staticData: z.array(z.record(z.unknown())).optional(),
  dataPath: z.string().optional(),
  mockTemplate: z.string().optional(),
  wsUrl: z.string().optional(),
  pollInterval: z.number().optional(),
  cache: z.record(z.unknown()).optional(),
  auth: z.record(z.unknown()).optional(),
})

export interface DatasourceStores {
  datasources: EntityStore<DataSourceConfig>
}

export function createDatasourceStores(db: DatabaseSync): DatasourceStores {
  return {
    datasources: createEntityStore<DataSourceConfig>(db, 'datasources', {
      payloadColumn: 'config',
      scalarColumns: ['name', 'type'],
      extractScalars: (p) => [p.name ?? '', p.type ?? 'static'],
      toPayload: (_row, parsed) => parsed as unknown as DataSourceConfig,
    }),
  }
}

export function createDatasourceRoutes(stores: DatasourceStores) {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  app.get('/', requirePermission('datasource:read'), (c) => {
    return c.json({ items: stores.datasources.list(c.get('user').id).map(r => r.payload) })
  })

  app.get('/:id', requirePermission('datasource:read'), (c) => {
    const rec = stores.datasources.get(c.get('user').id, c.req.param('id'))
    if (!rec) throw new ApiError(404, 'not_found', '数据源不存在')
    return c.json({ datasource: rec.payload })
  })

  app.post('/', requirePermission('datasource:write'), async (c) => {
    const parsed = dsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '数据源数据不完整或格式不正确')
    const rec = stores.datasources.create(c.get('user').id, parsed.data as unknown as DataSourceConfig, parsed.data.id)
    return c.json({ datasource: rec.payload }, 201)
  })

  app.put('/:id', requirePermission('datasource:write'), async (c) => {
    const parsed = dsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '数据源数据不完整或格式不正确')
    const rec = stores.datasources.update(c.get('user').id, c.req.param('id'), parsed.data as unknown as DataSourceConfig)
    if (!rec) throw new ApiError(404, 'not_found', '数据源不存在')
    return c.json({ datasource: rec.payload })
  })

  app.delete('/:id', requirePermission('datasource:write'), (c) => {
    const ok = stores.datasources.remove(c.get('user').id, c.req.param('id'))
    if (!ok) throw new ApiError(404, 'not_found', '数据源不存在')
    return c.json({ ok: true })
  })

  return app
}
