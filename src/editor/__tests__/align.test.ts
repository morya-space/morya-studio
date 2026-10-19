import { describe, it, expect } from 'vitest'
import { computeAlignGuides, type Rect } from '../align'

const ref: Rect = { id: 'r', x: 100, y: 100, w: 200, h: 100 }

describe('computeAlignGuides', () => {
  it('snaps left edges within tolerance', () => {
    const moving: Rect = { id: 'm', x: 96, y: 300, w: 200, h: 100 }
    const r = computeAlignGuides(moving, [ref], 6)
    expect(r.dx).toBe(4)
    expect(r.guides.some(g => g.axis === 'x' && g.pos === 100)).toBe(true)
  })

  it('snaps center alignment', () => {
    // ref center x = 200; moving width 100 → left = 150 to align center
    const moving: Rect = { id: 'm', x: 153, y: 300, w: 100, h: 100 }
    const r = computeAlignGuides(moving, [ref], 6)
    expect(r.dx).toBe(-3)
  })

  it('does not snap beyond tolerance', () => {
    const moving: Rect = { id: 'm', x: 80, y: 300, w: 200, h: 100 }
    const r = computeAlignGuides(moving, [ref], 6)
    expect(r.dx).toBe(0)
    expect(r.guides).toHaveLength(0)
  })

  it('returns no snap when tolerance disabled', () => {
    const moving: Rect = { id: 'm', x: 100, y: 300, w: 200, h: 100 }
    const r = computeAlignGuides(moving, [ref], 0)
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(0)
  })

  it('picks the nearest candidate on both axes', () => {
    const ref2: Rect = { id: 'r2', x: 98, y: 305, w: 200, h: 100 }
    const moving: Rect = { id: 'm', x: 100, y: 300, w: 200, h: 100 }
    const r = computeAlignGuides(moving, [ref2], 8)
    // moving y=300 vs ref2 y=305 → dy=5 (nearest within 8)
    expect(r.dy).toBe(5)
  })
})
