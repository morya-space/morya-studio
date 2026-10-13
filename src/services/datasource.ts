/**
 * 数据源本地持久化服务（MVP：localStorage）
 * 后续 Phase 7 切换为后端 API。
 */

import type { DataSourceConfig } from '../types/schema'

const KEY = 'morya-studio:datasources'

type DsMap = Record<string, DataSourceConfig>

function readMap(): DsMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DsMap
  } catch {
    return {}
  }
}

function writeMap(map: DsMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {
    console.error('[datasource service] save failed', e)
    throw new Error('保存失败：本地存储空间不足')
  }
}

export function listDataSources(): DataSourceConfig[] {
  return Object.values(readMap())
}

export function getDataSource(id: string): DataSourceConfig | null {
  return readMap()[id] ?? null
}

export function saveDataSource(ds: DataSourceConfig): void {
  if (!ds.id) throw new Error('数据源缺少 id')
  const map = readMap()
  map[ds.id] = ds
  writeMap(map)
}

export function deleteDataSource(id: string): void {
  const map = readMap()
  delete map[id]
  writeMap(map)
}

export function genDataSourceId(): string {
  return `ds-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
