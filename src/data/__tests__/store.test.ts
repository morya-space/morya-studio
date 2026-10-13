import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store'
import { registerAdapter } from '../adapters'
import { dataCache } from '../cache'
import { pollScheduler } from '../scheduler'
import type { CardSchema, DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter } from '../adapters/base'

function makeCard(partial: Partial<CardSchema>): CardSchema {
  return { id: 'card-1', type: 'stat', ...partial } as CardSchema
}

describe('useDataStore', () => {
  let store: ReturnType<typeof useDataStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useDataStore()
    dataCache.clear()
    pollScheduler.disposeAll()
  })

  afterEach(() => {
    store.disposeAll()
  })

  it('loads inline static data', async () => {
    const card = makeCard({
      dataSource: { type: 'static', staticData: [{ a: 1 }] },
    })
    await store.loadCardData(card)
    expect(store.cardData.get('card-1')).toEqual([{ a: 1 }])
    expect(store.cardLoading.get('card-1')).toBe(false)
    expect(store.cardError.get('card-1')).toBeNull()
  })

  it('applies card transform after fetch', async () => {
    const card = makeCard({
      dataSource: { type: 'static', staticData: [{ v: 1 }, { v: 5 }, { v: 3 }] },
      transform: [
        { op: 'filter', expr: 'v > 1' },
        { op: 'sort', field: 'v', order: 'desc' },
      ],
    })
    await store.loadCardData(card)
    expect(store.cardData.get('card-1')!.map(r => r.v)).toEqual([5, 3])
  })

  it('resolves registered dataSourceId', async () => {
    const ds: DataSourceConfig = { id: 'ds-1', type: 'static', staticData: [{ x: 9 }] }
    store.registerDataSource(ds)
    const card = makeCard({ dataSourceId: 'ds-1' })
    await store.loadCardData(card)
    expect(store.cardData.get('card-1')).toEqual([{ x: 9 }])
  })

  it('errors when dataSourceId unknown', async () => {
    const card = makeCard({ dataSourceId: 'missing' })
    await store.loadCardData(card)
    expect(store.cardError.get('card-1')?.message).toMatch(/unknown dataSourceId/)
    expect(store.cardData.get('card-1')).toEqual([])
  })

  it('errors when card has no dataSource at all', async () => {
    const card = makeCard({})
    await store.loadCardData(card)
    expect(store.cardError.get('card-1')?.message).toMatch(/no dataSource/)
  })

  it('dedupes concurrent requests for the same dataSource', async () => {
    let calls = 0
    const slow: DataSourceAdapter = {
      fetch: async () => {
        calls++
        await new Promise(r => setTimeout(r, 50))
        return [{ n: calls }]
      },
    }
    registerAdapter('api', slow) // 覆盖 api 以便追踪

    const ds: DataSourceConfig = { id: 'shared', type: 'api', url: 'https://x' }
    store.registerDataSource(ds)

    const c1 = makeCard({ id: 'a', dataSourceId: 'shared' })
    const c2 = makeCard({ id: 'b', dataSourceId: 'shared' })

    // 并发刷新（同一 dataSource 应只发一次真实请求）
    await Promise.all([store.loadCardData(c1), store.loadCardData(c2)])
    expect(calls).toBe(1)
    expect(store.cardData.get('a')).toEqual([{ n: 1 }])
    expect(store.cardData.get('b')).toEqual([{ n: 1 }])
  })

  it('uses cache when enabled', async () => {
    let calls = 0
    const counter: DataSourceAdapter = {
      fetch: async () => { calls++; return [{ n: calls }] },
    }
    registerAdapter('api', counter)

    const ds: DataSourceConfig = {
      id: 'cached', type: 'api', url: 'https://x',
      cache: { enabled: true, ttl: 60000 },
    }
    store.registerDataSource(ds)
    const card = makeCard({ dataSourceId: 'cached' })

    await store.loadCardData(card)
    expect(calls).toBe(1)

    // 第二次命中缓存，不再请求
    await store.loadCardData(card)
    expect(calls).toBe(1)
    expect(store.cardData.get('card-1')).toEqual([{ n: 1 }])

    // force 绕过缓存
    await store.loadCardData(card, { force: true })
    expect(calls).toBe(2)
  })

  it('schedules polling when pollInterval > 0', async () => {
    vi.useFakeTimers()
    const task = vi.fn().mockResolvedValue([{ t: 1 }])
    registerAdapter('api', { fetch: task })

    const ds: DataSourceConfig = { id: 'poll', type: 'api', url: 'https://x', pollInterval: 1000 }
    store.registerDataSource(ds)
    const card = makeCard({ dataSourceId: 'poll' })

    await store.loadCardData(card)
    expect(task).toHaveBeenCalledTimes(1)
    expect(pollScheduler.isRunning('card-1')).toBe(true)

    await vi.advanceTimersByTimeAsync(3000)
    expect(task.mock.calls.length).toBeGreaterThanOrEqual(3)
    vi.useRealTimers()
  })

  it('disposeCard clears data and stops polling', async () => {
    vi.useFakeTimers()
    registerAdapter('api', { fetch: vi.fn().mockResolvedValue([{ t: 1 }]) })
    const ds: DataSourceConfig = { id: 'poll2', type: 'api', url: 'https://x', pollInterval: 1000 }
    store.registerDataSource(ds)
    const card = makeCard({ dataSourceId: 'poll2' })
    await store.loadCardData(card)

    store.disposeCard('card-1')
    expect(store.cardData.has('card-1')).toBe(false)
    expect(pollScheduler.isRunning('card-1')).toBe(false)
    vi.useRealTimers()
  })

  it('refreshPage loads all cards', async () => {
    const cards = [
      makeCard({ id: 'a', dataSource: { type: 'static', staticData: [{ v: 1 }] } }),
      makeCard({ id: 'b', dataSource: { type: 'static', staticData: [{ v: 2 }] } }),
    ]
    await store.refreshPage(cards)
    expect(store.cardData.get('a')).toEqual([{ v: 1 }])
    expect(store.cardData.get('b')).toEqual([{ v: 2 }])
  })
})
