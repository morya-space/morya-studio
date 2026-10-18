/**
 * 字段模型与自动配置（v0.3）
 * 把绑定数据源的行数据探测为「字段描述符」：类型 + 角色（维度 / 指标 / 时间），
 * 供编辑器把字段拼装进卡片配置（X 轴 / Y 轴 / 数值 / 标签 / 表格列等），并据此渲染。
 * 角色是编辑辅助的「建议」，不强制锁死，避免合法配置（数值维度 / 文本指标）被拦截。
 */

import type { CardSchema } from '../types/schema'

export type FieldKind = 'number' | 'string' | 'boolean' | 'date' | 'object'
export type FieldRole = 'dimension' | 'metric' | 'time'

export interface FieldDescriptor {
  name: string
  kind: FieldKind
  /** 建议角色：数值 → 指标，日期 → 时间，其余 → 维度 */
  role: FieldRole
  /** 字段显示名（编辑器里与 name 一致；保留字段以便将来重命名来源） */
  label?: string
  /** 首个非空样例值（用于编辑器提示） */
  sample?: unknown
  /** 去重后的取值个数（维度参考） */
  cardinality?: number
  /** 该字段在多少行有值（覆盖率，0-1） */
  coverage?: number
}

type Row = Record<string, unknown>

const DATE_LIKE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([T\s]\d{1,2}:\d{2}(:\d{2})?)?$/

/** 依据样例值推断字段类型 */
export function inferFieldKind(value: unknown): FieldKind {
  if (value === null || value === undefined) return 'string'
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (value instanceof Date) return 'date'
  if (typeof value === 'object') return 'object'
  const s = String(value)
  if (DATE_LIKE.test(s)) return 'date'
  return 'string'
}

/** 依据类型推断建议角色 */
export function inferFieldRole(kind: FieldKind): FieldRole {
  switch (kind) {
    case 'number': return 'metric'
    case 'date': return 'time'
    case 'boolean': return 'dimension'
    case 'object': return 'dimension'
    case 'string':
    default: return 'dimension'
  }
}

/**
 * 探测一批行数据的所有字段。
 * 采样前 sampleLimit 行做类型 / 覆盖率推断，全量做基数统计。
 */
export function describeFields(rows: Row[], sampleLimit = 50): FieldDescriptor[] {
  const map = new Map<string, FieldDescriptor>()
  const sample = rows.slice(0, sampleLimit)
  const seen = new Map<string, Set<unknown>>()

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!map.has(key)) map.set(key, {
        name: key,
        kind: 'string',
        role: 'dimension',
        coverage: 0,
      })
      const bucket = seen.get(key)
      if (bucket) bucket.add(row[key])
      else seen.set(key, new Set([row[key]]))
    }
  }

  for (const [key, desc] of map) {
    let sampleValue: unknown
    for (const row of sample) {
      const v = row[key]
      if (v !== null && v !== undefined) { sampleValue = v; break }
    }
    if (sampleValue === undefined) {
      // 采样行里没取到非空值，回退到全量找
      for (const row of rows) {
        const v = row[key]
        if (v !== null && v !== undefined) { sampleValue = v; break }
      }
    }
    const kind = sampleValue === undefined ? 'string' : inferFieldKind(sampleValue)
    desc.kind = kind
    desc.role = inferFieldRole(kind)
    desc.sample = sampleValue
    desc.coverage = rows.length ? (seen.get(key)?.size ?? 0) / rows.length : 0
    desc.cardinality = seen.get(key)?.size ?? 0
  }

  return [...map.values()]
}

/** 判断某字段是否为「数值可聚合」的建议指标（以角色为准，尊重显式覆盖） */
export function isMetricLike(desc: FieldDescriptor): boolean {
  return desc.role === 'metric'
}

/** 判断某字段是否适合作为类别/维度（时间也视为可排序列维度） */
export function isDimensionLike(desc: FieldDescriptor): boolean {
  return desc.role === 'dimension' || desc.role === 'time'
}

// ==================== 自动配置 ====================

/**
 * 字段选择器：按建议角色排序，指标优先 / 维度优先，返回 label（含角色徽标）+ value。
 * 不硬过滤——保证任何字段都可被选，避免锁死合法配置。
 */
export function fieldOptions(
  descs: FieldDescriptor[],
  mode: 'all' | 'dimension' | 'metric' = 'all',
): { label: string; value: string }[] {
  const sorted = [...descs].sort((a, b) => {
    const score = (d: FieldDescriptor) => mode === 'metric'
      ? (isMetricLike(d) ? 0 : 1)
      : mode === 'dimension' ? (isDimensionLike(d) ? 0 : 1) : 0
    return score(a) - score(b) || (a.cardinality ?? 0) - (b.cardinality ?? 0)
  })
  return sorted.map(d => ({ label: `${d.name} · ${roleLabel(d)}`, value: d.name }))
}

function roleLabel(d: FieldDescriptor): string {
  switch (d.role) {
    case 'metric': return '数值'
    case 'time': return '时间'
    default: return '维度'
  }
}

/**
 * 绑定数据源后，为卡片补齐缺失的字段配置（打通「选择数据源 → 渲染」）。
 * 只填当前为空的字段（或仍指向数据源里不存在的占位字段），不覆盖用户已配置项。
 * @param explicitRoles 字段角色覆盖（拖拽配置，如 card.fieldRoles）；缺省用类型推断。
 */
export function autoConfigCard(card: CardSchema, rows: Row[], explicitRoles?: Record<string, FieldRole>): CardSchema {
  const descs = describeFields(rows).map(d => {
    const role = explicitRoles?.[d.name]
    return role ? { ...d, role } : d
  })
  if (!descs.length) return card
  const metrics = descs.filter(isMetricLike)
  const dimensions = descs.filter(isDimensionLike)
  const firstMetric = metrics[0]?.name
  const firstDim = dimensions[0]?.name
  const has = (name?: string) => !!name && descs.some(d => d.name === name)

  const next = { ...card }

  switch (card.type) {
    case 'stat': {
      const stat = { ...(next.stat ?? {}) }
      if (!has(stat.valueField)) stat.valueField = firstMetric ?? descs[0].name
      if (stat.labelField && !has(stat.labelField)) stat.labelField = firstDim
      if (stat.trendField && !has(stat.trendField)) stat.trendField = undefined
      next.stat = stat
      break
    }
    case 'chart': {
      const chart = { ...(next.chart ?? {}) }
      if (!has(chart.xField)) chart.xField = firstDim ?? descs[0].name
      if (!has(chart.yField)) chart.yField = firstMetric ?? firstDim ?? descs[0].name
      if (chart.seriesField && !has(chart.seriesField)) chart.seriesField = undefined
      next.chart = chart
      break
    }
    case 'list': {
      const list = { ...(next.list ?? {}) }
      if (!has(list.titleField)) list.titleField = firstDim ?? descs[0].name
      if (!has(list.valueField)) list.valueField = firstMetric ?? firstDim ?? descs[0].name
      if (list.subtitleField && !has(list.subtitleField)) list.subtitleField = undefined
      if (list.trendField && !has(list.trendField)) list.trendField = undefined
      next.list = list
      break
    }
    case 'table': {
      // 表格列：未配置任何列时，默认取「维度 + 指标」全部字段为列
      const table = { ...(next.table ?? {}) }
      if (!table.columns?.length) {
        table.columns = descs.map(d => ({ key: d.name, title: d.name }))
      }
      next.table = table
      break
    }
    default:
      return card
  }

  return next
}