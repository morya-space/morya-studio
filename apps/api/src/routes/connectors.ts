/**
 * 连接器路由：把外部数据接入平台，落地为标准数据源。
 * MVP 提供文件导入（multipart 上传 CSV/JSON → 解析 → static 数据源）。
 * 数据库直连（MySQL/PG 等）预留为后续能力。
 */

import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import type { DataSourceConfig } from '@morya-studio/shared'
import type { AppBindings } from '../types/context'
import { requireAuth, requirePermission } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'
import type { DatasourceStores } from './datasources'

// ---------- 解析（与前端 services/connector 同规则） ----------

function coerce(v: string): unknown {
  const s = v.trim()
  if (s === '') return ''
  if (s === 'true') return true
  if (s === 'false') return false
  if (!Number.isNaN(Number(s)) && s !== '') return Number(s)
  return s
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  const firstLine = text.slice(0, text.indexOf('\n') + 1 || text.length)
  const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      cur.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      cur.push(field); field = ''
      if (cur.length > 1 || cur[0] !== '') rows.push(cur)
      cur = []
    } else field += c
  }
  if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur) }
  return rows
}

function parseCSV(text: string): Record<string, unknown>[] {
  const rows = splitCsvRows(text)
  if (rows.length === 0) return []
  const headers = rows[0].map(h => h.trim())
  const out: Record<string, unknown>[] = []
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if (cells.length === 1 && cells[0] === '') continue
    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => { row[h || `col_${idx + 1}`] = coerce(cells[idx] ?? '') })
    out.push(row)
  }
  return out
}

function parseJSON(text: string): Record<string, unknown>[] {
  const data = JSON.parse(text) as unknown
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    for (const key of ['data', 'list', 'rows', 'items', 'result']) {
      const v = (data as Record<string, unknown>)[key]
      if (Array.isArray(v)) return v as Record<string, unknown>[]
    }
    return [data as Record<string, unknown>]
  }
  return []
}

function parseFileText(fileName: string, text: string): Record<string, unknown>[] {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'json') return parseJSON(text)
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return parseCSV(text)
  try { return parseJSON(text) } catch { return parseCSV(text) }
}

// ---------- 路由 ----------

export function createConnectorRoutes(stores: DatasourceStores) {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  /**
   * POST /api/connectors/import-file (multipart)
   * 字段: file (File), name? (string) → 创建 static 数据源
   */
  app.post('/import-file', requirePermission('datasource:write'), async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) throw new ApiError(400, 'invalid_input', '缺少上传文件')
    const nameField = typeof body.name === 'string' ? body.name.trim() : ''
    const text = await file.text()
    let rows: Record<string, unknown>[]
    try {
      rows = parseFileText(file.name, text)
    } catch {
      throw new ApiError(400, 'parse_failed', '文件解析失败，请确认是 CSV 或 JSON')
    }
    if (rows.length === 0) throw new ApiError(400, 'empty_data', '未解析到任何数据行')
    const ds: DataSourceConfig = {
      id: randomUUID(),
      name: nameField || file.name.replace(/\.[^.]+$/, ''),
      type: 'static',
      staticData: rows,
    }
    const rec = stores.datasources.create(c.get('user').id, ds, ds.id)
    return c.json({ datasource: rec.payload, rows: rows.length }, 201)
  })

  return app
}
