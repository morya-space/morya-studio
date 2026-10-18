import { describe, it, expect } from 'vitest'
import { describeFields, autoConfigCard, fieldOptions, isMetricLike, isDimensionLike } from '../fields'
import type { CardSchema } from '../../types/schema'

function card(partial: Partial<CardSchema>): CardSchema {
  return { id: 'c1', type: 'chart', ...partial } as CardSchema
}

describe('describeFields', () => {
  it('infers kind and role from sample values', () => {
    const rows = [
      { month: '2024-01', sales: 100, active: true },
      { month: '2024-02', sales: 200, active: false },
    ]
    const fields = describeFields(rows)
    const byName = new Map(fields.map(f => [f.name, f]))
    expect(byName.get('month')?.role).toBe('dimension')
    expect(byName.get('sales')?.kind).toBe('number')
    expect(byName.get('sales')?.role).toBe('metric')
    expect(byName.get('active')?.role).toBe('dimension')
  })

  it('detects date-like strings as time', () => {
    const fields = describeFields([{ day: '2024-06-01', v: 1 }])
    expect(fields.find(f => f.name === 'day')?.role).toBe('time')
    expect(isDimensionLike(fields.find(f => f.name === 'day')!)).toBe(true)
  })

  it('computes cardinality across all rows', () => {
    const fields = describeFields([
      { cat: 'a', v: 1 }, { cat: 'b', v: 2 }, { cat: 'a', v: 3 },
    ])
    expect(fields.find(f => f.name === 'cat')?.cardinality).toBe(2)
  })

  it('isMetricLike only for numeric fields', () => {
    expect(isMetricLike({ name: 'x', kind: 'number', role: 'metric' })).toBe(true)
    expect(isMetricLike({ name: 'x', kind: 'string', role: 'dimension' })).toBe(false)
  })
})

describe('fieldOptions', () => {
  const descs = describeFields([
    { cat: 'a', sales: 1, day: '2024-01-01' },
    { cat: 'b', sales: 2, day: '2024-01-02' },
  ])
  it('metric mode puts metric fields first', () => {
    const opts = fieldOptions(descs, 'metric')
    expect(opts[0].value).toBe('sales')
  })
  it('labels include role badge', () => {
    expect(fieldOptions(descs, 'all')[0].label).toContain('·')
  })
})

describe('autoConfigCard', () => {
  const rows = [
    { month: '1月', sales: 100 },
    { month: '2月', sales: 200 },
  ]

  it('chart picks first dimension as x and first metric as y when empty', () => {
    const out = autoConfigCard(card({ type: 'chart', chart: {} }), rows)
    expect(out.chart?.xField).toBe('month')
    expect(out.chart?.yField).toBe('sales')
  })

  it('chart keeps an already-valid user config', () => {
    const out = autoConfigCard(card({ type: 'chart', chart: { xField: 'month', yField: 'sales' } }), rows)
    expect(out.chart?.xField).toBe('month')
    expect(out.chart?.yField).toBe('sales')
  })

  it('stat picks first metric as valueField', () => {
    const out = autoConfigCard(card({ type: 'stat', stat: {} }), rows)
    expect(out.stat?.valueField).toBe('sales')
  })

  it('list fills title + value from roles', () => {
    const out = autoConfigCard(card({ type: 'list', list: {} }), rows)
    expect(out.list?.titleField).toBe('month')
    expect(out.list?.valueField).toBe('sales')
  })

  it('table auto-builds columns from all fields when empty', () => {
    const out = autoConfigCard(card({ type: 'table', table: { columns: [] } }), rows)
    expect(out.table?.columns?.map(c => c.key)).toEqual(['month', 'sales'])
  })

  it('table keeps existing columns', () => {
    const out = autoConfigCard(
      card({ type: 'table', table: { columns: [{ key: 'sales', title: '销售额' }] } }),
      rows,
    )
    expect(out.table?.columns?.map(c => c.key)).toEqual(['sales'])
  })

  it('explicitRoles override inferred roles for auto config', () => {
    const out = autoConfigCard(
      card({ type: 'chart', chart: {} }),
      rows,
      { month: 'dimension', sales: 'metric' },
    )
    expect(out.chart?.xField).toBe('month')
    expect(out.chart?.yField).toBe('sales')
  })

  it('explicitRoles can demote a numeric field to dimension (x axis)', () => {
    // 数值字段默认推断为指标；显式指定为维度后，X 轴取它
    const out = autoConfigCard(
      card({ type: 'chart', chart: {} }),
      [{ code: 1, sales: 100 }, { code: 2, sales: 200 }],
      { code: 'dimension', sales: 'metric' },
    )
    expect(out.chart?.xField).toBe('code')
    expect(out.chart?.yField).toBe('sales')
  })

  it('no-ops on non-data card types', () => {
    const src = card({ type: 'text', text: { content: 'hi' } })
    const out = autoConfigCard(src, rows)
    expect(out).toBe(src)
  })
})