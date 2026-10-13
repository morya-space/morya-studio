/**
 * @deprecated v0.2 起用 engine/registry.ts 替代。
 * 本文件保留以兼容旧引用，内部转调 registry 与 utils。
 * 新代码请直接 import from './registry' 或 './utils'。
 */

import type { CardSchema, CardType, ComponentMapping } from '../types/schema'
import { getCardRegistration, registerCard, getAllCardTypes } from './registry'
import { sortCards, getCardGridStyle } from './utils'

export class ComponentFactory {
  /** @deprecated 用 registerCard 替代 */
  static register(type: CardType, mapping: ComponentMapping): void {
    registerCard({
      type,
      component: mapping.component as unknown as import('vue').Component,
      defaultConfig: () => ({}),
    })
  }

  /** @deprecated 用 getCardRegistration 替代 */
  static getComponent(type: CardType): ComponentMapping | undefined {
    const reg = getCardRegistration(type)
    if (!reg) return undefined
    return { type, component: reg.label ?? type }
  }

  /** @deprecated 用 getAllCardTypes 替代 */
  static getAllTypes(): CardType[] {
    return getAllCardTypes()
  }
}

/** @deprecated 用 engine/utils.ts 的 sortCards 替代 */
export { sortCards }

/** @deprecated CSS Grid 下用 getCardGridStyle 替代 */
export function getGridStyle(span: number = 12, cols: number = 12, gap: number = 24): Record<string, string> {
  return getCardGridStyle({ id: '', type: 'custom', span }, cols)
}

/** @deprecated 用 engine/utils.ts 的 getCardKey 替代 */
export { getCardKey } from './utils'

/** @deprecated 用 engine/validate.ts 的 validatePage 替代 */
export function validateCard(card: CardSchema): { valid: boolean, errors: string[] } {
  const errors: string[] = []
  if (!card.id) errors.push('Card id is required')
  if (!card.type) errors.push('Card type is required')
  if (!card.dataSource && !card.dataSourceId) errors.push('Card dataSource is required')
  if (card.type === 'chart' && !card.chart) errors.push('Chart card requires chart config')
  if (card.type === 'stat' && !card.stat) errors.push('Stat card requires stat config')
  if (card.type === 'table' && !card.table) errors.push('Table card requires table config')
  if (card.type === 'list' && !card.list) errors.push('List card requires list config')
  return { valid: errors.length === 0, errors }
}
