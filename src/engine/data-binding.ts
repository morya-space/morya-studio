/**
 * Pure data-binding validation for card registrations.
 * It intentionally accepts transformed rows so callers can validate the data
 * a card will actually receive without coupling this module to Vue or stores.
 */

import { inferFieldProfiles, type FieldProfile, type Row } from '../data/field-profile'
import type { CardSchema, TransformStep } from '../types/schema'
import type { DataFieldType, DataRole } from './data-role'
import type { CardRegistration } from './registry'

export type BindingIssueLevel = 'error' | 'warning' | 'info'

export type BindingIssueCode =
  | 'required-unbound'
  | 'field-missing'
  | 'incompatible'
  | 'no-data'

export interface BindingIssue {
  level: BindingIssueLevel
  code: BindingIssueCode
  role: string
  field?: string
  path?: string
  message: string
}

export interface DataBindingResult {
  profiles: FieldProfile[]
  issues: BindingIssue[]
}

/** Optional explicit bindings for roles without a fixed CardSchema field path. */
export type DataRoleBindings = Readonly<Record<string, string | readonly string[] | undefined>>

/**
 * Returns profiles accepted by a registration role. This is the picker-facing
 * API: use it to constrain `auto:dataFields` options to the selected role.
 */
export function filterFieldsForDataRole(
  profiles: readonly FieldProfile[],
  role: Pick<DataRole, 'acceptedTypes'>,
): FieldProfile[] {
  return profiles.filter(profile => role.acceptedTypes.includes(profile.valueKind))
}

/**
 * Checks configured role bindings against transformed rows.
 *
 * Missing required bindings are errors. Once rows are available, a configured
 * missing field is an error and an incompatible inferred type is a warning.
 * Empty or unavailable rows remain unverifiable information, never errors.
 */
export function validateDataBindings(
  card: CardSchema,
  registration: Pick<CardRegistration, 'dataContract'> | undefined,
  rows: readonly Row[] | undefined,
  bindings: DataRoleBindings = {},
): DataBindingResult {
  const profiles = inferFieldProfiles(rows ?? [])
  const issues: BindingIssue[] = []
  const roles = registration?.dataContract?.roles

  if (!roles?.length) return { profiles, issues }

  for (const role of roles) {
    const fields = resolveRoleFields(card, role, bindings)
    if (fields.length === 0) {
      if (role.required) {
        issues.push({
          level: 'error',
          code: 'required-unbound',
          role: role.name,
          path: role.field,
          message: `Required ${role.label} role is not bound`,
        })
      }
      continue
    }

    if (!rows?.length) {
      for (const field of fields) {
        issues.push({
          level: 'info',
          code: 'no-data',
          role: role.name,
          field,
          path: role.field,
          message: `${role.label} binding "${field}" could not be verified because no data is available`,
        })
      }
      continue
    }

    for (const field of fields) {
      const profile = profiles.find(candidate => candidate.key === field)
      if (!profile) {
        issues.push({
          level: 'error',
          code: 'field-missing',
          role: role.name,
          field,
          path: role.field,
          message: `${role.label} binding "${field}" is not present in the data`,
        })
      } else if (!role.acceptedTypes.includes(profile.valueKind)) {
        issues.push({
          level: 'warning',
          code: 'incompatible',
          role: role.name,
          field,
          path: role.field,
          message: `${role.label} binding "${field}" has type "${profile.valueKind}"; expected ${formatTypes(role.acceptedTypes)}`,
        })
      }
    }
  }

  return { profiles, issues }
}

function resolveRoleFields(card: CardSchema, role: DataRole, bindings: DataRoleBindings): string[] {
  const configured: unknown = bindings[role.name] ?? (role.field ? getValueAtPath(card, role.field) : undefined)
  if (Array.isArray(configured)) {
    return configured.filter((field): field is string => typeof field === 'string' && field.length > 0)
  }
  if (typeof configured !== 'string' || configured.length === 0) return []
  return [configured]
}

/**
 * 按 lodash 风格路径读取卡片上的原始绑定值。
 * 多值角色（如 chart.yField）的绑定是字段名数组，必须原样返回交由上层归一化；
 * 若在此丢弃非字符串值，多值绑定会被误判为「必绑未绑」。
 */
