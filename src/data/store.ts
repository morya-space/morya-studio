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
import { cardUsesData } from '../engine/utils'

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

  interface InFlightRequest {
    promise: Promise<Row[]>
    controller: AbortController
    consumers: Set<string>
  }

  /** 进行中的请求（按实际请求参数去重） */
  const inFlight = new Map<string, InFlightRequest>()
  /** cardId → 最近一次加载标识，避免旧请求覆盖新筛选结果 */
  const activeLoads = new Map<string, number>()
  /** cardId → 当前请求租约，用于快速筛选时中止过期请求 */
  const cardRequests = new Map<string, { cacheKey: string; consumerKey: string }>()
  /** cardId → 已调度轮询的数据源指纹 */
  const cardPollSources = new Map<string, string>()
  let nextLoadId = 0

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
  function fetchRaw(
    ds: DataSourceConfig,
    consumerKey: string,
    opts: { force?: boolean; params?: Record<string, unknown> } = {},
  ): { cacheKey: string; promise: Promise<Row[]> } {
    const ctxParams = { ...globalParams.value, ...(opts.params ?? {}) }
    const cacheKey = buildCacheKey(ds, ctxParams)
    const useCache = ds.cache?.enabled ?? false
    const ttl = ds.cache?.ttl ?? 0
    const storage = ds.cache?.storage ?? 'memory'

    if (useCache && !opts.force) {
      const cached = dataCache.get<Row[]>(cacheKey)
      if (cached !== undefined) return { cacheKey, promise: Promise.resolve(cached) }
    }

    // 相同数据源和实际筛选参数的请求共享一个 Promise。
    const existing = inFlight.get(cacheKey)
    if (existing) {
      existing.consumers.add(consumerKey)
      return { cacheKey, promise: existing.promise }
    }

    const adapter = getAdapter(ds.type)
    const controller = new AbortController()
    const request: InFlightRequest = {
      controller,
      consumers: new Set([consumerKey]),
      promise: Promise.resolve([]),
    }
    const promise = adapter.fetch(ds, { params: ctxParams, signal: controller.signal })
      .then(rows => {
        if (useCache) dataCache.set(cacheKey, rows, ttl, storage)
        return rows
      })
      .finally(() => {
        if (inFlight.get(cacheKey) === request) inFlight.delete(cacheKey)
      })

    request.promise = promise
    inFlight.set(cacheKey, request)
    return { cacheKey, promise }
  }

  function releaseRequest(cacheKey: string, consumerKey: string): void {
    const request = inFlight.get(cacheKey)
    if (!request) return
    request.consumers.delete(consumerKey)
    if (request.consumers.size === 0) request.controller.abort()
  }

  function cancelCardRequest(cardId: string): void {
    const lease = cardRequests.get(cardId)
    if (!lease) return
    cardRequests.delete(cardId)
    releaseRequest(lease.cacheKey, lease.consumerKey)
  }

  /**
   * 为某张卡片加载数据（含缓存、转换、错误记录、轮询调度）。
   */
  async function loadCardData(card: CardSchema, opts: { force?: boolean; params?: Record<string, unknown> } = {}): Promise<void> {
    const loadId = ++nextLoadId
    activeLoads.set(card.id, loadId)
    cancelCardRequest(card.id)
    cardLoading.value.set(card.id, true)
    cardError.value.set(card.id, null)
    try {
      const ds = resolveDataSource(card)
      const sourceSignature = JSON.stringify(ds)
      if (cardPollSources.get(card.id) !== sourceSignature) {
        pollScheduler.stop(card.id)
        cardPollSources.delete(card.id)
      }
      if ((ds.pollInterval ?? 0) <= 0) {
        pollScheduler.stop(card.id)
        cardPollSources.delete(card.id)
      }
      const consumerKey = `${card.id}:${loadId}`
      const request = fetchRaw(ds, consumerKey, opts)
      cardRequests.set(card.id, { cacheKey: request.cacheKey, consumerKey })
      let raw: Row[]
      try {
        raw = await request.promise
      } finally {
        releaseRequest(request.cacheKey, consumerKey)
        if (cardRequests.get(card.id)?.consumerKey === consumerKey) cardRequests.delete(card.id)
      }
      if (activeLoads.get(card.id) !== loadId) return
      const rows = applyTransform(raw, card.transform)
      cardData.value.set(card.id, rows)

      // 调度轮询（pollInterval > 0 才启动）
      if ((ds.pollInterval ?? 0) > 0) {
        pollScheduler.start(card.id, ds.pollInterval as number, async () => {
          await loadCardData(card, { force: true })
        })
        cardPollSources.set(card.id, sourceSignature)
      }
    } catch (e) {
      if (activeLoads.get(card.id) !== loadId) return
      const err = e instanceof Error ? e : new Error(String(e))
      cardError.value.set(card.id, err)
      cardData.value.set(card.id, [])
    } finally {
      if (activeLoads.get(card.id) === loadId) {
        cardLoading.value.set(card.id, false)
      }
    }
  }

  /**
   * 刷新整个页面的卡片。同一 dataSourceId 的卡片共享一次网络请求。
   */
  async function refreshPage(cards: CardSchema[], opts: { force?: boolean } = {}): Promise<void> {
    await Promise.all(cards.filter(cardUsesData).map(card => loadCardData(card, opts)))
  }

  /** 强制刷新某卡片（绕过缓存） */
  async function refreshCard(card: CardSchema, params?: Record<string, unknown>): Promise<void> {
    await loadCardData(card, { force: true, params })
  }

  /** 清理某卡片的数据、错误、定时器 */
  function disposeCard(cardId: string): void {
    activeLoads.delete(cardId)
    cancelCardRequest(cardId)
    cardPollSources.delete(cardId)
    cardData.value.delete(cardId)
    cardLoading.value.delete(cardId)
    cardError.value.delete(cardId)
    pollScheduler.stop(cardId)
  }

  /** 清理全部（页面离开时调用） */
  function disposeAll(): void {
    activeLoads.clear()
    cardRequests.clear()
    cardPollSources.clear()
    for (const request of inFlight.values()) request.controller.abort()
    inFlight.clear()
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
