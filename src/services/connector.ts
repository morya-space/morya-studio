/**
 * 连接器服务（MVP：纯前端实现）
 * 连接器 = 把外部数据接入平台，落地为标准数据源（services/datasource）。
 * - 文件连接器：解析 CSV / JSON 文本为行数组，生成 static 数据源。
 * - 数据库连接器：MVP 通过 REST 桥接 URL 连接，生成 api 数据源；
 *   直连 MySQL / PostgreSQL 等需后端代理，预留为后续能力。
 */

import type { DataSourceConfig } from '../types/schema'
import { saveDataSource, genDataSourceId } from './datasource'

// ==================== CSV / JSON 解析 ====================

/** 解析 CSV 文本为行数组（支持带表头、引号转义、逗号/分号/Tab 分隔） */
export function parseCSV(text: string): Record<string, unknown>[] {
  const rows = splitCsvRows(text)
  if (rows.length === 0) return []
  const headers = rows[0].map(h => h.trim())
  const out: Record<string, unknown>[] = []
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if (cells.length === 1 && cells[0] === '') continue
    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      row[h || `col_${idx + 1}`] = coerce(cells[idx] ?? '')
    })
    out.push(row)
  }
  return out
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  // 探测分隔符
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

/** 数字 / 布尔 / 空 自动转型 */
function coerce(v: string): unknown {
  const s = v.trim()
  if (s === '') return ''
  if (s === 'true') return true
  if (s === 'false') return false
  if (!Number.isNaN(Number(s)) && s !== '') return Number(s)
  return s
}

/** 解析 JSON 文本为行数组（取首个数组，或包装对象） */
export function parseJSON(text: string): Record<string, unknown>[] {
  const data = JSON.parse(text) as unknown
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  // 常见包一层 { data: [...] } / { list: [...] } / { rows: [...] }
  if (data && typeof data === 'object') {
    for (const key of ['data', 'list', 'rows', 'items', 'result']) {
      const v = (data as Record<string, unknown>)[key]
      if (Array.isArray(v)) return v as Record<string, unknown>[]
    }
    return [data as Record<string, unknown>]
  }
  return []
}

/** 按扩展名解析文件文本 */
export function parseFileText(fileName: string, text: string): Record<string, unknown>[] {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'json') return parseJSON(text)
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return parseCSV(text)
  // 默认尝试 JSON，失败退回 CSV
  try { return parseJSON(text) } catch { return parseCSV(text) }
}

// ==================== 生成数据源 ====================

/** 文件导入 → static 数据源 */
export function importFileAsDataSource(name: string, fileName: string, text: string): DataSourceConfig {
  const rows = parseFileText(fileName, text)
  return importRowsAsDataSource(name || fileName.replace(/\.[^.]+$/, ''), rows)
}

/** 已解析的行数据 → static 数据源 */
export function importRowsAsDataSource(name: string, rows: Record<string, unknown>[]): DataSourceConfig {
  if (rows.length === 0) throw new Error('未解析到任何数据行，请检查文件内容')
  const ds: DataSourceConfig = {
    id: genDataSourceId(),
    name,
    type: 'static',
    staticData: rows,
  }
  saveDataSource(ds)
  return ds
}

export interface DbConnectInput {
  name: string
  /** 数据库类型（展示/后续直连用） */
  driver: 'mysql' | 'postgresql' | 'sqlserver' | 'rest'
  /** REST 桥接 URL（MVP 必填） */
  url: string
  dataPath?: string
  method?: 'GET' | 'POST'
}

/**
 * 数据库导入 → api 数据源（MVP 经 REST 桥接）。
 * 直连数据库需后端代理，这里把连接配置落成 api 数据源，运行时经桥接拉取。
 */
export function importDatabaseAsDataSource(input: DbConnectInput): DataSourceConfig {
  if (!input.url?.trim()) throw new Error('请填写连接地址（REST 桥接 URL）')
  const ds: DataSourceConfig = {
    id: genDataSourceId(),
    name: input.name || `${input.driver} 连接`,
    type: 'api',
    url: input.url.trim(),
    method: input.method ?? 'GET',
    dataPath: input.dataPath?.trim() || undefined,
  }
  saveDataSource(ds)
  return ds
}