function getValueAtPath(source: unknown, path: string): unknown {
  let value: unknown = source
  for (const key of path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

// ==================== 组件数据入参装配（拖放区 = 组件 dataContract 角色） ====================

/** 维度类 / 数值类角色语义（各组件复用同一套语义命名） */
const DIM_ROLE_NAMES = new Set(['category', 'label', 'title', 'dimension', 'source', 'target'])
const METRIC_ROLE_NAMES = new Set(['metric', 'value', 'trend', 'secondaryMetric', 'subtitle'])

function roleIsDim(role: DataRole): boolean {
  if (DIM_ROLE_NAMES.has(role.name)) return true
  return role.acceptedTypes.includes('string') && !role.acceptedTypes.includes('number')
}
export function roleIsMetric(role: DataRole): boolean {
  if (METRIC_ROLE_NAMES.has(role.name)) return true
  return role.acceptedTypes.length > 0 && role.acceptedTypes.every(t => t === 'number')
}

export type MetricAgg = 'sum' | 'avg' | 'count' | 'max' | 'min'

/** 拖入某个角色入参的字段（数值类角色可带聚合方式；'none' = 原始值不聚合） */
export interface AssignedField {
  field: string
  agg: MetricAgg | 'none'
}

/** 一个组件入参（角色）的装配结果 */
export interface RoleAssignment {
  /** 角色对应的卡片字段路径（如 chart.xField） */
  path: string
  multiple: boolean
  fields: AssignedField[]
}

/** 过滤条件（可视化构造，编译为 filter 表达式） */
export interface FilterCondition {
  field: string
  op: string
  value: string
}

/** 聚合输出列名：count → <field>_count，其余 → <field>_<op> */
export function metricAlias(field: string, agg: MetricAgg): string {
  return agg === 'count' ? `${field}_count` : `${field}_${agg}`
}

/**
 * 由卡片当前绑定 + transform 还原装配状态（弹窗打开时初始化拖放区）。
 * 已绑定的列若命中 groupBy 聚合别名，还原为 { 源字段, 聚合方式 }。
 */
export function buildAssignments(
  roles: readonly (DataRole & { field: string })[],
  getBound: (role: DataRole & { field: string }) => string | string[],
  transform: readonly TransformStep[],
): RoleAssignment[] {
  const gb = transform.find(s => s.op === 'groupBy') as { aggs?: Record<string, MetricAgg> } | undefined
  return roles.map(role => {
    const raw = getBound(role)
    const columns = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean)
    const fields: AssignedField[] = columns.map(col => {
      const op = gb?.aggs?.[col]
      if (op) {
        const source = col.endsWith(`_${op}`) ? col.slice(0, -(op.length + 1)) : col
        return { field: source, agg: op }
      }
      return { field: col, agg: 'none' }
    })
    return { path: role.field, multiple: Boolean(role.multiple), fields }
  })
}

/**
 * 装配 → 字段绑定（role.path → 输出列）。
 * 聚合字段映射到聚合别名，原始字段直取列名；空角色不出现在结果中。
 */
export function deriveBindings(assignments: readonly RoleAssignment[]): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const a of assignments) {
    if (!a.fields.length) continue
    const cols = a.fields.map(f => (f.agg === 'none' ? f.field : metricAlias(f.field, f.agg)))
    out[a.path] = a.multiple ? cols : cols[0]
  }
  return out
}

/**
 * 装配 + 过滤条件 → transform 步骤。
 * 任一字段带聚合时生成 groupBy：维度取首个「维度类角色」的原始字段，无则整集聚合（field=''）。
 */
export function deriveTransform(
  assignments: readonly RoleAssignment[],
  roles: readonly (DataRole & { field: string })[],
  filters: readonly FilterCondition[],
  profiles: readonly FieldProfile[],
): TransformStep[] {
  const steps: TransformStep[] = []
  for (const f of filters) {
    const expr = buildFilterExpr(f, profiles)
    if (expr) steps.push({ op: 'filter', expr })
  }
  const aggs: Record<string, MetricAgg> = {}
  for (const a of assignments) {
    for (const f of a.fields) {
      if (f.agg !== 'none') aggs[metricAlias(f.field, f.agg)] = f.agg
    }
  }
  if (Object.keys(aggs).length) {
    const dimField = assignments
      .filter(a => {
        const role = roles.find(r => r.field === a.path)
        return role && roleIsDim(role)
      })
      .flatMap(a => a.fields)
      .find(f => f.agg === 'none')?.field ?? ''
    steps.push({ op: 'groupBy', field: dimField, aggs })
  }
  return steps
}

/** 过滤条件 → 安全表达式（数值/布尔字面量不加引号；contains 用白名单函数） */
export function buildFilterExpr(f: FilterCondition, profiles: readonly FieldProfile[]): string | null {
  if (!f.field) return null
  const kind = profiles.find(x => x.key === f.field)?.valueKind ?? 'string'
  if (f.op === 'contains') {
    return f.value.trim() === '' ? null : `includes(${f.field}, ${JSON.stringify(f.value)})`
  }
  if (f.value.trim() === '') return null
  let lit: string
  if (kind === 'number' && !Number.isNaN(Number(f.value))) lit = String(Number(f.value))
  else if (kind === 'boolean' && (f.value === 'true' || f.value === 'false')) lit = f.value
  else lit = JSON.stringify(f.value)
  return `${f.field} ${f.op} ${lit}`
}

/** transform 的 filter 步骤 → 可视化过滤条件（无法解析的高级表达式跳过，仍可在表达式模式编辑） */
export function parseFilterConditions(steps: readonly TransformStep[]): FilterCondition[] {
  const out: FilterCondition[] = []
  for (const s of steps) {
    if (s.op !== 'filter') continue
    const expr = s.expr
    const m = /^\s*([^\s=!<>(),]+)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$/.exec(expr)
    if (m) {
      out.push({ field: m[1], op: m[2], value: m[3].replace(/^['"]|['"]$/g, '') })
      continue
    }
    const c = /^\s*includes\(\s*([^\s=!<>(),]+)\s*,\s*(.+?)\s*\)\s*$/.exec(expr)
    if (c) out.push({ field: c[1], op: 'contains', value: c[2].replace(/^['"]|['"]$/g, '') })
  }
  return out
}

function formatTypes(types: readonly DataFieldType[]): string {
  return types.map(type => `"${type}"`).join(', ')
}
