/**
 * WebSocket 数据源适配器（快照模式）
 * 连接 wsUrl，按 config.ws.aggregate 收集消息（JSON）后返回。
 * 持久订阅/推送属远期能力（需 adapter 支持流式回调），此处不阻塞使用。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, TestResult } from './base'
import { getByPath } from './base'

function normalizeMessage(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return { message: data } as unknown as Record<string, unknown>
  if (data && typeof data === 'object') return data as Record<string, unknown>
  return { value: data }
}

function toRows(parsed: unknown, messagePath?: string): Record<string, unknown>[] {
  const target = messagePath ? getByPath(parsed, messagePath) : parsed
  if (Array.isArray(target)) return target.map(normalizeMessage)
  return [normalizeMessage(target)]
}

interface CollectOptions {
  messagePath?: string
  aggregate: 'first' | 'append' | 'replace'
  timeout: number
}

/** 收集消息：first 收到首条即返回；append/replace 累积到超时或关闭 */
function collectRows(url: string, opts: CollectOptions): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (e) {
      reject(e instanceof Error ? e : new Error('WebSocket 连接失败'))
      return
    }

    let rows: Record<string, unknown>[] = []
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch { /* ignore */ }
      resolve(rows)
    }

    const timer = setTimeout(finish, opts.timeout)

    ws.onopen = () => { /* 等待消息 */ }
    ws.onmessage = (ev) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(ev.data))
      } catch {
        parsed = String(ev.data)
      }
      const next = toRows(parsed, opts.messagePath)
      if (opts.aggregate === 'append') rows = [...rows, ...next]
      else rows = next
      if (opts.aggregate === 'first') finish()
    }
    ws.onerror = () => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(new Error('WebSocket 连接失败'))
      }
    }
    ws.onclose = () => finish()
  })
}

function optionsOf(config: DataSourceConfig): CollectOptions {
  return {
    messagePath: config.ws?.messagePath,
    aggregate: config.ws?.aggregate ?? 'first',
    timeout: config.timeoutMs ?? 3000,
  }
}

export const websocketAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig) {
    if (!config.wsUrl) throw new Error('[ws adapter] dataSource.wsUrl is required')
    return collectRows(config.wsUrl, optionsOf(config))
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    if (!config.wsUrl) return { ok: false, message: '缺少 wsUrl' }
    const started = Date.now()
    try {
      const rows = await collectRows(config.wsUrl, optionsOf(config))
      return {
        ok: true,
        message: `已接收 ${rows.length} 条消息`,
        sampleRows: rows.length,
        sample: rows.slice(0, 3),
        durationMs: Date.now() - started,
        raw: rows[0],
      }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e), durationMs: Date.now() - started }
    }
  },
}
