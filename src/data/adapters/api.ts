/**
 * REST API 数据源适配器
 * 支持：认证注入、{{var}} 参数插值、dataPath 取数、方法/请求体、超时、失败重试。
 * 契约见 docs/DESIGN-DEV.md §6.2。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, FetchContext, TestResult } from './base'
import { ensureArray, getByPath } from './base'

const DEFAULT_TIMEOUT = 15000
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** 把字符串里的 {{var}} 用 params 里的值替换 */
export function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = getByPath(params, key)
    return value === undefined || value === null ? match : String(value)
  })
}

/** 递归对 params 里的字符串值做插值 */
function interpolateParams(
  params: Record<string, unknown> | undefined,
  ctxParams: Record<string, unknown>,
): Record<string, unknown> {
  if (!params) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') out[k] = interpolate(v, ctxParams)
    else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = interpolateParams(v as Record<string, unknown>, ctxParams)
    } else out[k] = v
  }
  return out
}

/** 根据 auth 配置构造请求头 */
function buildHeaders(config: DataSourceConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(config.headers ?? {}),
  }
  const auth = config.auth
  if (!auth || auth.type === 'none') return headers

  switch (auth.type) {
    case 'bearer':
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`
      break
    case 'apikey':
      if (auth.apiKeyName && auth.apiKeyValue) headers[auth.apiKeyName] = auth.apiKeyValue
      break
    case 'basic': {
      const raw = `${auth.username ?? ''}:${auth.password ?? ''}`
      headers.Authorization = `Basic ${btoa(raw)}`
      break
    }
  }
  return headers
}

function appendQuery(url: string, queryParams: Record<string, unknown>): string {
  const entries = Object.entries(queryParams).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return url
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

function buildUrl(config: DataSourceConfig, queryParams: Record<string, unknown>): string {
  const url = config.url ?? ''
  const method = config.method ?? 'GET'
  // 带请求体的方法：只有配置了显式 body 时才把参数拼到 query
  if (BODY_METHODS.has(method) && (config.bodyType ?? 'json') !== 'none') {
    return config.body ? appendQuery(url, queryParams) : url
  }
  return appendQuery(url, queryParams)
}

/** 构造请求体 */
function buildBody(config: DataSourceConfig, params: Record<string, unknown>): { body?: string; contentType?: string } {
  const type = config.bodyType ?? 'json'
  if (type === 'none') return {}
  if (config.body) {
    return {
      body: config.body,
      contentType: type === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
    }
  }
  if (type === 'json') return { body: JSON.stringify(params), contentType: 'application/json' }
  return {
    body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString(),
    contentType: 'application/x-www-form-urlencoded',
  }
}

interface RawResponse {
  ok: boolean
  status: number
  statusText: string
  json: unknown
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** 只发一次请求，返回状态与解析后的 JSON（不抛网络/HTTP 错误，交由上层处理） */
async function requestRaw(config: DataSourceConfig, ctx: FetchContext | undefined): Promise<RawResponse> {
  const ctxParams = ctx?.params ?? {}
  const params = interpolateParams(config.params, ctxParams)
  const url = buildUrl(config, params)
  const headers = buildHeaders(config)
  const method = config.method ?? 'GET'
  const useBody = BODY_METHODS.has(method)
  const { body, contentType } = useBody ? buildBody(config, params) : {}

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT
  const controller = new AbortController()
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined
  const onAbort = () => controller.abort()
  ctx?.signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch(url, {
      method,
      headers: contentType ? { 'Content-Type': contentType, ...headers } : headers,
      body,
      signal: controller.signal,
    })
    let json: unknown = null
    try { json = await res.json() } catch { json = null }
    return { ok: res.ok, status: res.status, statusText: res.statusText, json }
  } finally {
    if (timer) clearTimeout(timer)
    ctx?.signal?.removeEventListener('abort', onAbort)
  }
}

/** 带重试的请求；成功返回解析后的行数组 */
async function requestWithRetry(
  config: DataSourceConfig,
  ctx: FetchContext | undefined,
): Promise<{ rows: Record<string, unknown>[]; status: number; raw: unknown }> {
  const retryCount = Math.max(0, config.retry?.count ?? 0)
  const delayMs = Math.max(0, config.retry?.delayMs ?? 500)
  let lastError: unknown

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const { ok, status, statusText, json } = await requestRaw(config, ctx)
      if (!ok) throw new Error(`[api adapter] request failed: ${status} ${statusText}`)
      const data = config.dataPath ? getByPath(json, config.dataPath) : json
      return { rows: ensureArray(data), status, raw: json }
    } catch (e) {
      lastError = e
      if (attempt < retryCount) await sleep(delayMs)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export const apiAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig, ctx?: FetchContext) {
    if (!config.url) throw new Error('[api adapter] dataSource.url is required')
    const { rows } = await requestWithRetry(config, ctx)
    return rows
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    if (!config.url) return { ok: false, message: '缺少 url' }
    const started = Date.now()
    try {
      const { rows, status, raw } = await requestWithRetry(config, undefined)
      return {
        ok: true,
        message: `成功，返回 ${rows.length} rows`,
        sampleRows: rows.length,
        sample: rows.slice(0, 3),
        rows,
        status,
        durationMs: Date.now() - started,
        raw,
      }
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      }
    }
  },
}
