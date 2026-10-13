/**
 * 卡片组件统一契约
 * 见 docs/DESIGN-DEV.md §7.2
 */

import type { ActionConfig, CardSchema } from '../../types/schema'

export interface CardProps {
  schema: CardSchema
  data: Record<string, unknown>[]
  loading: boolean
  error: Error | null
}

export interface CardEmits {
  (e: 'action', action: ActionConfig): void
  (e: 'retry'): void
}
