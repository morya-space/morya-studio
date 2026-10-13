/**
 * 数据源适配器抽象（v0.2）
 * 契约见 docs/DESIGN-DEV.md §6.2。
 */

import type { DataSourceConfig } from '../../types/schema'

export interface FetchContext {
  /** 中止信号（页面切换 / 组件卸载时取消请求） */
  signal?: AbortSignal
  /** 全局过滤器等注入的参数，用于 api 参数插值 {{var}} */
  params?: Record<string, unknown>
}

export interface TestResult {
  ok: boolean
  message?: string
  /** 实际返回的数据行数（便于编辑器预览） */
  sampleRows?: number
  /** 前几行示例数据 */
  sample?: Record<string, unknown>[]
}

export interface DataSourceAdapter {
  /** 拉取数据，统一返回行数组 */
  fetch(config: DataSourceConfig, ctx?: FetchContext): Promise<Record<string, unknown>[]>
  /** 测试连接（编辑器"测试"按钮） */
  test?(config: DataSourceConfig): Promise<TestResult>
  /** 销毁（断开 WS、清理定时器等） */
  dispose?(): void
}

/**
 * 工具：按 lodash get 风格路径取值（"data.list" / "a.b.0.c"）。
 * 空路径返回原值。
 */
export function getByPath(source: unknown, path?: string): unknown {
  if (!path) return source
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let cur: unknown = source
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** 确保结果为数组：非数组包装一层，null/undefined 返回空数组 */
export function ensureArray(value: unknown): Record<string, unknown>[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value as Record<string, unknown>[]
  if (typeof value === 'object') return [value as Record<string, unknown>]
  return []
}
