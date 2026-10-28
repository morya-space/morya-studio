import { describe, it, expect } from 'vitest'
import { compileExpr, validateExpr } from '../expr'

describe('validateExpr', () => {
  it('accepts valid expressions', () => {
    expect(validateExpr('value > 100').ok).toBe(true)
    expect(validateExpr('user.name == "alice"').ok).toBe(true)
    expect(validateExpr('a && b || !c').ok).toBe(true)
    expect(validateExpr('status in ["active", "pending"]').ok).toBe(true)
    expect(validateExpr('x > 1 ? "big" : "small"').ok).toBe(true)
  })

  it('rejects empty expression', () => {
    expect(validateExpr('').ok).toBe(false)
    expect(validateExpr('   ').ok).toBe(false)
  })

  it('rejects syntax errors', () => {
    expect(validateExpr('value >').ok).toBe(false)
    expect(validateExpr('(a && b').ok).toBe(false)
    expect(validateExpr('a b c').ok).toBe(false)
  })

  it('rejects forbidden identifiers', () => {
    const dangerous = [
      'process.exit()',
      'require("fs")',
      'global.x',
      'window.location',
      'document.cookie',
      'constructor',
      '__proto__',
      'this',
      'localStorage.getItem("k")',
      'fetch("/api")',
    ]
    for (const expr of dangerous) {
      const r = validateExpr(expr)
      expect(r.ok, `should reject: ${expr}`).toBe(false)
      expect(r.error).toMatch(/Forbidden/i)
    }
  })
})

describe('compileExpr', () => {
  const row = {
    value: 150,
    name: 'Alice',
    status: 'active',
    user: { age: 30, city: 'Beijing' },
    tags: ['a', 'b', 'c'],
    score: null,
    active: true,
  }

  it('reads top-level fields', () => {
    expect(compileExpr('value')(row)).toBe(150)
    expect(compileExpr('name')(row)).toBe('Alice')
  })

  it('reads nested paths', () => {
    expect(compileExpr('user.age')(row)).toBe(30)
    expect(compileExpr('user.city')(row)).toBe('Beijing')
    expect(compileExpr('user.missing.deep')(row)).toBeUndefined()
  })

  it('reads array index', () => {
    expect(compileExpr('tags[0]')(row)).toBe('a')
    expect(compileExpr('tags[2]')(row)).toBe('c')
  })

  it('comparison operators', () => {
    expect(compileExpr('value > 100')(row)).toBe(true)
    expect(compileExpr('value < 100')(row)).toBe(false)
    expect(compileExpr('value >= 150')(row)).toBe(true)
    expect(compileExpr('name == "Alice"')(row)).toBe(true)
    expect(compileExpr('name != "Bob"')(row)).toBe(true)
  })

  it('logic operators with short-circuit', () => {
    expect(compileExpr('active && value > 100')(row)).toBe(true)
    expect(compileExpr('active && value > 200')(row)).toBe(false)
    expect(compileExpr('value > 200 || name == "Alice"')(row)).toBe(true)
    expect(compileExpr('!active')(row)).toBe(false)
    // and/or 关键字别名
    expect(compileExpr('active and value > 100')(row)).toBe(true)
    expect(compileExpr('not active')(row)).toBe(false)
  })

  it('arithmetic operators', () => {
    expect(compileExpr('value + 50')(row)).toBe(200)
    expect(compileExpr('value - 50')(row)).toBe(100)
    expect(compileExpr('value * 2')(row)).toBe(300)
    expect(compileExpr('value / 2')(row)).toBe(75)
    expect(compileExpr('value % 100')(row)).toBe(50)
    expect(compileExpr('-value')(row)).toBe(-150)
  })

  it('string concatenation with +', () => {
    expect(compileExpr('name + "!"')(row)).toBe('Alice!')
  })

  it('in operator', () => {
    expect(compileExpr('status in ["active", "pending"]')(row)).toBe(true)
    expect(compileExpr('status in ["a", "b"]')(row)).toBe(false)
    expect(compileExpr('"a" in tags')(row)).toBe(true)
  })

  it('ternary operator', () => {
    expect(compileExpr('value > 100 ? "big" : "small"')(row)).toBe('big')
    expect(compileExpr('value > 200 ? "big" : "small"')(row)).toBe('small')
  })

  it('parentheses control precedence', () => {
    expect(compileExpr('(value + 50) * 2')(row)).toBe(400)
    expect(compileExpr('value + 50 * 2')(row)).toBe(250)
  })

  it('null handling', () => {
    expect(compileExpr('score == null')(row)).toBe(true)
    expect(compileExpr('score > 0')(row)).toBe(false) // null -> 0
  })

  it('throws on forbidden identifier at compile time', () => {
    expect(() => compileExpr('process.exit()')).toThrow(/Forbidden/i)
  })

  it('calls whitelisted functions', () => {
    expect(compileExpr('String(value)')(row)).toBe('150')
    expect(compileExpr('Number("42")')(row)).toBe(42)
    expect(compileExpr('includes(name, "lic")')(row)).toBe(true)
    expect(compileExpr('includes(name, "xyz")')(row)).toBe(false)
    expect(compileExpr('includes(score, "x")')(row)).toBe(false) // null -> ''
    expect(compileExpr('startsWith(name, "Al")')(row)).toBe(true)
    expect(compileExpr('endsWith(name, "ce")')(row)).toBe(true)
    expect(compileExpr('lower(name)')(row)).toBe('alice')
    expect(compileExpr('upper(name)')(row)).toBe('ALICE')
    expect(compileExpr('len(tags)')(row)).toBe(3)
    expect(compileExpr('len(name)')(row)).toBe(5)
  })

  it('whitelisted functions compose with logic / comparison', () => {
    expect(compileExpr('includes(name, "lic") && value > 100')(row)).toBe(true)
    expect(compileExpr('len(tags) >= 3')(row)).toBe(true)
  })

  it('rejects non-whitelisted function calls', () => {
    expect(validateExpr('alert("x")').ok).toBe(false)
    expect(validateExpr('eval("1")').ok).toBe(false)
    expect(() => compileExpr('fetchData(name)')).toThrow(/not allowed/i)
  })

  it('supports Unicode (CJK) field names — 可视化过滤条件生成的表达式', () => {
    const cnRow = { 城市: '北京', 销量: 120, 启用: true }
    expect(compileExpr('城市')(cnRow)).toBe('北京')
    expect(compileExpr('城市 == "北京"')(cnRow)).toBe(true)
    expect(compileExpr('城市 != "上海"')(cnRow)).toBe(true)
    expect(compileExpr('销量 > 100')(cnRow)).toBe(true)
    expect(compileExpr('销量 <= 100')(cnRow)).toBe(false)
    expect(compileExpr('includes(城市, "京")')(cnRow)).toBe(true)
    expect(compileExpr('启用 == true')(cnRow)).toBe(true)
    expect(validateExpr('城市 == "北京"').ok).toBe(true)
    // 混合中英文与下划线
    expect(compileExpr('销量_sum > 10')({ 销量_sum: 20 })).toBe(true)
  })

  it('still rejects forbidden identifiers alongside Unicode support', () => {
    expect(validateExpr('城市 && process.exit()').ok).toBe(false)
    expect(validateExpr('window.城市').ok).toBe(false)
  })
})
