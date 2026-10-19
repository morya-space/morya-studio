import { describe, it, expect } from 'vitest'
import { validatePage } from '../validate'
import type { CardSchema, PageSchema } from '../../types/schema'

function makeCard(partial: Partial<CardSchema>): CardSchema {
  return {
    id: 'c1',
    type: 'stat',
    dataSource: { type: 'static', staticData: [{ a: 1 }] },
    stat: { valueField: 'a' },
    ...partial,
  }
}

function makePage(cards: CardSchema[], grid?: PageSchema['grid']): PageSchema {
  return { id: 'p1', title: 'Test', layout: 'grid', grid, cards }
}

describe('validatePage', () => {
  it('passes a minimal valid page', () => {
    const r = validatePage(makePage([makeCard({})]))
    expect(r.valid).toBe(true)
    expect(r.issues).toHaveLength(0)
  })

  it('R0: rejects empty schema', () => {
    // @ts-expect-error 防御性测试
    const r = validatePage(null)
    expect(r.valid).toBe(false)
    expect(r.issues[0].rule).toBe('R0')
  })

  it('R1: flags duplicate card ids', () => {
    const r = validatePage(makePage([
      makeCard({ id: 'a' }),
      makeCard({ id: 'b' }),
      makeCard({ id: 'a' }),
    ]))
    expect(r.valid).toBe(false)
    const r1 = r.issues.filter(i => i.rule === 'R1')
    expect(r1).toHaveLength(1)
    expect(r1[0].message).toContain('"a"')
  })

  it('R2: requires config block matching type', () => {
    const r = validatePage(makePage([
      { id: 'c1', type: 'chart', dataSource: { type: 'static', staticData: [] } } as CardSchema,
    ]))
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => i.rule === 'R2' && i.path.includes('.chart'))).toBe(true)
  })

  it('R3: requires dataSourceId or inline dataSource', () => {
    const card = makeCard({})
    delete card.dataSource
    delete card.dataSourceId
    const r = validatePage(makePage([card]))
    expect(r.issues.some(i => i.rule === 'R3')).toBe(true)
  })

  it('R3: accepts known dataSourceId reference', () => {
    const card = makeCard({ dataSourceId: 'ds-1' })
    delete card.dataSource
    const r = validatePage(makePage([card]), new Set(['ds-1']))
    expect(r.issues.filter(i => i.rule === 'R3')).toHaveLength(0)
  })

  it('R3: rejects unknown dataSourceId reference', () => {
    const card = makeCard({ dataSourceId: 'ds-missing' })
    delete card.dataSource
    const r = validatePage(makePage([card]), new Set(['ds-1']))
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => i.rule === 'R3' && i.message.includes('ds-missing'))).toBe(true)
  })

  it('R4: validates span range against grid cols', () => {
    const bad = makeCard({ span: 13 })
    const r = validatePage(makePage([bad], { cols: 12 }))
    expect(r.issues.some(i => i.rule === 'R4')).toBe(true)

    const ok = makeCard({ span: 6 })
    const r2 = validatePage(makePage([ok], { cols: 12 }))
    expect(r2.issues.filter(i => i.rule === 'R4')).toHaveLength(0)
  })

  it('R5: warns when chart fields missing from static data', () => {
    const card = makeCard({
      type: 'chart',
      chart: { chartType: 'bar', xField: 'month', yField: 'sales' },
      dataSource: { type: 'static', staticData: [{ month: 'Jan', revenue: 100 }] },
    })
    delete card.stat
    const r = validatePage(makePage([card]))
    const r5 = r.issues.filter(i => i.rule === 'R5')
    expect(r5.some(i => i.message.includes('yField'))).toBe(true) // sales 不存在
    expect(r5.every(i => i.level === 'warning')).toBe(true)
    expect(r.valid).toBe(true) // warning 不影响 valid
  })

  it('R6: flags invalid transform expression', () => {
    const card = makeCard({
      transform: [{ op: 'filter', expr: 'sales >' }],
    })
    const r = validatePage(makePage([card]))
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => i.rule === 'R6' && i.path.includes('.expr'))).toBe(true)
  })

  it('R6: passes valid transform steps', () => {
    const card = makeCard({
      transform: [
        { op: 'filter', expr: 'sales > 10' },
        { op: 'sort', field: 'sales', order: 'desc' },
        { op: 'limit', count: 5 },
      ],
    })
    const r = validatePage(makePage([card]))
    expect(r.issues.filter(i => i.rule === 'R6')).toHaveLength(0)
  })

  it('R6: flags dangerous expression', () => {
    const card = makeCard({
      transform: [{ op: 'filter', expr: 'process.exit()' }],
    })
    const r = validatePage(makePage([card]))
    expect(r.issues.some(i => i.rule === 'R6')).toBe(true)
  })

  it('R7: warns on duplicate order', () => {
    const r = validatePage(makePage([
      makeCard({ id: 'a', order: 1 }),
      makeCard({ id: 'b', order: 1 }),
    ]))
    expect(r.issues.some(i => i.rule === 'R7' && i.level === 'warning')).toBe(true)
    expect(r.valid).toBe(true)
  })

  it('R8: flags unknown group reference', () => {
    const card = makeCard({ groupId: 'g-missing' })
    const r = validatePage(makePage([card]))
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => i.rule === 'R8' && i.path.includes('.groupId'))).toBe(true)
  })

  it('R8: accepts known group reference', () => {
    const card = makeCard({ groupId: 'g1' })
    const page = makePage([card])
    page.groups = [{ id: 'g1', name: 'g', x: 0, y: 0, w: 10, h: 10 }]
    const r = validatePage(page)
    expect(r.issues.filter(i => i.rule === 'R8')).toHaveLength(0)
  })

  it('R10: interaction cannot target itself or unknown card', () => {
    const self = makeCard({
      id: 'a',
      events: { interactions: [{ id: 'i1', on: 'click', targetCardId: 'a', bindings: [{ target: 'p', source: 'v' }] }] },
    })
    const r = validatePage(makePage([self]))
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => i.rule === 'R10' && i.message.includes('itself'))).toBe(true)

    const ghost = makeCard({
      id: 'b',
      events: { interactions: [{ id: 'i2', on: 'click', targetCardId: 'zzz', bindings: [{ target: 'p', source: 'v' }] }] },
    })
    const r2 = validatePage(makePage([ghost]))
    expect(r2.issues.some(i => i.rule === 'R10' && i.message.includes('zzz'))).toBe(true)
  })

  it('R10: valid interaction targets another card', () => {
    const a = makeCard({ id: 'a' })
    const b = makeCard({
      id: 'b',
      events: { interactions: [{ id: 'i1', on: 'click', targetCardId: 'a', bindings: [{ target: 'p', source: 'v' }] }] },
    })
    const r = validatePage(makePage([a, b]))
    expect(r.issues.filter(i => i.rule === 'R10')).toHaveLength(0)
  })

  it('collects multiple issues across cards', () => {
    const r = validatePage(makePage([
      makeCard({ id: 'x', span: 99 }),
      makeCard({ id: 'x' }), // 重复 id
    ]))
    expect(r.valid).toBe(false)
    expect(r.issues.length).toBeGreaterThanOrEqual(2)
  })
})
