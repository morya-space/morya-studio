import { describe, expect, it } from 'vitest'
import {
  buildAssignments,
  deriveBindings,
  deriveTransform,
  filterFieldsForDataRole,
  parseFilterConditions,
  validateDataBindings,
  type DataRoleBindings,
  type RoleAssignment,
} from '../data-binding'
import { inferFieldProfiles } from '../../data/field-profile'
import type { DataRole } from '../data-role'
import type { CardSchema, TransformStep } from '../../types/schema'
import type { CardRegistration } from '../registry'

const registration: Pick<CardRegistration, 'dataContract'> = {
  dataContract: {
    roles: [
      { name: 'category', label: 'Category', field: 'chart.xField', acceptedTypes: ['string', 'date'], required: true },
      { name: 'metric', label: 'Metric', field: 'chart.yField', acceptedTypes: ['number'], required: true },
      { name: 'series', label: 'Series', field: 'chart.seriesField', acceptedTypes: ['string'] },
      { name: 'columns', label: 'Columns', acceptedTypes: ['string', 'number'], multiple: true },
    ],
  },
}

function makeCard(partial: Partial<CardSchema> = {}): CardSchema {
  return {
    id: 'chart-1',
    type: 'chart',
    chart: { chartType: 'bar', xField: 'month', yField: 'revenue' },
    ...partial,
  }
}

describe('validateDataBindings', () => {
  const rows = [{ month: '2026-10-01', revenue: 120, region: 'North' }]

  it('accepts compatible bound fields and supports explicit multiple role bindings', () => {
    const bindings: DataRoleBindings = { columns: ['region', 'revenue'] }
    const result = validateDataBindings(makeCard(), registration, rows, bindings)

    expect(result.issues).toEqual([])
    expect(result.profiles.map(profile => profile.key)).toEqual(['month', 'revenue', 'region'])
  })

  it('reports an error when a required role is unbound', () => {
    const result = validateDataBindings(makeCard({ chart: { chartType: 'bar', yField: 'revenue' } }), registration, rows)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'error', code: 'required-unbound', role: 'category', path: 'chart.xField' }),
    ]))
  })

  it('accepts array bindings stored at the card field path (multiple roles like chart.yField)', () => {
    const result = validateDataBindings(makeCard({ chart: { chartType: 'bar', xField: 'month', yField: ['revenue'] } }), registration, rows)

    expect(result.issues).toEqual([])
  })

  it('validates each field of an array binding stored at the card field path', () => {
    const result = validateDataBindings(makeCard({ chart: { chartType: 'bar', xField: 'month', yField: ['revenue', 'missing'] } }), registration, rows)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'error', code: 'field-missing', role: 'metric', field: 'missing' }),
    ]))
    expect(result.issues.some(issue => issue.code === 'required-unbound')).toBe(false)
  })

  it('treats an empty array at the card field path as unbound', () => {
    const result = validateDataBindings(makeCard({ chart: { chartType: 'bar', xField: 'month', yField: [] } }), registration, rows)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'error', code: 'required-unbound', role: 'metric', path: 'chart.yField' }),
    ]))
  })

  it('reports an error for bound fields missing from nonempty rows', () => {
    const result = validateDataBindings(makeCard({ chart: { chartType: 'bar', xField: 'missing', yField: 'revenue' } }), registration, rows)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'error', code: 'field-missing', role: 'category', field: 'missing' }),
    ]))
  })

  it('warns when a bound field has an incompatible inferred type', () => {
    const result = validateDataBindings(makeCard({ chart: { chartType: 'bar', xField: 'region', yField: 'month' } }), registration, rows)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'warning', code: 'incompatible', role: 'metric', field: 'month' }),
    ]))
  })

  it('marks configured bindings as unverifiable when rows are unavailable', () => {
    const result = validateDataBindings(makeCard(), registration, [])

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'info', code: 'no-data', role: 'category', field: 'month' }),
      expect.objectContaining({ level: 'info', code: 'no-data', role: 'metric', field: 'revenue' }),
    ]))
    expect(result.issues.some(issue => issue.level === 'error')).toBe(false)
  })

  it('respects optional roles that fall back to static card values', () => {
    const staticRegistration: Pick<CardRegistration, 'dataContract'> = {
      dataContract: {
        roles: [{ name: 'metric', label: 'Metric', field: 'number.valueField', acceptedTypes: ['number'] }],
      },
    }
    const card = { id: 'number-1', type: 'number', number: { value: 42 } } as CardSchema

    const result = validateDataBindings(card, staticRegistration, rows)

    expect(result.issues).toEqual([])
  })

  it('filters inferred profiles using accepted role types for picker options', () => {
    const profiles = validateDataBindings(makeCard(), registration, rows).profiles
    const role = registration.dataContract!.roles[1]

    expect(filterFieldsForDataRole(profiles, role).map(profile => profile.key)).toEqual(['revenue'])
  })

  it('skips cards whose registration has no data contract', () => {
    expect(validateDataBindings(makeCard(), {}, rows).issues).toEqual([])
  })
})

