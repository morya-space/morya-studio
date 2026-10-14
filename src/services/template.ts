/**
 * 模板本地持久化服务（MVP：localStorage）
 * 模板 = 可复用的面板快照（含卡片与数据源配置），创建面板时可直接套用。
 * 后续 Phase 切换为后端 API（接口保持不变）。
 */

import type { PageSchema } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'

const KEY = 'morya-studio:templates'

export interface PanelTemplate {
  id: string
  title: string
  description?: string
  /** 卡片数量（展示用） */
  cardCount: number
  /** 内置模板不可删除/编辑 */
  builtin?: boolean
  /** 模板封面图标（SvgIcon name） */
  icon?: string
  /** 面板快照 */
  page: PageSchema
  meta?: { createdAt?: string; updatedAt?: string }
}

type TemplateMap = Record<string, PanelTemplate>

function readMap(): TemplateMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as TemplateMap
  } catch {
    return {}
  }
}

function writeMap(map: TemplateMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {
    console.error('[template service] save failed', e)
    throw new Error('保存失败：本地存储空间不足')
  }
}

export function listTemplates(): PanelTemplate[] {
  return Object.values(readMap()).sort((a, b) => {
    const ta = a.meta?.updatedAt ?? a.meta?.createdAt ?? ''
    const tb = b.meta?.updatedAt ?? b.meta?.createdAt ?? ''
    return tb.localeCompare(ta)
  })
}

export function getTemplate(id: string): PanelTemplate | null {
  return readMap()[id] ?? null
}

export function saveTemplate(tpl: PanelTemplate): void {
  const map = readMap()
  const now = new Date().toISOString()
  map[tpl.id] = {
    ...tpl,
    meta: { createdAt: tpl.meta?.createdAt ?? now, updatedAt: now },
  }
  writeMap(map)
}

export function deleteTemplate(id: string): void {
  const map = readMap()
  delete map[id]
  writeMap(map)
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
