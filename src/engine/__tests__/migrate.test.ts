import { describe, expect, it } from 'vitest'
import { migrateSchema, isMigrated } from '../migrate'
import { SCHEMA_VERSION } from '../../types/schema'

describe('migrateSchema', () => {
  it('normalizes a bare page', () => {
    const page = migrateSchema({ title: 'x', cards: [] })
    expect(page.id).toBeTruthy()
    expect(page.layout).toBe('grid')
    expect(page.grid?.cols).toBe(12)
    expect(page.meta?.version).toBe(SCHEMA_VERSION)
  })

  it('fills missing card ids and default span/order', () => {
    const page = migrateSchema({
      id: 'p1',
      title: 't',
      layout: 'grid',
      cards: [
        { type: 'chart', chart: { chartType: 'bar' }, dataSource: { type: 'static', staticData: [] } },
        { type: 'table', table: { columns: [] }, dataSource: { type: 'static', staticData: [] } },
      ],
    } as never)
    const [c1, c2] = page.cards
    expect(c1.id).toBeTruthy()
    expect(c1.span).toBe(6)
    expect(c2.span).toBe(12)
    expect(c1.order).toBe(0)
  })

  it('adds id to inline datasource and removes legacy string transform', () => {
    const page = migrateSchema({
      id: 'p1',
      title: 't',
      layout: 'grid',
      cards: [
        {
          id: 'c1',
          type: 'chart',
          chart: { chartType: 'bar' },
          dataSource: { type: 'static', staticData: [] },
          transform: 'old-string',
        },
      ],
    } as never)
    expect(page.cards[0].dataSource?.id).toBe('inline-c1')
    expect('transform' in page.cards[0]).toBe(false)
  })

  it('returns null-safe for empty input', () => {
    const page = migrateSchema(null)
    expect(page.id).toBeTruthy()
    expect(page.cards).toEqual([])
  })

  it('adds free-layout geometry defaults for free pages', () => {
    const page = migrateSchema({
      id: 'p1',
      title: 't',
      layout: 'free',
      cards: [
        { id: 'c1', type: 'chart', chart: { chartType: 'bar' } },
        { id: 'c2', type: 'stat', stat: { valueField: 'v' } },
      ],
    } as never)
    expect(page.layout).toBe('free')
    const [c1, c2] = page.cards
    expect(c1.x).toBeDefined()
    expect(c1.y).toBeDefined()
    expect(c1.w).toBe(420)
    expect(c1.h).toBe(250)
    expect(c2.w).toBe(250)
    expect(c2.h).toBe(150)
  })

  it('keeps grid layout unchanged for grid pages', () => {
    const page = migrateSchema({
      id: 'p1',
      title: 't',
      layout: 'grid',
      cards: [{ id: 'c1', type: 'chart', chart: { chartType: 'bar' } }],
    } as never)
    expect(page.layout).toBe('grid')
    expect(page.cards[0].x).toBeUndefined()
  })

  it('fills v0.3 defaults: mode, groups, card status', () => {
    const page = migrateSchema({
      id: 'p1',
      title: 't',
      layout: 'free',
      cards: [{ id: 'c1', type: 'stat', stat: { valueField: 'v' } }],
    } as never)
    expect(page.mode).toBe('screen')
    expect(page.groups).toEqual([])
    expect(page.cards[0].status).toEqual({ lock: false, hide: false })
  })

  it('grid pages default mode to dashboard', () => {
    const page = migrateSchema({ id: 'p1', title: 't', layout: 'grid', cards: [] } as never)
    expect(page.mode).toBe('dashboard')
  })

  it('keeps explicit groups and drops dangling groupId references', () => {
    const page = migrateSchema({
      id: 'p1',
      title: 't',
      layout: 'free',
      groups: [{ id: 'g1', name: '组', x: 0, y: 0, w: 100, h: 100 }],
      cards: [
        { id: 'c1', type: 'stat', stat: { valueField: 'v' }, groupId: 'g1' },
        { id: 'c2', type: 'stat', stat: { valueField: 'v' }, groupId: 'ghost' },
      ],
    } as never)
    expect(page.groups).toHaveLength(1)
    expect(page.cards[0].groupId).toBe('g1')
    expect(page.cards[1].groupId).toBeUndefined()
  })
})

describe('isMigrated', () => {
  it('true when version is current', () => {
    expect(isMigrated(migrateSchema({ title: 'x', cards: [] }))).toBe(true)
  })
})
