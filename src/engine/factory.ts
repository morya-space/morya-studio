import type { CardSchema, CardType, ComponentMapping } from '../types/schema'

/**
 * 组件工厂
 * 根据 CardSchema 动态映射到对应的渲染组件
 */
export class ComponentFactory {
  private static mappings: Map<CardType, ComponentMapping> = new Map([
    ['stat', { type: 'stat', component: 'StatCard' }],
    ['chart', { type: 'chart', component: 'ChartCard' }],
    ['table', { type: 'table', component: 'TableCard' }],
    ['list', { type: 'list', component: 'ListCard' }],
    ['banner', { type: 'banner', component: 'BannerCard' }],
    ['custom', { type: 'custom', component: 'CustomCard' }],
  ])

  static register(type: CardType, mapping: ComponentMapping): void {
    this.mappings.set(type, mapping)
  }

  static getComponent(type: CardType): ComponentMapping | undefined {
    return this.mappings.get(type)
  }

  static getAllTypes(): CardType[] {
    return Array.from(this.mappings.keys())
  }
}

/**
 * 按 order 排序卡片
 */
export function sortCards(cards: CardSchema[]): CardSchema[] {
  return [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * 计算栅格样式
 */
export function getGridStyle(span: number = 12, cols: number = 12, gap: number = 24): Record<string, string> {
  const percentage = (span / cols) * 100
  const gapCount = Math.ceil(cols / span) - 1
  const gapOffset = gapCount > 0 ? (gap * gapCount) / (cols / span) : 0
  return {
    width: `calc(${percentage}% - ${gapOffset}px)`,
    flexShrink: '0',
  }
}

/**
 * 生成卡片唯一 key
 */
export function getCardKey(card: CardSchema): string {
  return `card-${card.id}-${card.type}`
}

/**
 * 验证 Schema 完整性
 */
export function validateCard(card: CardSchema): { valid: boolean, errors: string[] } {
  const errors: string[] = []

  if (!card.id) errors.push('Card id is required')
  if (!card.type) errors.push('Card type is required')
  if (!card.dataSource) errors.push('Card dataSource is required')

  if (card.type === 'chart' && !card.chart) {
    errors.push('Chart card requires chart config')
  }
  if (card.type === 'stat' && !card.stat) {
    errors.push('Stat card requires stat config')
  }
  if (card.type === 'table' && !card.table) {
    errors.push('Table card requires table config')
  }
  if (card.type === 'list' && !card.list) {
    errors.push('List card requires list config')
  }

  return { valid: errors.length === 0, errors }
}
