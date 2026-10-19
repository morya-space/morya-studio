/**
 * Schema 版本迁移（v0.2+）
 * 把任意来源的 PageSchema 升级到当前 SCHEMA_VERSION，补齐缺失的必填字段。
 * 调用点：页面加载 / 导入 / 模板实例化 / 编辑器 loadPage。
 */

import type { CardGroup, CardSchema, PageSchema } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 自由布局的默认卡片尺寸（与编辑器一致） */
const DEFAULT_FREE_SIZE: Record<string, { w: number; h: number }> = {
  chart: { w: 420, h: 250 },
  bar: { w: 420, h: 250 },
  line: { w: 420, h: 250 },
  area: { w: 420, h: 250 },
  pie: { w: 380, h: 250 },
  scatter: { w: 420, h: 250 },
  radar: { w: 380, h: 250 },
  funnel: { w: 360, h: 250 },
  gauge: { w: 300, h: 200 },
  barH: { w: 420, h: 250 },
  barLine: { w: 460, h: 260 },
  sankey: { w: 460, h: 280 },
  graph: { w: 420, h: 300 },
  heatmap: { w: 420, h: 280 },
  treeMap: { w: 420, h: 280 },
  wordCloud: { w: 380, h: 250 },
  waterPolo: { w: 240, h: 240 },
  earth3D: { w: 360, h: 360 },
  stat: { w: 250, h: 150 },
  table: { w: 460, h: 250 },
  list: { w: 380, h: 250 },
  banner: { w: 600, h: 120 },
  text: { w: 320, h: 80 },
  number: { w: 240, h: 120 },
  time: { w: 300, h: 72 },
  countdown: { w: 340, h: 100 },
  image: { w: 360, h: 220 },
  video: { w: 400, h: 240 },
  iframe: { w: 520, h: 320 },
  scrollTable: { w: 600, h: 300 },
  textGradient: { w: 360, h: 80 },
  barrage: { w: 480, h: 48 },
  carousel: { w: 480, h: 260 },
  formInput: { w: 260, h: 84 },
  formSelect: { w: 260, h: 84 },
  formTabs: { w: 320, h: 60 },
  pagination: { w: 360, h: 60 },
  icon: { w: 96, h: 96 },
  border: { w: 420, h: 260 },
  decoration: { w: 380, h: 64 },
  circlePoint: { w: 160, h: 160 },
  pipeline: { w: 420, h: 60 },
  flowLine: { w: 420, h: 80 },
  clock: { w: 240, h: 120 },
  fullScreen: { w: 140, h: 48 },
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
  // v0.3：锁定/隐藏状态默认值
  if (!c.status) c.status = { lock: false, hide: false }
  // 内联数据源补齐 id（供缓存 key 与请求去重使用）
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

  const layout: PageSchema['layout'] = page.layout === 'free' ? 'free' : 'grid'

  const out: PageSchema = {
    id: page.id ?? genId('page'),
    title: page.title ?? '未命名看板',
    description: page.description,
    layout,
    // v0.3：页面形态；旧页面由 layout 推断（free 视为 screen）
    mode: page.mode === 'screen' || page.mode === 'dashboard'
      ? page.mode
      : layout === 'free' ? 'screen' : 'dashboard',
    grid: page.grid ?? { cols: 12, gap: 24 },
    cards: Array.isArray(page.cards) ? page.cards.map(migrateCard) : [],
    groups: [],
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

  // v0.3：分组：补齐 id/order，并清理悬空的 groupId 引用
  const groups: CardGroup[] = Array.isArray(page.groups)
    ? page.groups.map((g, i) => ({ ...g, id: g.id ?? genId('group'), order: g.order ?? i }))
    : []
  out.groups = groups
  const groupIds = new Set(groups.map(g => g.id))
  out.cards.forEach(card => {
    if (card.groupId && !groupIds.has(card.groupId)) delete card.groupId
  })

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
