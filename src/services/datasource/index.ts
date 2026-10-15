/**
 * 数据源持久化服务：后端 API 为权威源，内存缓存提供同步读取。
 * 与 page 服务同一模式：写操作同步更新内存 + 异步写后端；读操作走内存；
 * initDataSources() 在登录后拉取后端数据填充缓存。
 */

import type { DataSourceConfig } from '../../types/schema'
import { http } from '../../lib/http'

const cache = new Map<string, DataSourceConfig>()
let loaded = false
let loading: Promise<void> | null = null

function reportSyncError(e: unknown): void {
  console.warn('[datasource service] 后端同步失败，本次变更仅保存在内存', e)
}

/** 登录后调用：从后端拉取数据源填充缓存（幂等） */
export async function initDataSources(force = false): Promise<void> {
  if (loaded && !force) return
  if (loading) return loading
  loading = (async () => {
    try {
      const { items } = await http.get<{ items: DataSourceConfig[] }>('/datasources')
      cache.clear()
      for (const ds of items) if (ds.id) cache.set(ds.id, ds)
      loaded = true
    } catch (e) {
      reportSyncError(e)
    } finally {
      loading = null
    }
  })()
  return loading
}

/** 登出/切换账号时清空缓存 */
export function resetDataSources(): void {
  cache.clear()
  loaded = false
}

export function listDataSources(): DataSourceConfig[] {
  return [...cache.values()]
}

export function getDataSource(id: string): DataSourceConfig | null {
  return cache.get(id) ?? null
}

export function saveDataSource(ds: DataSourceConfig): void {
  if (!ds.id) throw new Error('数据源缺少 id')
  const exists = cache.has(ds.id)
  cache.set(ds.id, ds)
  const req = exists
    ? http.put(`/datasources/${ds.id}`, ds)
    : http.post('/datasources', ds)
  Promise.resolve(req).catch(reportSyncError)
}

export function deleteDataSource(id: string): void {
  cache.delete(id)
  http.delete(`/datasources/${id}`).catch(reportSyncError)
}

export function genDataSourceId(): string {
  return `ds-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
