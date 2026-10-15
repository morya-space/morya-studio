/**
 * 模板持久化服务：后端 API 为权威源，内存缓存提供同步读取。
 * 模板 = 可复用的面板快照（含卡片与数据源配置），创建面板时可直接套用。
 */

import type { PageSchema } from '../../types/schema'
import { SCHEMA_VERSION } from '../../types/schema'
import { http } from '../../lib/http'

export interface PanelTemplate {
  id: string
  title: string
  description?: string
  cardCount: number
  builtin?: boolean
  icon?: string
  page: PageSchema
  meta?: { createdAt?: string; updatedAt?: string }
}

const cache = new Map<string, PanelTemplate>()
let loaded = false
let loading: Promise<void> | null = null

function reportSyncError(e: unknown): void {
  console.warn('[template service] 后端同步失败，本次变更仅保存在内存', e)
}

/** 登录后调用：从后端拉取模板填充缓存（幂等） */
export async function initTemplates(force = false): Promise<void> {
  if (loaded && !force) return
  if (loading) return loading
  loading = (async () => {
    try {
      const { items } = await http.get<{ items: PanelTemplate[] }>('/templates')
      cache.clear()
      for (const t of items) cache.set(t.id, t)
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
export function resetTemplates(): void {
  cache.clear()
  loaded = false
}

export function listTemplates(): PanelTemplate[] {
  return [...cache.values()].sort((a, b) => {
    const ta = a.meta?.updatedAt ?? a.meta?.createdAt ?? ''
    const tb = b.meta?.updatedAt ?? b.meta?.createdAt ?? ''
    return tb.localeCompare(ta)
  })
}

export function getTemplate(id: string): PanelTemplate | null {
  return cache.get(id) ?? null
}

export function saveTemplate(tpl: PanelTemplate): void {
  const now = new Date().toISOString()
  const next: PanelTemplate = {
    ...tpl,
    meta: { createdAt: tpl.meta?.createdAt ?? now, updatedAt: now },
  }
  const exists = cache.has(tpl.id)
  cache.set(tpl.id, next)
  const req = exists
    ? http.put(`/templates/${tpl.id}`, next)
    : http.post('/templates', next)
  Promise.resolve(req).catch(reportSyncError)
}

export function deleteTemplate(id: string): void {
  cache.delete(id)
  http.delete(`/templates/${id}`).catch(reportSyncError)
}

export function genTemplateId(): string {
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 从现有面板生成模板（深拷贝，剥离页面 id） */
export function pageToTemplate(page: PageSchema, title: string, description?: string): PanelTemplate {
  const snapshot: PageSchema = JSON.parse(JSON.stringify(page)) as PageSchema
  snapshot.meta = { ...snapshot.meta, version: SCHEMA_VERSION }
  return {
    id: genTemplateId(),
    title,
    description,
    cardCount: snapshot.cards.length,
    icon: 'layout',
    page: snapshot,
  }
}
