import { describe, it, expect } from 'vitest'
import { applyTransform } from '../pipeline'
import type { TransformStep } from '../../../types/schema'

const rows = [
  { city: 'Beijing', sales: 100, qty: 2, status: 'active' },
  { city: 'Shanghai', sales: 300, qty: 5, status: 'active' },
  { city: 'Beijing', sales: 200, qty: 3, status: 'inactive' },
  { city: 'Guangzhou', sales: 50, qty: 1, status: 'active' },
]

describe('applyTransform', () => {
  it('returns copy when no steps', () => {
    const out = applyTransform(rows, [])
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows) // 浅拷贝
  })

  it('handles non-array input', () => {
    // @ts-expect-error 防御性测试
    expect(applyTransform(null, [])).toEqual([])
  })

  it('filter', () => {
    const out = applyTransform(rows, [{ op: 'filter', expr: 'sales > 100' }])
    expect(out).toHaveLength(2)
    expect(out.every(r => Number(r.sales) > 100)).toBe(true)
  })

  it('filter with field path and logic', () => {
    const out = applyTransform(rows, [
      { op: 'filter', expr: 'city == "Beijing" && status == "active"' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].sales).toBe(100)
  })

  it('sort asc and desc', () => {
    const asc = applyTransform(rows, [{ op: 'sort', field: 'sales', order: 'asc' }])
    expect(asc.map(r => r.sales)).toEqual([50, 100, 200, 300])

    const desc = applyTransform(rows, [{ op: 'sort', field: 'sales', order: 'desc' }])
    expect(desc.map(r => r.sales)).toEqual([300, 200, 100, 50])
  })

  it('sort default asc', () => {
    const out = applyTransform(rows, [{ op: 'sort', field: 'qty' }])
    expect(out.map(r => r.qty)).toEqual([1, 2, 3, 5])
  })

  it('limit', () => {
    const out = applyTransform(rows, [{ op: 'limit', count: 2 }])
    expect(out).toHaveLength(2)
  })

  it('map merges object result into row', () => {
    const out = applyTransform(rows, [{ op: 'map', expr: 'sales * 2' }])
    // 数值结果写入 _value
    expect(out[0]._value).toBe(200)
    // 原字段保留
    expect(out[0].sales).toBe(100)
  })

  it('groupBy with aggregations', () => {
    const steps: TransformStep[] = [
      {
        op: 'groupBy',
        field: 'city',
        aggs: { sales_sum: 'sum', qty_avg: 'avg', count: 'count', sales_max: 'max' },
      },
    ]
    const out = applyTransform(rows, steps)
    const beijing = out.find(r => r.city === 'Beijing')
    expect(beijing).toBeDefined()
    expect(beijing!.sales_sum).toBe(300)   // 100 + 200
    expect(beijing!.count).toBe(2)
    expect(beijing!.qty_avg).toBe(2.5)     // (2+3)/2
    expect(beijing!.sales_max).toBe(200)
  })

  it('groupBy min', () => {
    const out = applyTransform(rows, [
      { op: 'groupBy', field: 'status', aggs: { sales_min: 'min', count: 'count' } },
    ])
    const active = out.find(r => r.status === 'active')
    expect(active!.sales_min).toBe(50)
    expect(active!.count).toBe(3)
  })

  it('rename', () => {
    const out = applyTransform(rows, [
      { op: 'rename', fields: { city: 'region', sales: 'amount' } },
    ])
    expect(out[0]).toHaveProperty('region', 'Beijing')
    expect(out[0]).toHaveProperty('amount', 100)
    expect(out[0]).not.toHaveProperty('city')
    expect(out[0]).not.toHaveProperty('sales')
  })

  it('chains multiple steps in order', () => {
    const steps: TransformStep[] = [
      { op: 'filter', expr: 'status == "active"' },
      { op: 'sort', field: 'sales', order: 'desc' },
      { op: 'limit', count: 2 },
    ]
    const out = applyTransform(rows, steps)
    expect(out.map(r => r.sales)).toEqual([300, 100])
  })

  it('group -> rename chain', () => {
    const steps: TransformStep[] = [
      { op: 'groupBy', field: 'city', aggs: { total: 'count' } },
      { op: 'rename', fields: { total: 'dealCount' } },
    ]
    const out = applyTransform(rows, steps)
    expect(out[0]).toHaveProperty('dealCount')
    expect(out[0]).not.toHaveProperty('total')
  })

  it('filter with whitelisted includes() (自助取数“包含”)', () => {
    const out = applyTransform(rows, [{ op: 'filter', expr: 'includes(city, "jing")' }])
    expect(out).toHaveLength(2)
    expect(out.every(r => String(r.city).includes('jing'))).toBe(true)
  })

  it('invalid filter expr is skipped, not crash', () => {
    const out = applyTransform(rows, [{ op: 'filter', expr: 'foo(bar' }])
    expect(out).toHaveLength(rows.length) // 步骤被跳过，数据保留
  })

  it('invalid map expr is skipped, not crash', () => {
    const out = applyTransform(rows, [{ op: 'map', expr: 'foo((' }])
    expect(out).toHaveLength(rows.length)
    expect(out[0]).not.toHaveProperty('_value')
  })

  it('full pipeline: computed-like map -> filter -> groupBy', () => {
    const steps: TransformStep[] = [
      { op: 'filter', expr: 'status == "active"' },
      { op: 'groupBy', field: 'city', aggs: { sales_sum: 'sum', count: 'count' } },
      { op: 'sort', field: 'sales_sum', order: 'desc' },
    ]
    const out = applyTransform(rows, steps)
    expect(out[0].city).toBe('Shanghai')
    expect(out[0].sales_sum).toBe(300)
  })

  it('groupBy with empty field aggregates whole set into one row（指标卡整集聚合）', () => {
    const out = applyTransform(rows, [
      { op: 'groupBy', field: '', aggs: { sales_sum: 'sum', count: 'count', qty_avg: 'avg' } },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].sales_sum).toBe(650) // 100+300+200+50
    expect(out[0].count).toBe(4)
    expect(out[0].qty_avg).toBe(2.75)  // (2+5+3+1)/4
    expect(Object.keys(out[0])).not.toContain('') // 不写入空维度键
  })

  it('groupBy with empty field on empty rows returns empty', () => {
    expect(applyTransform([], [{ op: 'groupBy', field: '', aggs: { count: 'count' } }])).toEqual([])
  })
})
