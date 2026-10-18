/**
 * Transform 管道执行器（v0.2）
 * 按顺序对数据行应用一组 TransformStep。
 * 契约见 docs/DESIGN-DEV.md §5.5。
 */

import type { TransformStep } from '../../types/schema'
import { compileExpr } from './expr'

type Row = Record<string, unknown>

/**
 * 对 rows 依次应用 steps，返回处理后的新数组。
 * 空 steps 直接返回原数组（浅拷贝，避免外部意外修改）。
 */
export function applyTransform(rows: Row[], steps: TransformStep[] = []): Row[] {
  if (!Array.isArray(rows)) return []
  if (steps.length === 0) return [...rows]

  return steps.reduce<Row[]>((acc, step) => applyStep(acc, step), [...rows])
}

function applyStep(rows: Row[], step: TransformStep): Row[] {
  switch (step.op) {
    case 'filter':
      return filterRows(rows, step.expr)
    case 'sort':
      return sortRows(rows, step.field, step.order ?? 'asc')
    case 'limit':
      return rows.slice(0, Math.max(0, step.count))
    case 'map':
      return mapRows(rows, step.expr)
    case 'groupBy':
      return groupByRows(rows, step.field, step.aggs)
    case 'rename':
      return renameRows(rows, step.fields)
    case 'pick':
      return pickRows(rows, step.fields)
    default: {
      // 未知 op —— 类型系统已收敛，这里防御性跳过
      console.warn('[transform] unknown step op', step)
      return rows
    }
  }
}

function filterRows(rows: Row[], expr: string): Row[] {
  const fn = compileExpr(expr)
  return rows.filter(row => Boolean(fn(row)))
}

function sortRows(rows: Row[], field: string, order: 'asc' | 'desc'): Row[] {
  const dir = order === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const va = a[field]
    const vb = b[field]
    if (va === vb) return 0
    if (va === null || va === undefined) return 1
    if (vb === null || vb === undefined) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
}

/**
 * map：表达式结果若为对象，则合并进原行（新增/覆盖字段）；
 * 否则写入 `_value` 字段。
 */
function mapRows(rows: Row[], expr: string): Row[] {
  const fn = compileExpr(expr)
  return rows.map(row => {
    const out = fn(row)
    if (out !== null && typeof out === 'object' && !Array.isArray(out)) {
      return { ...row, ...(out as Row) }
    }
    return { ...row, _value: out }
  })
}

type AggOp = 'sum' | 'avg' | 'count' | 'max' | 'min'

function groupByRows(rows: Row[], field: string, aggs: Record<string, AggOp>): Row[] {
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const key = String(row[field] ?? '')
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  const result: Row[] = []
  for (const [key, bucket] of groups) {
    const out: Row = { [field]: key }
    for (const [alias, op] of Object.entries(aggs)) {
      out[alias] = aggregate(bucket, alias, op)
    }
    result.push(out)
  }
  return result
}

/**
 * 聚合：alias 形如 "value" 或 "value.sum"？
 * 这里约定 aggs 的 key 是「目标字段名」，聚合对哪一列进行？
 * 简化：count 统计行数；sum/avg/max/min 对别名同名字段进行，
 * 若需要跨字段，业务方可在 map 步骤先算好列。
 */
function aggregate(rows: Row[], alias: string, op: AggOp): number {
  if (op === 'count') return rows.length

  // 从 alias 推断源字段：约定 alias 命名 "<field>_<op>" 时取 <field>，否则取 alias 本身
  const sourceField = alias.endsWith(`_${op}`) ? alias.slice(0, -(op.length + 1)) : alias
  const nums = rows
    .map(r => Number(r[sourceField]))
    .filter(n => !Number.isNaN(n))

  if (nums.length === 0) return 0
  switch (op) {
    case 'sum': return nums.reduce((a, b) => a + b, 0)
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'max': return Math.max(...nums)
    case 'min': return Math.min(...nums)
    default: return 0
  }
}

function renameRows(rows: Row[], fields: Record<string, string>): Row[] {
  return rows.map(row => {
    const out: Row = {}
    for (const [k, v] of Object.entries(row)) {
      out[fields[k] ?? k] = v
    }
    return out
  })
}

function pickRows(rows: Row[], fields: string[]): Row[] {
  return rows.map(row => {
    const out: Row = {}
    for (const key of fields) {
      if (key in row) out[key] = row[key]
    }
    return out
  })
}
