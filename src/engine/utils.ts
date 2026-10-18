/**
 * 引擎纯函数工具
 */

import type { CardSchema } from '../types/schema'

/** 按 order 排序卡片（order 缺省视为 0，稳定排序） */
export function sortCards(cards: CardSchema[]): CardSchema[] {
  return [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** 计算卡片在 CSS Grid 中的跨列样式 */
export function getCardGridStyle(card: CardSchema, cols: number = 12): Record<string, string> {
  const span = clamp(card.span ?? cols, 1, cols)
  return { gridColumn: `span ${span}` }
}

/** 生成卡片唯一 key */
export function getCardKey(card: CardSchema): string {
  return `card-${card.id}-${card.type}`
}

/** 数据型卡片：需要数据源才能渲染的类型 */
export const DATA_CARD_TYPES = ['stat', 'chart', 'table', 'list'] as const

/** 卡片数据源引用列表（dataSourceIds 优先，兼容单源 dataSourceId） */
export function cardDataSourceIds(card: CardSchema): string[] {
  if (card.dataSourceIds?.length) return card.dataSourceIds
  return card.dataSourceId ? [card.dataSourceId] : []
}

/** 卡片是否需要数据源但尚未绑定（编辑态显示占位图） */
export function cardNeedsDataSource(card: CardSchema): boolean {
  return (DATA_CARD_TYPES as readonly string[]).includes(card.type)
    && cardDataSourceIds(card).length === 0
    && !card.dataSource
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
