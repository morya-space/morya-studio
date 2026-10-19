import { describe, expect, it } from 'vitest'
import { isSafeNavigationUrl, parseAction } from '../events'
import { isSafeBinding, readPayloadPath, resolveInteractionParams, type InteractionPayload } from '../interactions'

describe('declarative event runtime', () => {
  it('accepts only refresh and safe navigation actions', () => {
    expect(parseAction('refresh')).toEqual({ type: 'refresh' })
    expect(parseAction('navigate:https://example.com/docs')).toEqual({ type: 'navigate', url: 'https://example.com/docs' })
    expect(parseAction('navigate:/reports')).toEqual({ type: 'navigate', url: '/reports' })
    expect(parseAction('navigate:#section-a')).toEqual({ type: 'navigate', url: '#section-a' })

    expect(isSafeNavigationUrl('http://example.com')).toBe(false)
    expect(isSafeNavigationUrl('//example.com')).toBe(false)
    expect(isSafeNavigationUrl('javascript:alert(1)')).toBe(false)
    expect(parseAction('run:alert(1)')).toBeNull()
  })

  it('resolves only constrained own-property data paths into request params', () => {
    const payload: InteractionPayload = {
      card: { id: 'source', type: 'table' },
      data: { region: 'east', nested: { id: 7 } },
      event: { type: 'click' },
    }

    expect(readPayloadPath(payload, 'data.nested.id')).toBe(7)
    expect(readPayloadPath(payload, 'data.__proto__.polluted')).toBeUndefined()
    expect(isSafeBinding({ target: 'region', source: 'data.region' })).toBe(true)
    expect(isSafeBinding({ target: 'bad key', source: 'data.region' })).toBe(false)
    expect(isSafeBinding({ target: 'region', source: 'data[region]' })).toBe(false)

    expect(resolveInteractionParams([
      { target: 'region', source: 'data.region' },
      { target: 'recordId', source: 'data.nested.id' },
      { target: '__proto__', source: 'data.region' },
    ], payload)).toEqual({ region: 'east', recordId: 7 })
  })
})
