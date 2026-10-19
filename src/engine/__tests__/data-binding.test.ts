import { describe, expect, it } from 'vitest'
import {
  filterFieldsForDataRole,
  validateDataBindings,
  type DataRoleBindings,
} from '../data-binding'
import type { CardSchema } from '../../types/schema'
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
