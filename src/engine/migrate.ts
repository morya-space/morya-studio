/**
 * Schema 版本迁移（v0.2）
 * 把任意来源的 PageSchema 升级到当前 SCHEMA_VERSION，补齐缺失的必填字段。
 * 调用点：页面加载 / 导入 / 模板实例化 / 编辑器 loadPage。
 */

import type { CardSchema, PageSchema } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 自由布局的默认卡片尺寸（与编辑器一致） */
const DEFAULT_FREE_SIZE: Record<string, { w: number; h: number }> = {
  stat: { w: 250, h: 130 },
  chart: { w: 420, h: 250 },
  table: { w: 460, h: 250 },
  list: { w: 380, h: 250 },
  banner: { w: 600, h: 120 },
  text: { w: 320, h: 66 },
  custom: { w: 320, h: 120 },
}

function freeSize(type: string): { w: number; h: number } {
  return DEFAULT_FREE_SIZE[type] ?? { w: 320, h: 200 }
}

function migrateCard(card: CardSchema): CardSchema {
  const c: CardSchema = { ...card }
  if (!c.id) c.id = genId('card')
  // v1 时代的 transform 是字符串，v0.2 起为 TransformStep[]；旧字符串字段移除
  if (typeof (c as unknown as { transform?: unknown }).transform === 'string') {
    delete (c as unknown as { transform?: unknown }).transform
  }
  // 内联数据源补充 id（供缓存 key 与请求去重使用）
  if (!c.dataSourceId && c.dataSource && !c.dataSource.id) {
    c.dataSource = { ...c.dataSource, id: `inline-${c.id}` }
  }
  if (c.span === undefined) {
    c.span = c.type === 'table' || c.type === 'banner' ? 12 : 6
  }
  if (c.order === undefined) c.order = 0
  return c
}

export function migrateSchema(input: unknown): PageSchema {
  const page = (input && typeof input === 'object' ? input : {}) as PageSchema

  const out: PageSchema = {
    id: page.id ?? genId('page'),
    title: page.title ?? '未命名看板',
    description: page.description,
    layout: page.layout === 'free' ? 'free' : 'grid',
    grid: page.grid ?? { cols: 12, gap: 24 },
    cards: Array.isArray(page.cards) ? page.cards.map(migrateCard) : [],
    theme: page.theme,
    canvas: page.canvas,
    filters: page.filters,
    meta: {
      ...(page.meta ?? {}),
      version: SCHEMA_VERSION,
      createdAt: page.meta?.createdAt,
      updatedAt: page.meta?.updatedAt,
    },
  }

  // 自由布局：补齐缺失的几何信息
  if (out.layout === 'free') {
    out.cards.forEach((card, i) => {
      const size = freeSize(card.type)
      if (card.x === undefined) card.x = 40 + (i % 4) * 40
      if (card.y === undefined) card.y = 40 + (i % 4) * 30
      if (card.w === undefined) card.w = size.w
      if (card.h === undefined) card.h = size.h
    })
  }

  return out
}

/** 迁移后是否与当前版本一致（导入校验用） */
export function isMigrated(page: PageSchema): boolean {
  return (page.meta?.version ?? 0) >= SCHEMA_VERSION
}