describe('组件数据入参装配（拖放区 = dataContract 角色）', () => {
  const sourceRows = [{ city: 'Beijing', sales: 300, qty: 5, status: 'active' }]
  const profiles = inferFieldProfiles(sourceRows)

  const chartRoles: (DataRole & { field: string })[] = [
    { name: 'category', label: '维度', field: 'chart.xField', acceptedTypes: ['string', 'number', 'date'], required: true },
    { name: 'metric', label: '数值', field: 'chart.yField', acceptedTypes: ['number'], required: true, multiple: true },
    { name: 'series', label: '系列', field: 'chart.seriesField', acceptedTypes: ['string', 'number'] },
  ]
  const statRoles: (DataRole & { field: string })[] = [
    { name: 'metric', label: '数值', field: 'stat.valueField', acceptedTypes: ['number'], required: true },
    { name: 'label', label: '标签', field: 'stat.labelField', acceptedTypes: ['string', 'number', 'date'] },
  ]
  const tableRoles: (DataRole & { field: string })[] = [
    { name: 'column', label: '表格列', field: 'table.columns', acceptedTypes: ['string', 'number', 'boolean', 'date', 'unknown'], required: true, multiple: true },
  ]

  describe('buildAssignments（当前绑定 + transform → 装配态还原）', () => {
    it('还原原始字段与聚合字段', () => {
      const transform: TransformStep[] = [
        { op: 'groupBy', field: 'city', aggs: { sales_sum: 'sum' } },
      ]
      const bound: Record<string, string | string[]> = {
        'chart.xField': 'city',
        'chart.yField': ['sales_sum'],
      }
      const out = buildAssignments(chartRoles, role => bound[role.field] ?? '', transform)
      expect(out.find(a => a.path === 'chart.xField')?.fields).toEqual([{ field: 'city', agg: 'none' }])
      // 聚合别名 sales_sum → 还原为源字段 sales + sum
      expect(out.find(a => a.path === 'chart.yField')?.fields).toEqual([{ field: 'sales', agg: 'sum' }])
      expect(out.find(a => a.path === 'chart.seriesField')?.fields).toEqual([])
    })
  })

  describe('deriveBindings（装配 → 字段绑定）', () => {
    it('原始字段直取列名，聚合字段映射到聚合别名', () => {
      const assignments: RoleAssignment[] = [
        { path: 'chart.xField', multiple: false, fields: [{ field: 'city', agg: 'none' }] },
        { path: 'chart.yField', multiple: true, fields: [{ field: 'sales', agg: 'sum' }, { field: 'qty', agg: 'none' }] },
      ]
      expect(deriveBindings(assignments)).toEqual({
        'chart.xField': 'city',
        'chart.yField': ['sales_sum', 'qty'],
      })
    })

    it('空角色不出现在结果中', () => {
      expect(deriveBindings([{ path: 'stat.valueField', multiple: false, fields: [] }])).toEqual({})
    })
  })

  describe('deriveTransform（装配 + 过滤 → transform）', () => {
    it('维度 + 聚合指标 → filter + groupBy', () => {
      const assignments: RoleAssignment[] = [
        { path: 'chart.xField', multiple: false, fields: [{ field: 'city', agg: 'none' }] },
        { path: 'chart.yField', multiple: true, fields: [{ field: 'sales', agg: 'sum' }] },
      ]
      const filters = [{ field: 'sales', op: '>', value: '100' }]
      const out = deriveTransform(assignments, chartRoles, filters, profiles)
      expect(out).toEqual([
        { op: 'filter', expr: 'sales > 100' },
        { op: 'groupBy', field: 'city', aggs: { sales_sum: 'sum' } },
      ])
    })

    it('无维度（指标卡）→ 整集聚合 groupBy field 为空', () => {
      const assignments: RoleAssignment[] = [
        { path: 'stat.valueField', multiple: false, fields: [{ field: 'sales', agg: 'sum' }] },
      ]
      const out = deriveTransform(assignments, statRoles, [], profiles)
      expect(out).toEqual([{ op: 'groupBy', field: '', aggs: { sales_sum: 'sum' } }])
    })

    it('全部原始值（表格）→ 无 groupBy，仅过滤', () => {
      const assignments: RoleAssignment[] = [
        { path: 'table.columns', multiple: true, fields: [{ field: 'city', agg: 'none' }, { field: 'sales', agg: 'none' }] },
      ]
      const out = deriveTransform(assignments, tableRoles, [{ field: 'status', op: '==', value: 'active' }], profiles)
      expect(out).toEqual([{ op: 'filter', expr: 'status == "active"' }])
    })

    it('包含条件 → includes 白名单函数', () => {
      const out = deriveTransform([], chartRoles, [{ field: 'city', op: 'contains', value: 'jing' }], profiles)
      expect(out).toEqual([{ op: 'filter', expr: 'includes(city, "jing")' }])
    })
  })

  describe('parseFilterConditions（filter 表达式 → 可视化条件）', () => {
    it('解析比较与包含，跳过无法解析的高级表达式', () => {
      const steps: TransformStep[] = [
        { op: 'filter', expr: 'sales > 100' },
        { op: 'filter', expr: 'includes(city, "jing")' },
        { op: 'filter', expr: 'a && (b || c)' }, // 高级表达式可视化不表达，保留在表达式模式
        { op: 'sort', field: 'sales' },
      ]
      expect(parseFilterConditions(steps)).toEqual([
        { field: 'sales', op: '>', value: '100' },
        { field: 'city', op: 'contains', value: 'jing' },
      ])
    })

    it('中文字段名 round-trip：derive → parse 还原稳定', () => {
      const filters = [
        { field: '城市', op: '==', value: '北京' },
        { field: '销量', op: '>', value: '100' },
      ]
      const steps = deriveTransform([], chartRoles, filters, inferFieldProfiles([{ 城市: '北京', 销量: 100 }]))
      expect(steps).toEqual([
        { op: 'filter', expr: '城市 == "北京"' },
        { op: 'filter', expr: '销量 > 100' },
      ])
      expect(parseFilterConditions(steps)).toEqual(filters)
    })
  })
})
