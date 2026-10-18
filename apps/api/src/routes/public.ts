/**
 * 公开路由（免登录）：按分享 token 读取只读面板 + 其引用的数据源。
 * 用于分享链接 / 嵌入 iframe 的渲染消费。不做归属信息泄露（不含 owner、createdBy）。
 */

import { Hono } from 'hono'
import type { DataSourceConfig, PageSchema } from '@morya-studio/shared'
import type { DatabaseSync } from '../db/mysql'
import { all, get } from '../db/database'
import type { AppBindings } from '../types/context'
import { ApiError } from '../middleware/error-handler'
import type { PageStores } from './pages'
import type { DatasourceStores } from './datasources'

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
  config: string
}

export function createPublicRoutes(
  stores: PageStores & DatasourceStores,
  db: DatabaseSync,
) {
  const app = new Hono<AppBindings>()

  /** GET /api/public/pages/:id?token=xxx — 只读面板 + 引用的数据源 */
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

    // 收集卡片引用的数据源（去重，多源 dataSourceIds 优先），仅返回分享所属 owner 的数据源
    const dsIds = [...new Set(
      (page.cards ?? []).flatMap(c => c.dataSourceIds?.length ? c.dataSourceIds : [c.dataSourceId]),
    )].filter(Boolean) as string[]
    const datasources: DataSourceConfig[] = []
    if (dsIds.length > 0) {
      const rows = all<DsRow>(
        db,
        `SELECT config FROM datasources WHERE owner_id = ? AND id IN (${dsIds.map(() => '?').join(',')})`,
        share.owner_id, ...dsIds,
      )
      for (const r of rows) {
        try {
          datasources.push(JSON.parse(r.config) as DataSourceConfig)
        } catch { /* 跳过损坏项 */ }
      }
    }

    // 清理敏感元信息
    delete page.meta?.createdBy
    return c.json({ page, datasources })
  })

  return app
}
