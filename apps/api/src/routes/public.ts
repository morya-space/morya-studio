/**
 * 公开路由（免登录）：按分享 token 读取只读面板和其安全数据代理。
 * 配置、凭据和请求目标不离开服务端，浏览器只能请求面板实际引用的数据源标识。
 */

import { Hono } from 'hono'
import type { DataSourceConfig, PageSchema } from '@morya-studio/shared'
import type { DatabaseSync } from '../db/mysql'
import { all, get } from '../db/database'
import type { AppBindings } from '../types/context'
import { ApiError } from '../middleware/error-handler'
import type { PageStores } from './pages'
import type { DatasourceStores } from './datasources'
import { collectPublicDataSources, executePublicDataSource } from './public-data'

interface ShareRow {
  page_id: string
  owner_id: string
  token: string
}

interface PageRow {
  id: string
  schema: string
}

interface DsRow {
  id: string
  config: string
}

function loadPublicSources(page: PageSchema, ownerId: string, db: DatabaseSync) {
  const ids = [...new Set((page.cards ?? []).map(card => card.dataSourceId).filter(Boolean))] as string[]
  const stored = new Map<string, DataSourceConfig>()
  if (ids.length === 0) return collectPublicDataSources(page, stored)
  const rows = all<DsRow>(
    db,
    `SELECT id, config FROM datasources WHERE owner_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
    ownerId, ...ids,
  )
  for (const row of rows) {
    try { stored.set(row.id, JSON.parse(row.config) as DataSourceConfig) } catch { /* skip corrupt configuration */ }
  }
  return collectPublicDataSources(page, stored)
}

function createPublicPage(page: PageSchema, sources: Map<string, { id: string }>): PageSchema {
  const safe = JSON.parse(JSON.stringify(page)) as PageSchema
  delete safe.meta?.createdBy
  for (const card of safe.cards ?? []) {
    if (!card.dataSource && !card.dataSourceId) continue
    const id = card.dataSourceId ?? `inline:${card.id}`
    if (sources.has(id)) card.dataSourceId = id
    delete card.dataSource
  }
  return safe
}

export function createPublicRoutes(
  stores: PageStores & DatasourceStores,
  db: DatabaseSync,
) {
  const app = new Hono<AppBindings>()

  /** GET /api/public/pages/:id?token=xxx — 只读面板 + 无敏感配置的数据源描述 */
  app.get('/pages/:id', (c) => {
    const id = c.req.param('id')
    const token = c.req.query('token')
    if (!token) throw new ApiError(401, 'share_required', '分享链接缺少 token')

    const share = get<ShareRow>(
      db,
      `SELECT * FROM page_shares WHERE page_id = ? AND token = ?`,
      id, token,
    )
    if (!share) throw new ApiError(404, 'share_not_found', '分享链接无效或已取消')

    const row = get<PageRow>(db, `SELECT id, \`schema\` FROM pages WHERE id = ?`, id)
    if (!row) throw new ApiError(404, 'not_found', '面板不存在')

    let page: PageSchema
    try {
      page = JSON.parse(row.schema) as PageSchema
    } catch {
      throw new ApiError(500, 'invalid_schema', '面板数据损坏')
    }

    const sources = loadPublicSources(page, share.owner_id, db)
    const datasources: DataSourceConfig[] = [...sources.values()].map(({ id, config }) => ({
      id,
      name: config.name,
      // viewer 将通过下方固定 query 端点取得行数据；不要把真实类型或配置暴露出去。
      type: 'static',
    }))
    return c.json({ page: createPublicPage(page, sources), datasources })
  })

  /** GET /api/public/pages/:id/datasources/:sourceId?token=xxx — 返回已授权源的行数据 */
  app.get('/pages/:id/datasources/:sourceId', async (c) => {
    const pageId = c.req.param('id')
    const token = c.req.query('token')
    if (!token) throw new ApiError(401, 'share_required', '分享链接缺少 token')
    const share = get<ShareRow>(db, 'SELECT * FROM page_shares WHERE page_id = ? AND token = ?', pageId, token)
    if (!share) throw new ApiError(404, 'share_not_found', '分享链接无效或已取消')
    const row = get<PageRow>(db, 'SELECT id, `schema` FROM pages WHERE id = ?', pageId)
    if (!row) throw new ApiError(404, 'not_found', '面板不存在')
    let page: PageSchema
    try { page = JSON.parse(row.schema) as PageSchema } catch { throw new ApiError(500, 'invalid_schema', '面板数据损坏') }
    const source = loadPublicSources(page, share.owner_id, db).get(c.req.param('sourceId'))
    if (!source) throw new ApiError(404, 'public_datasource_not_found', '数据源未被该面板引用')
    return c.json({ rows: await executePublicDataSource(source) })
  })

  return app
}
