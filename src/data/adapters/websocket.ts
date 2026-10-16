/**
 * WebSocket 数据源适配器（快照模式）
 * 连接 wsUrl，收集首批消息（JSON）后关闭连接返回；用于数据看板的一次性快照。
 * 持续订阅/推送属远期能力（需 adapter 支持流式回调），此处不阻塞使用。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, TestResult } from './base'

function normalizeMessage(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return { message: data } as unknown as Record<string, unknown>
  if (data && typeof data === 'object') return data as Record<string, unknown>
  return { value: data }
}

/** 收集首批消息，超时或收到消息后返回 */
function collectRows(url: string, timeout: number): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (e) {
      reject(e instanceof Error ? e : new Error('WebSocket 连接失败'))
      return
    }

    const rows: Record<string, unknown>[] = []
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch { /* ignore */ }
      resolve(rows)
    }

    const timer = setTimeout(finish, timeout)

    ws.onopen = () => { /* 等待消息 */ }
    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as unknown
        if (Array.isArray(parsed)) {
          for (const item of parsed) rows.push(normalizeMessage(item))
        } else {
          rows.push(normalizeMessage(parsed))
        }
      } catch {
        rows.push({ value: String(ev.data) })
      }
      finish()
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

export const websocketAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig) {
    if (!config.wsUrl) throw new Error('[ws adapter] dataSource.wsUrl is required')
    return collectRows(config.wsUrl, 2000)
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    if (!config.wsUrl) return { ok: false, message: '缺少 wsUrl' }
    try {
      const rows = await collectRows(config.wsUrl, 1500)
      return {
        ok: true,
        message: `已接收 ${rows.length} 条消息`,
        sampleRows: rows.length,
        sample: rows.slice(0, 3),
      }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  },
}
