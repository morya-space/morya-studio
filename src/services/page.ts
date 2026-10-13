/**
 * 页面本地持久化服务（MVP：localStorage）
 * 后续 Phase 7 切换为后端 API（接口保持不变）。
 * 契约见 docs/DESIGN-DEV.md §13.2。
 */

import type { PageSchema } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'

const KEY = 'morya-studio:pages'

type PageMap = Record<string, PageSchema>

function readMap(): PageMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PageMap
  } catch {
    return {}
  }
}

function writeMap(map: PageMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {
    // 配额超限等
    console.error('[page service] save failed', e)
    throw new Error('保存失败：本地存储空间不足，请导出备份后清理')
  }
}

export function listPages(): PageSchema[] {
  const map = readMap()
  return Object.values(map).sort((a, b) => {
    const ta = a.meta?.updatedAt ?? a.meta?.createdAt ?? ''
    const tb = b.meta?.updatedAt ?? b.meta?.createdAt ?? ''
    return tb.localeCompare(ta)
  })
}

export function getPage(id: string): PageSchema | null {
  return readMap()[id] ?? null
}

export function savePage(page: PageSchema): void {
  const map = readMap()
  const now = new Date().toISOString()
  map[page.id] = {
    ...page,
    meta: {
      ...page.meta,
      version: SCHEMA_VERSION,
      createdAt: page.meta?.createdAt ?? now,
      updatedAt: now,
    },
  }
  writeMap(map)
}

export function deletePage(id: string): void {
  const map = readMap()
  delete map[id]
  writeMap(map)
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
  // 迁移：补版本号
  page.meta = { ...page.meta, version: SCHEMA_VERSION }
  savePage(page)
  return page
}

/** 生成新页面 id */
export function genPageId(): string {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
