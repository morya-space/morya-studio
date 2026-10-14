/**
 * 自定义组件本地持久化服务（MVP：localStorage）
 * 自定义组件 = 用户保存的可复用卡片配置（含默认样式与数据绑定）。
 * 内置卡片组件来自引擎注册表（engine/registry），不在此服务内。
 * 后续 Phase 切换为后端 API（接口保持不变）。
 */

import type { CardSchema } from '../types/schema'

const KEY = 'morya-studio:components'

export interface CustomComponent {
  id: string
  name: string
  /** 基于的卡片类型 */
  baseType: string
  description?: string
  icon?: string
  /** 可复用的卡片配置快照 */
  config: Partial<CardSchema>
  meta?: { createdAt?: string; updatedAt?: string }
}

type ComponentMap = Record<string, CustomComponent>

function readMap(): ComponentMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ComponentMap
  } catch {
    return {}
  }
}

function writeMap(map: ComponentMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {
    console.error('[component service] save failed', e)
    throw new Error('保存失败：本地存储空间不足')
  }
}

export function listCustomComponents(): CustomComponent[] {
  return Object.values(readMap()).sort((a, b) => {
    const ta = a.meta?.updatedAt ?? a.meta?.createdAt ?? ''
    const tb = b.meta?.updatedAt ?? b.meta?.createdAt ?? ''
    return tb.localeCompare(ta)
  })
}

export function getCustomComponent(id: string): CustomComponent | null {
  return readMap()[id] ?? null
}

export function saveCustomComponent(comp: CustomComponent): void {
  if (!comp.id) throw new Error('组件缺少 id')
  const map = readMap()
  const now = new Date().toISOString()
  map[comp.id] = {
    ...comp,
    meta: { createdAt: comp.meta?.createdAt ?? now, updatedAt: now },
  }
  writeMap(map)
}

export function deleteCustomComponent(id: string): void {
  const map = readMap()
  delete map[id]
  writeMap(map)
}

export function genComponentId(): string {
  return `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
