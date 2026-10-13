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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
