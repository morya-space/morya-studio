import { describe, expect, it } from 'vitest'
import { formatMockTemplate, generateMockRows } from '../mockgen'

describe('generateMockRows', () => {
  it('generates rows from a repeat template', () => {
    const rows = generateMockRows('{{repeat 5}} {"name":"{{name}}","amount":"{{int 10 99}}"}')
    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect(typeof row.name).toBe('string')
      expect(row.amount).toBeGreaterThanOrEqual(10)
      expect(row.amount).toBeLessThanOrEqual(99)
    }
  })

  it('fills an array template row by row', () => {
    const rows = generateMockRows('[{"x":"a","y":"{{int 1 5}}"},{"x":"b","y":"{{int 1 5}}"}]')
    expect(rows).toHaveLength(2)
    expect(rows[0].x).toBe('a')
    expect(rows[1].x).toBe('b')
  })

  it('supports pick and date tokens', () => {
    const rows = generateMockRows('{"level":"{{pick high|mid|low}}","day":"{{date 2024-01-01 2024-12-31}}"}')
    expect(['high', 'mid', 'low']).toContain(rows[0].level)
    expect(String(rows[0].day)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('inc counter increases per row', () => {
    const rows = generateMockRows('{{repeat 3}} {"i":"{{inc}}"}')
    expect(rows.map(r => r.i)).toEqual([0, 1, 2])
  })

  it('returns [] for invalid JSON', () => {
    expect(generateMockRows('not json')).toEqual([])
  })

  it('returns [] for empty template', () => {
    expect(generateMockRows('')).toEqual([])
  })

  it('caps repeat count', () => {
    const rows = generateMockRows('{{repeat 99999}} {"a":1}')
    expect(rows.length).toBeLessThanOrEqual(1000)
  })
})

describe('formatMockTemplate', () => {
  it('pretty-prints JSON with 2-space indent', () => {
    const out = formatMockTemplate('{"a":1,"b":{"c":2}}')
    expect(out).toBe('{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}')
  })

  it('keeps the repeat prefix on its own line', () => {
    const out = formatMockTemplate('{{repeat 6}} {"x":"{{int 1 9}}"}')
    expect(out.startsWith('{{repeat 6}}\n{')).toBe(true)
    // 格式化后仍可正常生成
    expect(generateMockRows(out)).toHaveLength(6)
  })

  it('returns the input unchanged for invalid JSON', () => {
    expect(formatMockTemplate('not json')).toBe('not json')
  })

  it('returns empty string for blank input', () => {
    expect(formatMockTemplate('  ')).toBe('')
  })
})
