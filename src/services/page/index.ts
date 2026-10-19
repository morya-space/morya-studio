/**
 * 面板持久化服务：后端为权威源，内存缓存只保存已确认的服务端结果。
 * 读操作保持同步；写操作返回 Promise，调用方必须处理失败。
 */

import type { PageSchema } from '../../types/schema'
import { SCHEMA_VERSION } from '../../types/schema'
import { migrateSchema } from '../../engine/migrate'
import { http } from '../../lib/http'

const cache = new Map<string, PageSchema>()
const writes = new Map<string, Promise<void>>()
let loaded = false
let loading: Promise<void> | null = null

function normalizePage(page: PageSchema): PageSchema {
  const now = new Date().toISOString()
  const migrated = migrateSchema(page)
  return {
    ...migrated,
    meta: {
      ...migrated.meta,
      version: SCHEMA_VERSION,
      createdAt: migrated.meta?.createdAt ?? now,
      updatedAt: now,
    },
  }
}

function queueWrite(id: string, write: () => Promise<void>): Promise<void> {
  const previous = writes.get(id) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(write)
  writes.set(id, next)
  void next.finally(() => {
    if (writes.get(id) === next) writes.delete(id)
  }).catch(() => undefined)
  return next
}

/** 登录后调用：从后端拉取面板填充缓存；失败会保留旧缓存并允许重试。 */
export async function initPages(force = false): Promise<void> {
  if (loaded && !force) return
  if (loading) return loading
  loading = (async () => {
    const { items } = await http.get<{ items: PageSchema[] }>('/pages')
    cache.clear()
    for (const page of items) cache.set(page.id, migrateSchema(page))
    loaded = true
  })()
  try {
    await loading
  } finally {
    loading = null
  }
}

/** 登出/切换账号时清空缓存。 */
export function resetPages(): void {
  cache.clear()
  writes.clear()
  loaded = false
  loading = null
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

/** 保存页面；同一 pageId 的操作按调用顺序完成，失败时缓存不改变。 */
export function savePage(page: PageSchema): Promise<void> {
  const next = normalizePage(page)
  return queueWrite(next.id, async () => {
    const exists = cache.has(next.id)
    const response = exists
      ? await http.put<{ page: PageSchema }>(`/pages/${next.id}`, next)
      : await http.post<{ page: PageSchema }>('/pages', next)
    cache.set(next.id, migrateSchema(response.page))
    loaded = true
  })
}

/** 删除页面；只有服务端确认删除后才移除缓存。 */
export function deletePage(id: string): Promise<void> {
  return queueWrite(id, async () => {
    await http.delete(`/pages/${id}`)
    cache.delete(id)
  })
}

export function exportPage(id: string): string | null {
  const page = getPage(id)
  return page ? JSON.stringify(page, null, 2) : null
}

/** 解析、迁移并可靠保存导入的页面。 */
export async function importPage(json: string): Promise<PageSchema> {
  const raw: unknown = JSON.parse(json)
  if (!raw || typeof raw !== 'object' || !('id' in raw) || !Array.isArray((raw as PageSchema).cards)) {
    throw new Error('非法的页面 JSON：缺少 id 或 cards')
  }
  const imported = migrateSchema(raw)
  // 导入绝不覆盖同 ID 的现有面板；面板列表据返回 ID 提示用户。
  const page = cache.has(imported.id)
    ? { ...imported, id: genPageId(), meta: { ...imported.meta, createdAt: undefined, updatedAt: undefined } }
    : imported
  await savePage(page)
  return getPage(page.id) ?? page
}

/** 生成新页面 id。 */
export function genPageId(): string {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// ==================== 版本历史 ====================

export interface PageVersion {
  id: string
  pageId: string
  version: number
  createdAt: string
  schema: PageSchema
}

export async function listVersions(pageId: string): Promise<PageVersion[]> {
  const { items } = await http.get<{ items: PageVersion[] }>(`/pages/${pageId}/versions`)
  return items.map(item => ({ ...item, schema: migrateSchema(item.schema) }))
}

/** 回滚前由服务端保存当前快照；确认成功后再替换本地缓存。 */
export function restoreVersion(pageId: string, versionId: string): Promise<PageSchema> {
  return queueWrite(pageId, async () => {
    const { page } = await http.post<{ page: PageSchema }>(`/pages/${pageId}/restore/${versionId}`)
    cache.set(page.id, migrateSchema(page))
    loaded = true
  }).then(() => {
    const page = getPage(pageId)
    if (!page) throw new Error('回滚成功但未返回页面数据')
    return page
  })
}
