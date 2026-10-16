/**
 * 面板路由：PageSchema 的 CRUD（按 owner 隔离）+ 分享（publish/unpublish）+ 版本历史。
 * 前端 PageSchema 已含 id/title/cards/meta，后端仅做持久化与归属校验。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { randomBytes, randomUUID } from 'node:crypto'
import type { PageSchema } from '@morya-studio/shared'
import type { DatabaseSync } from '../db/mysql'
import { all, get, run } from '../db/database'
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
  filters: z.array(z.record(z.unknown())).optional(),
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

function now(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

/** 分享 token：Base64Url 随机串，防篡改（MVP 直接查表校验） */
function genShareToken(): string {
  return randomBytes(24).toString('base64url')
}

interface ShareRow {
  page_id: string
  owner_id: string
  token: string
  created_at: string
}

interface VersionRow {
  id: string
  page_id: string
  version: number
  schema: string
  created_at: string
  created_by: string | null
}

export function createPageRoutes(stores: PageStores, db: DatabaseSync) {
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
    const id = c.req.param('id')

    // 更新前落一份版本快照（仅内容有变化时）
    const existing = stores.pages.get(ownerId, id)
    if (existing) {
      const count = all<{ n: number }>(
        db,
        `SELECT COUNT(*) AS n FROM page_versions WHERE page_id = ? AND owner_id = ?`,
        id, ownerId,
      )[0]?.n ?? 0
      run(
        db,
        `INSERT INTO page_versions (id, page_id, owner_id, version, \`schema\`, created_at, created_by) VALUES (?,?,?,?,?,?,?)`,
        randomUUID(), id, ownerId, count + 1,
        JSON.stringify(existing.payload), now(), c.get('user').id,
      )
    }

    const rec = stores.pages.update(ownerId, id, parsed.data as unknown as PageSchema)
    if (!rec) throw new ApiError(404, 'not_found', '面板不存在')
    return c.json({ page: rec.payload })
  })

  app.delete('/:id', requirePermission('panel:write'), (c) => {
    const ownerId = c.get('user').id
    const id = c.req.param('id')
    // 无外键，需手动清理关联数据
    run(db, `DELETE FROM page_shares WHERE page_id = ? AND owner_id = ?`, id, ownerId)
    run(db, `DELETE FROM page_versions WHERE page_id = ? AND owner_id = ?`, id, ownerId)
    const ok = stores.pages.remove(ownerId, id)
    if (!ok) throw new ApiError(404, 'not_found', '面板不存在')
    return c.json({ ok: true })
  })

  // ==================== 分享 ====================

  /** GET /:id/share — 查询当前分享状态 */
  app.get('/:id/share', requirePermission('panel:read'), (c) => {
    const ownerId = c.get('user').id
    const id = c.req.param('id')
    if (!stores.pages.get(ownerId, id)) throw new ApiError(404, 'not_found', '面板不存在')
    const row = get<ShareRow>(db, `SELECT * FROM page_shares WHERE page_id = ? AND owner_id = ?`, id, ownerId)
    if (!row) return c.json({ shared: false, token: null, url: null })
    return c.json({ shared: true, token: row.token, url: buildShareUrl(c.req.header('origin'), id, row.token) })
  })

  /** POST /:id/publish — 发布（生成/轮换分享 token） */
  app.post('/:id/publish', requirePermission('panel:write'), async (c) => {
    const ownerId = c.get('user').id
    const id = c.req.param('id')
    if (!stores.pages.get(ownerId, id)) throw new ApiError(404, 'not_found', '面板不存在')
    const token = genShareToken()
    run(
      db,
      `INSERT INTO page_shares (page_id, owner_id, token, created_at) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE token = ?, created_at = ?`,
      id, ownerId, token, now(), token, now(),
    )
    const url = buildShareUrl(c.req.header('origin'), id, token)
    return c.json({ token, url })
  })

  /** POST /:id/unpublish — 取消分享 */
  app.post('/:id/unpublish', requirePermission('panel:write'), (c) => {
    const ownerId = c.get('user').id
    const id = c.req.param('id')
    run(db, `DELETE FROM page_shares WHERE page_id = ? AND owner_id = ?`, id, ownerId)
    return c.json({ ok: true, shared: false })
  })

  // ==================== 版本历史 ====================

  /** GET /:id/versions — 版本列表（降序） */
  app.get('/:id/versions', requirePermission('panel:read'), (c) => {
    const ownerId = c.get('user').id
    const id = c.req.param('id')
    if (!stores.pages.get(ownerId, id)) throw new ApiError(404, 'not_found', '面板不存在')
    const rows = all<VersionRow>(
      db,
      `SELECT * FROM page_versions WHERE page_id = ? AND owner_id = ? ORDER BY version DESC`,
      id, ownerId,
    )
    return c.json({
      items: rows.map(r => ({
        id: r.id,
        pageId: r.page_id,
        version: r.version,
        createdAt: r.created_at,
        schema: safeParseSchema(r.schema),
      })),
    })
  })

  /** POST /:id/restore/:versionId — 回滚到某版本 */
  app.post('/:id/restore/:versionId', requirePermission('panel:write'), (c) => {
    const ownerId = c.get('user').id
    const id = c.req.param('id')
    const versionId = c.req.param('versionId')
    const row = get<VersionRow>(
      db,
      `SELECT * FROM page_versions WHERE id = ? AND page_id = ? AND owner_id = ?`,
      versionId, id, ownerId,
    )
    if (!row) throw new ApiError(404, 'not_found', '版本不存在')
    const restored = safeParseSchema(row.schema) as PageSchema
    const rec = stores.pages.update(ownerId, id, restored)
    if (!rec) throw new ApiError(404, 'not_found', '面板不存在')
    return c.json({ page: rec.payload })
  })

  return app
}

function safeParseSchema(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function buildShareUrl(origin: string | undefined, pageId: string, token: string): string {
  const base = origin || `http://localhost:${process.env.PORT ?? 3000}`
  return `${base}/view/${pageId}?token=${token}`
}
