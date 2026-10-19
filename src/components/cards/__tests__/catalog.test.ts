import { describe, it, expect, beforeAll } from 'vitest'
import { registerBuiltinCards } from '..'
import { getAllRegistrations, getCardComponent } from '../../../engine/registry'
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
})
