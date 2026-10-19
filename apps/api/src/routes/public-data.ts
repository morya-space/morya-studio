/**
 * 公开分享的数据执行器。
 * 浏览器只能传递已分享页面中的数据源标识，真实配置始终留在服务端。
 */

import { lookup } from 'node:dns/promises'
import https from 'node:https'
import { isIP } from 'node:net'
import mysql from 'mysql2/promise'
import type { DataSourceConfig, PageSchema } from '@morya-studio/shared'
import { ApiError } from '../middleware/error-handler'

const MAX_ROWS = 1000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const PRIVATE_V4 = /^(10\.|127\.|0\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/
const PRIVATE_V6 = /^(::1|fc|fd|fe80:)/i
const READ_ONLY_SQL = /^\s*(select|with)\b/i
const FORBIDDEN_SQL = /;|\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|call|exec|execute|load_file|outfile|dumpfile)\b/i

export interface PublicDataSource {
  id: string
  config: DataSourceConfig
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return PRIVATE_V4.test(address)
  return PRIVATE_V6.test(address)
}

async function parsePublicHttpsUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ApiError(422, 'unsupported_public_datasource', '公开数据源 URL 无效')
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
    throw new ApiError(422, 'unsupported_public_datasource', '公开 API 仅支持 HTTPS 公网地址')
  }

  return url
}

async function resolvePublicHost(hostname: string): Promise<string> {
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => [])
  const address = addresses[0]?.address
  if (!address || addresses.some(({ address: candidate }) => isPrivateAddress(candidate))) {
    throw new ApiError(422, 'unsupported_public_datasource', '公开数据源地址不可用')
  }
  return address
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (value === null || value === undefined) return []
  const values = Array.isArray(value) ? value : [value]
  return values
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item))
    .slice(0, MAX_ROWS)
}

function byPath(source: unknown, path?: string): unknown {
  if (!path) return source
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean).reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

async function fetchApi(config: DataSourceConfig): Promise<Record<string, unknown>[]> {
  if (!config.url || (config.method ?? 'GET') !== 'GET') {
    throw new ApiError(422, 'unsupported_public_datasource', '公开 API 数据源仅支持已配置的 GET 请求')
  }
  const url = await parsePublicHttpsUrl(config.url)
  for (const [key, value] of Object.entries(config.params ?? {})) {
    if (value !== undefined && value !== null && typeof value !== 'object') url.searchParams.append(key, String(value))
  }
  const address = await resolvePublicHost(url.hostname)
  const text = await new Promise<string>((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(config.headers ?? {}) },
      lookup: (_hostname, _options, callback) => callback(null, address, isIP(address) === 6 ? 6 : 4),
    }, (response) => {
      if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
        response.resume()
        reject(new ApiError(502, 'public_datasource_failed', '公开数据源响应失败'))
        return
      }
      if (Number(response.headers['content-length'] ?? 0) > MAX_RESPONSE_BYTES) {
        response.resume()
        reject(new ApiError(502, 'public_datasource_failed', '公开数据源响应过大'))
        return
      }
      let size = 0
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy()
          reject(new ApiError(502, 'public_datasource_failed', '公开数据源响应过大'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      response.on('error', () => reject(new ApiError(502, 'public_datasource_failed', '公开数据源请求失败')))
    })
    request.setTimeout(Math.min(Math.max(config.timeoutMs ?? 15000, 1000), 30000), () => request.destroy())
    request.on('error', () => reject(new ApiError(502, 'public_datasource_failed', '公开数据源请求失败')))
    request.end()
  })
  try {
    return normalizeRows(byPath(JSON.parse(text), config.dataPath))
  } catch {
    throw new ApiError(502, 'public_datasource_failed', '公开数据源未返回 JSON')
  }
}

async function fetchSql(config: DataSourceConfig): Promise<Record<string, unknown>[]> {
  const sql = config.sql
  if (!sql) throw new ApiError(422, 'unsupported_public_datasource', '公开 SQL 数据源配置不完整')
  const query = sql.query?.trim()
  if (!query || !READ_ONLY_SQL.test(query) || FORBIDDEN_SQL.test(query)) {
    throw new ApiError(422, 'unsupported_public_datasource', '公开 SQL 数据源必须是单条只读查询')
  }
  if (!sql.host || !sql.database || !sql.user) {
    throw new ApiError(422, 'unsupported_public_datasource', '公开 SQL 数据源配置不完整')
  }
  const host = await resolvePublicHost(sql.host)
  const connection = await mysql.createConnection({
    // 使用已校验的 IP，防止 DNS 重解析把连接导向私网地址。
    host,
    port: sql.port ?? 3306,
    database: sql.database,
    user: sql.user,
    password: sql.password ?? '',
    connectTimeout: 10000,
  }).catch(() => {
    throw new ApiError(502, 'public_datasource_failed', '公开 SQL 数据源连接失败')
  })
  try {
    const [rows] = await connection.query({ sql: query, rowsAsArray: false })
    return normalizeRows(rows).slice(0, Math.min(Math.max(sql.limit ?? MAX_ROWS, 1), MAX_ROWS)).map(row =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])),
    )
  } catch {
    throw new ApiError(502, 'public_datasource_failed', '公开 SQL 数据源查询失败')
  } finally {
    await connection.end().catch(() => undefined)
  }
}

/** 仅解析面板实际引用的数据源；不接受浏览器传入的配置。 */
export function collectPublicDataSources(
  page: PageSchema,
  stored: Map<string, DataSourceConfig>,
): Map<string, PublicDataSource> {
  const sources = new Map<string, PublicDataSource>()
  for (const card of page.cards ?? []) {
    if (card.dataSourceId) {
      const config = stored.get(card.dataSourceId)
      if (config) sources.set(card.dataSourceId, { id: card.dataSourceId, config })
      continue
    }
    if (card.dataSource) sources.set(`inline:${card.id}`, { id: `inline:${card.id}`, config: card.dataSource })
  }
  return sources
}

export async function executePublicDataSource(source: PublicDataSource): Promise<Record<string, unknown>[]> {
  switch (source.config.type) {
    case 'static':
      return normalizeRows(source.config.staticData)
    case 'mock':
      if (source.config.mockTemplate?.trim()) {
        throw new ApiError(422, 'unsupported_public_datasource', '公开 Mock 模板数据源不受支持')
      }
      return normalizeRows(source.config.staticData)
    case 'api':
      return fetchApi(source.config)
    case 'sql':
      return fetchSql(source.config)
    case 'websocket':
      throw new ApiError(422, 'unsupported_public_datasource', '公开 WebSocket 数据源不受支持')
  }
}
