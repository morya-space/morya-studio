/**
 * Pinia DataStore（v0.2）
 * 统一管理卡片数据、加载态、错误、数据源注册、请求去重、缓存与轮询。
 * 契约见 docs/DESIGN-DEV.md §6.3。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CardSchema, DataSourceConfig } from '../types/schema'
import { getAdapter } from './adapters'
import { applyTransform } from './transform/pipeline'
import { dataCache, buildCacheKey } from './cache'
import { pollScheduler } from './scheduler'

type Row = Record<string, unknown>

export const useDataStore = defineStore('data', () => {
  // ---- 状态 ----
  /** cardId → 数据行 */
  const cardData = ref(new Map<string, Row[]>())
  /** cardId → 加载态 */
  const cardLoading = ref(new Map<string, boolean>())
  /** cardId → 错误 */
  const cardError = ref(new Map<string, Error | null>())
  /** dataSourceId → 数据源配置（项目级注册） */
  const dataSources = ref(new Map<string, DataSourceConfig>())

  /** 页面级全局过滤器当前值（注入各数据源 {{var}} 插值） */
  const globalParams = ref<Record<string, unknown>>({})

  /** 进行中的请求（按 dataSource key 去重） */
  const inFlight = new Map<string, Promise<Row[]>>()

  // ---- 数据源注册 ----

  function registerDataSource(ds: DataSourceConfig): void {
    if (!ds.id) {
      console.warn('[dataStore] registerDataSource requires ds.id', ds)
      return
    }
    dataSources.value.set(ds.id, ds)
  }

  function unregisterDataSource(id: string): void {
    dataSources.value.delete(id)
  }

  /** 更新全局过滤器参数并触发刷新（由过滤器组件调用） */
  function setGlobalParams(params: Record<string, unknown>): void {
    globalParams.value = { ...params }
  }

  // ---- 数据加载 ----

  /** 解析卡片对应的数据源配置（dataSourceId 优先，回退内联） */
  function resolveDataSource(card: CardSchema): DataSourceConfig {
    if (card.dataSourceId) {
      const ds = dataSources.value.get(card.dataSourceId)
      if (!ds) throw new Error(`[dataStore] unknown dataSourceId: "${card.dataSourceId}"`)
      return ds
    }
    if (card.dataSource) return card.dataSource
    throw new Error(`[dataStore] card "${card.id}" has no dataSource`)
  }

  /** 数据源级请求（去重 + 缓存），返回未经卡片 transform 的原始行 */
  async function fetchRaw(ds: DataSourceConfig, opts: { force?: boolean; params?: Record<string, unknown> } = {}): Promise<Row[]> {
    const cacheKey = buildCacheKey(ds)
    const useCache = ds.cache?.enabled ?? false
    const ttl = ds.cache?.ttl ?? 0
    const storage = ds.cache?.storage ?? 'memory'

    if (useCache && !opts.force) {
      const cached = dataCache.get<Row[]>(cacheKey)
      if (cached !== undefined) return cached
    }

    // 请求去重：同一 dataSource 的在途请求共享一个 Promise
    const existing = inFlight.get(cacheKey)
    if (existing) return existing

    const adapter = getAdapter(ds.type)
    const ctxParams = { ...globalParams.value, ...(opts.params ?? {}) }
    const promise = adapter.fetch(ds, { params: ctxParams })
      .then(rows => {
        if (useCache) dataCache.set(cacheKey, rows, ttl, storage)
        return rows
      })
      .finally(() => { inFlight.delete(cacheKey) })

    inFlight.set(cacheKey, promise)
    return promise
  }

  /**
   * 为某张卡片加载数据（含缓存、转换、错误记录、轮询调度）。
   */
  async function loadCardData(card: CardSchema, opts: { force?: boolean; params?: Record<string, unknown> } = {}): Promise<void> {
    cardLoading.value.set(card.id, true)
    cardError.value.set(card.id, null)
    try {
      const ds = resolveDataSource(card)
      const raw = await fetchRaw(ds, opts)
      const rows = applyTransform(raw, card.transform)
      cardData.value.set(card.id, rows)

      // 调度轮询（pollInterval > 0 才启动）
      if ((ds.pollInterval ?? 0) > 0) {
        pollScheduler.start(card.id, ds.pollInterval as number, async () => {
          await loadCardData(card, { force: true })
        })
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      cardError.value.set(card.id, err)
      cardData.value.set(card.id, [])
    } finally {
      cardLoading.value.set(card.id, false)
    }
  }

  /**
   * 刷新整个页面的卡片。同一 dataSourceId 的卡片共享一次网络请求。
   */
  async function refreshPage(cards: CardSchema[], opts: { force?: boolean } = {}): Promise<void> {
    await Promise.all(cards.map(card => loadCardData(card, opts)))
  }

  /** 强制刷新某卡片（绕过缓存） */
  async function refreshCard(card: CardSchema): Promise<void> {
    await loadCardData(card, { force: true })
  }

  /** 清理某卡片的数据、错误、定时器 */
  function disposeCard(cardId: string): void {
    cardData.value.delete(cardId)
    cardLoading.value.delete(cardId)
    cardError.value.delete(cardId)
    pollScheduler.stop(cardId)
  }

  /** 清理全部（页面离开时调用） */
  function disposeAll(): void {
    cardData.value.clear()
    cardLoading.value.clear()
    cardError.value.clear()
    pollScheduler.disposeAll()
  }

  return {
    // state
    cardData,
    cardLoading,
    cardError,
    dataSources,
    globalParams,
    // actions
    registerDataSource,
    unregisterDataSource,
    setGlobalParams,
    loadCardData,
    refreshPage,
    refreshCard,
    disposeCard,
    disposeAll,
  }
})
