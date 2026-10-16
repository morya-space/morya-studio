/**
 * SQL 数据源代理：在服务端执行只读查询（解决浏览器 CORS + 不暴露 DB 凭证）。
 * 仅允许 SELECT / WITH 单条只读语句；结果行数上限截断（防御性）。
 */

import { Hono } from 'hono'
import mysql from 'mysql2/promise'
import type { DataSourceConfig } from '@morya-studio/shared'
import type { AppBindings } from '../types/context'
import { requireAuth, requirePermission } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'

const READONLY_RE = /^\s*(select|with)\b/i
const MULTI_STMT_RE = /;\s*(select|with|insert|update|delete|drop|alter|create|truncate|exec|execute)\b/i

export function createSqlProxyRoutes() {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  app.post('/query', requirePermission('datasource:read'), async (c) => {
    const body = await c.req.json().catch(() => null) as { config?: DataSourceConfig } | null
    const sql = body?.config?.sql
    if (!sql?.query?.trim()) throw new ApiError(400, 'invalid_input', '缺少 SQL 查询语句')

    const query = sql.query.trim()
    if (!READONLY_RE.test(query)) throw new ApiError(400, 'forbidden_sql', '仅允许 SELECT / WITH 只读查询')
    if (MULTI_STMT_RE.test(query)) throw new ApiError(400, 'forbidden_sql', '不允许一次执行多条语句')

    const limit = Math.max(1, Math.min(sql.limit ?? 1000, 5000))

    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null
    try {
      conn = await mysql.createConnection({
        host: sql.host || 'localhost',
        port: sql.port || 3306,
        database: sql.database,
        user: sql.user,
        password: sql.password ?? '',
      })
      const [rows] = await conn.query({ sql: query, rowsAsArray: false })
      const arr = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[]
      const sliced = arr.slice(0, limit)
      const out = sliced.map(row =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
        ),
      )
      return c.json({ ok: true, rows: out, count: arr.length, truncated: arr.length > limit })
    } catch (e) {
      return c.json({ ok: false, message: e instanceof Error ? e.message : String(e) }, 400)
    } finally {
      conn?.end().catch(() => undefined)
    }
  })

  return app
}
