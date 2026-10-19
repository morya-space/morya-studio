import { describe, expect, it } from 'vitest'
import {
  filterFieldsForRole,
  inferFieldProfiles,
  isFieldCompatibleWithRole,
  type FieldProfile,
} from '../field-profile'

describe('inferFieldProfiles', () => {
  it('infers ordered profiles, labels, semantic hints, and scalar samples', () => {
    const profiles = inferFieldProfiles([
      { order_id: 1, customerName: 'Ada', revenue: 1200, active: true, created_at: '2026-10-01' },
      { order_id: 2, customerName: 'Lin', revenue: 1800, active: false, created_at: '2026-10-02' },
    ])

    expect(profiles).toEqual([
      { key: 'order_id', label: 'Order ID', valueKind: 'number', semanticHint: 'identifier', nullable: false, sampleValues: [1, 2] },
      { key: 'customerName', label: 'Customer Name', valueKind: 'string', semanticHint: 'name', nullable: false, sampleValues: ['Ada', 'Lin'] },
      { key: 'revenue', label: 'Revenue', valueKind: 'number', semanticHint: 'currency', nullable: false, sampleValues: [1200, 1800] },
      { key: 'active', label: 'Active', valueKind: 'boolean', semanticHint: 'unknown', nullable: false, sampleValues: [true, false] },
      { key: 'created_at', label: 'Created At', valueKind: 'date', semanticHint: 'date', nullable: false, sampleValues: ['2026-10-01', '2026-10-02'] },
    ])
  })

  it('marks missing, null, and undefined values nullable without affecting the value kind', () => {
    const profiles = inferFieldProfiles([
      { name: 'Ada', score: 1, note: null },
      { name: undefined, score: 2 },
      { score: 3, note: 'ready' },
    ])

    expect(profiles).toEqual([
      { key: 'name', label: 'Name', valueKind: 'string', semanticHint: 'name', nullable: true, sampleValues: ['Ada'] },
      { key: 'score', label: 'Score', valueKind: 'number', semanticHint: 'unknown', nullable: false, sampleValues: [1, 2, 3] },
      { key: 'note', label: 'Note', valueKind: 'string', semanticHint: 'unknown', nullable: true, sampleValues: ['ready'] },
    ])
  })

  it('returns unknown for empty, mixed, non-finite, and structured values', () => {
    const profiles = inferFieldProfiles([
      { empty: null, mixed: 1, invalid: Number.NaN, structured: { nested: true } },
      { empty: undefined, mixed: '1', invalid: Infinity, structured: ['x'] },
    ])

    expect(profiles.map(profile => [profile.key, profile.valueKind, profile.sampleValues])).toEqual([
      ['empty', 'unknown', []],
      ['mixed', 'unknown', [1, '1']],
      ['invalid', 'unknown', [Number.NaN, Infinity]],
      ['structured', 'unknown', []],
    ])
  })

  it('only accepts valid ISO-like dates and preserves sample insertion order', () => {
    const profiles = inferFieldProfiles([
      { occurredAt: '2026-02-28T08:30:00Z', category: 'new' },
      { occurredAt: new Date('2026-03-01T00:00:00Z'), category: 'new' },
      { occurredAt: 'not a date', category: 'returning' },
    ])

    expect(profiles[0]).toMatchObject({ key: 'occurredAt', valueKind: 'unknown', semanticHint: 'unknown' })
    expect(profiles[1].sampleValues).toEqual(['new', 'returning'])
  })

  it('does not classify impossible calendar dates as dates', () => {
    const [profile] = inferFieldProfiles([{ day: '2026-02-29' }])

    expect(profile).toMatchObject({ valueKind: 'string', semanticHint: 'unknown' })
  })
})

describe('field role filtering', () => {
  const profiles: FieldProfile[] = [
    { key: 'label', label: 'Label', valueKind: 'string', semanticHint: 'name', nullable: false, sampleValues: ['A'] },
    { key: 'day', label: 'Day', valueKind: 'date', semanticHint: 'date', nullable: false, sampleValues: ['2026-10-01'] },
    { key: 'sales', label: 'Sales', valueKind: 'number', semanticHint: 'currency', nullable: false, sampleValues: [10] },
    { key: 'active', label: 'Active', valueKind: 'boolean', semanticHint: 'unknown', nullable: false, sampleValues: [true] },
    { key: 'metadata', label: 'Metadata', valueKind: 'unknown', semanticHint: 'unknown', nullable: false, sampleValues: [] },
  ]

  it('returns compatible fields without changing their original ordering', () => {
    expect(filterFieldsForRole(profiles, 'chart-value').map(field => field.key)).toEqual(['sales'])
    expect(filterFieldsForRole(profiles, 'chart-dimension').map(field => field.key)).toEqual(['label', 'day', 'active'])
    expect(filterFieldsForRole(profiles, 'chart-series').map(field => field.key)).toEqual(['label', 'active'])
    expect(filterFieldsForRole(profiles, 'list-subtitle').map(field => field.key)).toEqual(['label', 'day', 'active'])
    expect(filterFieldsForRole(profiles, 'table-column').map(field => field.key)).toEqual(['label', 'day', 'sales', 'active', 'metadata'])
  })

  it('exposes a single-profile compatibility predicate for picker integrations', () => {
    expect(isFieldCompatibleWithRole(profiles[2], 'stat-value')).toBe(true)
    expect(isFieldCompatibleWithRole(profiles[0], 'stat-value')).toBe(false)
    expect(isFieldCompatibleWithRole(profiles[4], 'list-title')).toBe(false)
  })
})
