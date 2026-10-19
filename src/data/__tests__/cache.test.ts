import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DataCache, buildCacheKey } from '../cache'

describe('DataCache (memory)', () => {
  let cache: DataCache

  beforeEach(() => {
    cache = new DataCache()
  })

  it('set/get roundtrip', () => {
    cache.set('k1', { a: 1 }, 1000)
    expect(cache.get('k1')).toEqual({ a: 1 })
  })

  it('returns undefined for missing key', () => {
    expect(cache.get('nope')).toBeUndefined()
  })

  it('has() reflects presence', () => {
    cache.set('k', 1, 1000)
    expect(cache.has('k')).toBe(true)
    expect(cache.has('x')).toBe(false)
  })

  it('invalidate removes entry', () => {
    cache.set('k', 1, 1000)
    cache.invalidate('k')
    expect(cache.get('k')).toBeUndefined()
  })

  it('clear removes all', () => {
    cache.set('a', 1, 1000)
    cache.set('b', 2, 1000)
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('expires after ttl', () => {
    vi.useFakeTimers()
    cache.set('k', 'v', 1000)
    expect(cache.get('k')).toBe('v')
    vi.advanceTimersByTime(1001)
    expect(cache.get('k')).toBeUndefined()
    vi.useRealTimers()
  })

  it('ttl <= 0 means no expiry', () => {
    vi.useFakeTimers()
    cache.set('k', 'v', 0)
    vi.advanceTimersByTime(99999999)
    expect(cache.get('k')).toBe('v')
    vi.useRealTimers()
  })
})

describe('DataCache (localStorage)', () => {
  let cache: DataCache

  beforeEach(() => {
    localStorage.clear()
    cache = new DataCache()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists to localStorage', () => {
    cache.set('k', { x: 5 }, 10000, 'localStorage')
    // 新实例（模拟跨会话）也能读到
    const cache2 = new DataCache()
    expect(cache2.get('k')).toEqual({ x: 5 })
  })

  it('expires localStorage entry', () => {
    vi.useFakeTimers()
    cache.set('k', 'v', 1000, 'localStorage')
    vi.advanceTimersByTime(1001)
    expect(new DataCache().get('k')).toBeUndefined()
    vi.useRealTimers()
  })
})

describe('buildCacheKey', () => {
  it('uses id when present', () => {
    expect(buildCacheKey({ id: 'ds1' })).toBe('ds1:')
  })

  it('falls back to url', () => {
    expect(buildCacheKey({ url: 'https://x' })).toBe('https://x:')
  })

  it('is stable regardless of param order', () => {
    const a = buildCacheKey({ id: 'd', params: { p: 1, q: 2 } })
    const b = buildCacheKey({ id: 'd', params: { q: 2, p: 1 } })
    expect(a).toBe(b)
  })

  it('differs for different params', () => {
    const a = buildCacheKey({ id: 'd', params: { p: 1 } })
    const b = buildCacheKey({ id: 'd', params: { p: 2 } })
    expect(a).not.toBe(b)
  })

  it('includes effective request params in the key', () => {
    const a = buildCacheKey({ id: 'd', params: { status: '{{status}}' } }, { status: 'open' })
    const b = buildCacheKey({ id: 'd', params: { status: '{{status}}' } }, { status: 'closed' })
    expect(a).not.toBe(b)
  })
})
