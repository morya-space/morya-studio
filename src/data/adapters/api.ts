/**
 * REST API 数据源适配器（v0.2）
 * 支持：认证注入、{{var}} 参数插值、dataPath 取数。
 * 契约见 docs/DESIGN-DEV.md §6.2。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, FetchContext, TestResult } from './base'
import { ensureArray, getByPath } from './base'

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

function buildUrl(config: DataSourceConfig, queryParams: Record<string, unknown>): string {
  const url = config.url ?? ''
  if (config.method === 'POST') return url
  const entries = Object.entries(queryParams).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return url
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

export const apiAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig, ctx?: FetchContext) {
    if (!config.url) throw new Error('[api adapter] dataSource.url is required')

    const ctxParams = ctx?.params ?? {}
    const params = interpolateParams(config.params, ctxParams)
    const url = buildUrl(config, params)
    const headers = buildHeaders(config)

    const isPost = config.method === 'POST'
    const response = await fetch(url, {
      method: config.method ?? 'GET',
      headers: isPost ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: isPost ? JSON.stringify(params) : undefined,
      signal: ctx?.signal,
    })

    if (!response.ok) {
      throw new Error(`[api adapter] request failed: ${response.status} ${response.statusText}`)
    }

    const json: unknown = await response.json()
    const data = config.dataPath ? getByPath(json, config.dataPath) : json
    return ensureArray(data)
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    if (!config.url) return { ok: false, message: '缺少 url' }
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
