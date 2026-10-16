/**
 * Schema 校验器（v0.2）
 * 契约见 docs/DESIGN-DEV.md §5.6。
 * 保存与渲染前调用；error 必须修复，warning 可说明后放过。
 */

import type { CardSchema, CardType, PageSchema, TransformStep } from '../types/schema'
import { validateExpr } from '../data/transform/expr'

export type ValidationLevel = 'error' | 'warning'

export interface ValidationIssue {
  level: ValidationLevel
  /** 问题定位路径，如 "cards[2].chart.xField" */
  path: string
  message: string
  /** 规则编号，便于文档对照与单测断言 */
  rule: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

/** 每种卡片类型必须携带的配置块字段（R2） */
const REQUIRED_CONFIG: Partial<Record<CardType, keyof CardSchema>> = {
  chart: 'chart',
  stat: 'stat',
  table: 'table',
  list: 'list',
  banner: 'banner',
  text: 'text',
  custom: 'custom',
}

const TRANSFORM_OPS = new Set(['filter', 'sort', 'limit', 'map', 'groupBy', 'rename'])

/**
 * 校验页面 Schema。
 * @param schema 页面 Schema
 * @param knownDataSourceIds 项目中已定义的数据源 ID 集合（用于 R3 引用检查）
 */
export function validatePage(
  schema: PageSchema,
  knownDataSourceIds: Set<string> = new Set(),
): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!schema) {
    return { valid: false, issues: [{ level: 'error', path: '', message: 'Schema is empty', rule: 'R0' }] }
  }

  const cards = schema.cards ?? []
  const cols = schema.grid?.cols ?? 12

  // R1：卡片 id 唯一
  collectDuplicate(cards.map(c => c.id)).forEach(id => {
    issues.push({ level: 'error', path: 'cards', message: `Duplicate card id: "${id}"`, rule: 'R1' })
  })

  // R7：order 重复（warning）
  const orders = cards.filter(c => c.order !== undefined).map(c => c.order as number)
  collectDuplicate(orders).forEach(ord => {
    issues.push({ level: 'warning', path: 'cards', message: `Duplicate card order: ${ord}`, rule: 'R7' })
  })

  cards.forEach((card, index) => {
    const base = `cards[${index}]`
    validateCard(card, base, { cols, knownDataSourceIds, issues })
  })

  return { valid: issues.every(i => i.level !== 'error'), issues }
}

interface CardContext {
  cols: number
  knownDataSourceIds: Set<string>
  issues: ValidationIssue[]
}

function validateCard(card: CardSchema, base: string, ctx: CardContext): void {
  const { cols, knownDataSourceIds, issues } = ctx
  const push = (level: ValidationLevel, path: string, message: string, rule: string) =>
    issues.push({ level, path: `${base}${path}`, message, rule })

  if (!card.id) push('error', '.id', 'Card id is required', 'R0')
  if (!card.type) push('error', '.type', 'Card type is required', 'R0')

  // R2：type 与配置块匹配
  const requiredKey = card.type ? REQUIRED_CONFIG[card.type] : undefined
  if (requiredKey && !card[requiredKey]) {
    push('error', `.${requiredKey}`, `Card type "${card.type}" requires "${requiredKey}" config`, 'R2')
  }

  // R3：数据源引用存在性；二选一校验
  const hasRef = Boolean(card.dataSourceId)
  const hasInline = Boolean(card.dataSource)
  if (!hasRef && !hasInline) {
    push('error', '.dataSourceId', 'Card requires dataSourceId or inline dataSource', 'R3')
  } else if (hasRef && !knownDataSourceIds.has(card.dataSourceId as string)) {
    push('error', '.dataSourceId', `Unknown dataSource id: "${card.dataSourceId}"`, 'R3')
  }

  // R4：span 范围
  if (card.span !== undefined && (card.span < 1 || card.span > cols)) {
    push('error', '.span', `span must be between 1 and ${cols}, got ${card.span}`, 'R4')
  }

  // R5：图表字段在静态数据中存在（warning，仅当可推断）
  if (card.type === 'chart' && card.chart) {
    const staticData = card.dataSource?.staticData
    if (Array.isArray(staticData) && staticData.length > 0) {
      const fields = new Set(Object.keys(staticData[0]))
      const { xField, yField } = card.chart
      if (xField && !fields.has(xField)) {
        push('warning', '.chart.xField', `xField "${xField}" not found in static data fields`, 'R5')
      }
      if (yField && !fields.has(yField)) {
        push('warning', '.chart.yField', `yField "${yField}" not found in static data fields`, 'R5')
      }
    }
  }

  // R6：transform 步骤合法 + 表达式可解析
  card.transform?.forEach((step, i) => {
    validateTransformStep(step, `${base}.transform[${i}]`, issues)
  })
}

function validateTransformStep(step: TransformStep, path: string, issues: ValidationIssue[]): void {
  if (!TRANSFORM_OPS.has(step.op)) {
    issues.push({ level: 'error', path, message: `Unknown transform op: "${(step as { op: string }).op}"`, rule: 'R6' })
    return
  }

  // filter / map 的表达式需可解析
  if ((step.op === 'filter' || step.op === 'map') && 'expr' in step) {
    const r = validateExpr(step.expr)
    if (!r.ok) {
      issues.push({ level: 'error', path: `${path}.expr`, message: `Invalid expression: ${r.error}`, rule: 'R6' })
    }
  }

  if (step.op === 'sort' && !step.field) {
    issues.push({ level: 'error', path: `${path}.field`, message: 'sort step requires field', rule: 'R6' })
  }
  if (step.op === 'limit' && (typeof step.count !== 'number' || step.count < 0)) {
    issues.push({ level: 'error', path: `${path}.count`, message: 'limit step requires non-negative count', rule: 'R6' })
  }
  if (step.op === 'groupBy' && !step.field) {
    issues.push({ level: 'error', path: `${path}.field`, message: 'groupBy step requires field', rule: 'R6' })
  }
}

function collectDuplicate<T>(items: T[]): T[] {
  const seen = new Set<T>()
  const dup = new Set<T>()
  for (const item of items) {
    if (item === undefined || item === null || item === '') continue
    if (seen.has(item)) dup.add(item)
    seen.add(item)
  }
  return [...dup]
}
