/**
 * SQL 数据源适配器：经后端代理执行只读查询（POST /api/datasources/query）。
 * 不使用全局 http 层（避免公开只读页上的 401 触发全局登出跳转），手动注入 token。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, TestResult } from './base'
import { getAuthToken } from '../../lib/http'

interface QueryResult {
  ok: boolean
  rows?: Record<string, unknown>[]
  message?: string
}

async function runQuery(config: DataSourceConfig): Promise<QueryResult> {
  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch('/api/datasources/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({ config }),
    })
  } catch {
    return { ok: false, message: '无法连接服务器，请确认后端已启动' }
  }

  const text = await res.text()
  const data = text ? (JSON.parse(text) as QueryResult) : { ok: false }
  if (!res.ok) return { ok: false, message: data.message ?? `查询失败（${res.status}）` }
  return data
}

export const sqlAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig) {
    if (!config.sql?.query?.trim()) throw new Error('[sql adapter] dataSource.sql.query is required')
    const result = await runQuery(config)
    if (!result.ok) throw new Error(result.message ?? 'SQL 查询失败')
    return result.rows ?? []
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    if (!config.sql?.query?.trim()) return { ok: false, message: '缺少 SQL 查询语句' }
    if (!config.sql.host) return { ok: false, message: '缺少数据库主机地址' }
    try {
      const rows = await this.fetch(config)
      return {
        ok: true,
        message: `成功，返回 ${rows.length} rows`,
        sampleRows: rows.length,
        sample: rows.slice(0, 3),
      }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  },
}
