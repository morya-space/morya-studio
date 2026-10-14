/**
 * 面板持久化服务：后端 API 为权威源，内存缓存提供同步读取。
 * - 写操作（save/delete/import）同步更新内存，异步写后端（fire-and-forget + 错误上报）。
 * - 读操作（list/get/export）读内存缓存；initPages() 在登录后拉取后端数据填充缓存。
 * 这样编辑器/列表/工作台等既有同步调用方无需改动。
 */

import type { PageSchema } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'
import { http } from '../lib/http'

const cache = new Map<string, PageSchema>()
let loaded = false
let loading: Promise<void> | null = null

/** 标记后端可用性；网络失败时降级为纯内存（不阻塞本地编辑） */
function reportSyncError(e: unknown): void {
  console.warn('[page service] 后端同步失败，本次变更仅保存在内存', e)
}

/** 登录后调用：从后端拉取面板填充缓存（幂等） */
export async function initPages(force = false): Promise<void> {
  if (loaded && !force) return
  if (loading) return loading
  loading = (async () => {
    try {
      const { items } = await http.get<{ items: PageSchema[] }>('/pages')
      cache.clear()
      for (const p of items) cache.set(p.id, p)
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
export function resetPages(): void {
  cache.clear()
  loaded = false
}

export function listPages(): PageSchema[] {
  return [...cache.values()].sort((a, b) => {
    const ta = a.meta?.updatedAt ?? a.meta?.createdAt ?? ''
    const tb = b.meta?.updatedAt ?? b.meta?.createdAt ?? ''
    return tb.localeCompare(ta)
  })
}

export function getPage(id: string): PageSchema | null {
  return cache.get(id) ?? null
}

export function savePage(page: PageSchema): void {
  const now = new Date().toISOString()
  const exists = cache.has(page.id)
  const next: PageSchema = {
    ...page,
    meta: {
      ...page.meta,
      version: SCHEMA_VERSION,
      createdAt: page.meta?.createdAt ?? now,
      updatedAt: now,
    },
  }
  cache.set(page.id, next)
  // 异步写后端：已存在用 PUT，否则 POST
  const req = exists
    ? http.put(`/pages/${page.id}`, next)
    : http.post('/pages', next)
  Promise.resolve(req).catch(reportSyncError)
}

export function deletePage(id: string): void {
  cache.delete(id)
  http.delete(`/pages/${id}`).catch(reportSyncError)
}

export function exportPage(id: string): string | null {
  const page = getPage(id)
  return page ? JSON.stringify(page, null, 2) : null
}

export function importPage(json: string): PageSchema {
  const page = JSON.parse(json) as PageSchema
  if (!page.id || !Array.isArray(page.cards)) {
    throw new Error('非法的页面 JSON：缺少 id 或 cards')
  }
  page.meta = { ...page.meta, version: SCHEMA_VERSION }
  savePage(page)
  return page
}

/** 生成新页面 id */
export function genPageId(): string {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
