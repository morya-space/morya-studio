import { describe, it, expect, beforeAll } from 'vitest'
import { registerBuiltinCards } from '..'
import { getAllRegistrations, getCardComponent, getCardRegistration } from '../../../engine/registry'
import { validatePage } from '../../../engine/validate'
import { DATA_CARD_TYPES } from '../../../engine/utils'
import type { CardSchema, PageSchema } from '../../../types/schema'

const DATA_TYPES = new Set<string>(DATA_CARD_TYPES)

describe('builtin card catalog', () => {
  beforeAll(() => {
    registerBuiltinCards()
  })

  it('registers a broad catalog across categories', () => {
    const regs = getAllRegistrations()
    expect(regs.length).toBeGreaterThanOrEqual(20)
    const categories = new Set(regs.map(r => r.category))
    for (const c of ['chart', 'information', 'table', 'media', 'decorate', 'basic']) {
      expect(categories.has(c as never), `missing category ${c}`).toBe(true)
    }
  })

  it('every registration exposes component, label, defaultSize and editorSchema', () => {
    for (const r of getAllRegistrations()) {
      expect(r.component, r.type).toBeTruthy()
      expect(getCardComponent(r.type), r.type).toBeTruthy()
      expect(r.label, r.type).toBeTruthy()
      expect(r.defaultSize, r.type).toBeTruthy()
      expect((r.editorSchema ?? []).length, `${r.type} editorSchema`).toBeGreaterThan(0)
    }
  })

  it('every default config yields a schema-valid card', () => {
    const cards = getAllRegistrations().map(r => {
      const card = { id: `c-${r.type}`, ...r.defaultConfig(), type: r.type } as CardSchema
      if (DATA_TYPES.has(r.type)) {
        card.dataSource = {
          type: 'static',
          staticData: [{ x: 'A', y: 1, value: 1, name: 'n', label: 'l' }],
        }
        delete card.dataSourceId
      }
      return card
    })

    const page: PageSchema = {
      id: 'p-catalog',
      title: 'catalog',
      layout: 'grid',
      grid: { cols: 12 },
      cards,
    }
    const res = validatePage(page)
    const errors = res.issues.filter(i => i.level === 'error')
    expect(errors).toEqual([])
    expect(res.valid).toBe(true)
  })

  it('declares reusable field role contracts for data-driven cards', () => {
    const dataRegistrations = getAllRegistrations().filter(registration => DATA_TYPES.has(registration.type))
    expect(dataRegistrations).toHaveLength(DATA_CARD_TYPES.length)

    for (const registration of dataRegistrations) {
      expect(registration.dataContract?.roles.length, registration.type).toBeGreaterThan(0)
      for (const role of registration.dataContract?.roles ?? []) {
        expect(role.name, registration.type).toBeTruthy()
        expect(role.label, registration.type).toBeTruthy()
        expect(role.acceptedTypes.length, `${registration.type}:${role.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('maps representative role names to the fields read by cards', () => {
    expect(getCardRegistration('chart')?.dataContract?.roles).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'category', field: 'chart.xField', required: true }),
      expect.objectContaining({ name: 'metric', field: 'chart.yField', acceptedTypes: ['number'] }),
      expect.objectContaining({ name: 'series', field: 'chart.seriesField' }),
    ]))
    expect(getCardRegistration('stat')?.dataContract?.roles).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'metric', field: 'stat.valueField', required: true }),
      expect.objectContaining({ name: 'trend', field: 'stat.trendField' }),
    ]))
    expect(getCardRegistration('table')?.dataContract?.roles).toEqual([
      expect.objectContaining({ name: 'column', required: true, multiple: true }),
    ])
    expect(getCardRegistration('sankey')?.dataContract?.roles).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'source', field: 'chart.xField', required: true }),
      expect.objectContaining({ name: 'target', field: 'chart.seriesField', required: true }),
    ]))
  })
})
