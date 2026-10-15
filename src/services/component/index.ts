/**
 * 自定义组件持久化服务：后端 API 为权威源，内存缓存提供同步读取。
 * 内置卡片组件来自引擎注册表（engine/registry），不在此服务内。
 */

import { http } from '../../lib/http'
import type { CardSchema } from '../../types/schema'

export interface CustomComponent {
  id: string
  name: string
  baseType: string
  description?: string
  icon?: string
  config: Partial<CardSchema>
  meta?: { createdAt?: string; updatedAt?: string }
}

const cache = new Map<string, CustomComponent>()
let loaded = false
let loading: Promise<void> | null = null

function reportSyncError(e: unknown): void {
  console.warn('[component service] 后端同步失败，本次变更仅保存在内存', e)
}

/** 登录后调用：从后端拉取自定义组件填充缓存（幂等） */
export async function initComponents(force = false): Promise<void> {
  if (loaded && !force) return
  if (loading) return loading
  loading = (async () => {
    try {
      const { items } = await http.get<{ items: CustomComponent[] }>('/components')
      cache.clear()
      for (const c of items) cache.set(c.id, c)
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
export function resetComponents(): void {
  cache.clear()
  loaded = false
}

export function listCustomComponents(): CustomComponent[] {
  return [...cache.values()].sort((a, b) => {
    const ta = a.meta?.updatedAt ?? a.meta?.createdAt ?? ''
    const tb = b.meta?.updatedAt ?? b.meta?.createdAt ?? ''
    return tb.localeCompare(ta)
  })
}

export function getCustomComponent(id: string): CustomComponent | null {
  return cache.get(id) ?? null
}

export function saveCustomComponent(comp: CustomComponent): void {
  if (!comp.id) throw new Error('组件缺少 id')
  const now = new Date().toISOString()
  const next: CustomComponent = {
    ...comp,
    meta: { createdAt: comp.meta?.createdAt ?? now, updatedAt: now },
  }
  const exists = cache.has(comp.id)
  cache.set(comp.id, next)
  const req = exists
    ? http.put(`/components/${comp.id}`, next)
    : http.post('/components', next)
  Promise.resolve(req).catch(reportSyncError)
}

export function deleteCustomComponent(id: string): void {
  cache.delete(id)
  http.delete(`/components/${id}`).catch(reportSyncError)
}

export function genComponentId(): string {
  return `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
