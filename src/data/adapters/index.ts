/**
 * 数据源适配器注册表（v0.2）
 * type → adapter。内置 static/api/mock/websocket/sql 在底部注册。
 */

import type { DataSourceType } from '../../types/schema'
import type { DataSourceAdapter } from './base'
import { staticAdapter } from './static'
import { apiAdapter } from './api'
import { mockAdapter } from './mock'
import { websocketAdapter } from './websocket'
import { sqlAdapter } from './sql'

const registry = new Map<DataSourceType, DataSourceAdapter>()

export function registerAdapter(type: DataSourceType, adapter: DataSourceAdapter): void {
  registry.set(type, adapter)
}

export function getAdapter(type: DataSourceType): DataSourceAdapter {
  const adapter = registry.get(type)
  if (!adapter) {
    throw new Error(`[data] No adapter registered for dataSource type: "${type}"`)
  }
  return adapter
}

export function hasAdapter(type: DataSourceType): boolean {
  return registry.has(type)
}

// 注册内置适配器
registerAdapter('static', staticAdapter)
registerAdapter('api', apiAdapter)
registerAdapter('mock', mockAdapter)
registerAdapter('websocket', websocketAdapter)
registerAdapter('sql', sqlAdapter)

export type { DataSourceAdapter, FetchContext, TestResult } from './base'
export { getByPath, ensureArray } from './base'
