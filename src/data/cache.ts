/**
 * 数据缓存层（v0.2）
 * 内存 Map + 可选 localStorage，支持 TTL 过期。
 * 契约见 docs/DESIGN-DEV.md §6.3。
 */

export interface CacheEntry<T = unknown> {
  data: T
  /** 过期时间戳（ms since epoch） */
  expireAt: number
}

const LS_PREFIX = 'morya-studio:cache:'

export class DataCache {
  private memory = new Map<string, CacheEntry>()

  /**
   * 读取缓存。过期或不存在返回 undefined。
   */
  get<T = unknown>(key: string): T | undefined {
    // 内存优先
    const mem = this.memory.get(key)
    if (mem) {
      if (mem.expireAt > now()) return mem.data as T
      this.memory.delete(key)
      return undefined
    }
    // 回退 localStorage
    const ls = this.readLocal<T>(key)
    if (ls && ls.expireAt > now()) {
      // 回填内存，加速下次
      this.memory.set(key, ls)
      return ls.data
    }
    if (ls) this.removeLocal(key)
    return undefined
  }

  /**
   * 写入缓存。
   * @param ttl 有效期（ms）；<=0 表示不过期
   * @param storage 'memory'（默认）| 'localStorage'
   */
  set(key: string, data: unknown, ttl: number, storage: 'memory' | 'localStorage' = 'memory'): void {
    const expireAt = ttl > 0 ? now() + ttl : Number.MAX_SAFE_INTEGER
    const entry: CacheEntry = { data, expireAt }
    if (storage === 'localStorage') {
      this.writeLocal(key, entry)
    } else {
      this.memory.set(key, entry)
    }
  }

  /** 判断是否存在有效缓存 */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  invalidate(key: string): void {
    this.memory.delete(key)
    this.removeLocal(key)
  }

  clear(): void {
    this.memory.clear()
    this.clearLocal()
  }

  // ---------------- localStorage ----------------

  private lsAvailable(): boolean {
    try {
      return typeof localStorage !== 'undefined'
    } catch {
      return false
    }
  }

  private readLocal<T>(key: string): CacheEntry<T> | null {
    if (!this.lsAvailable()) return null
    try {
      const raw = localStorage.getItem(LS_PREFIX + key)
      if (!raw) return null
      return JSON.parse(raw) as CacheEntry<T>
    } catch {
      return null
    }
  }

  private writeLocal(key: string, entry: CacheEntry): void {
    if (!this.lsAvailable()) return
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
    } catch {
      // 隐私模式 / 配额超限 —— 静默降级为仅内存
      this.memory.set(key, entry)
    }
  }

  private removeLocal(key: string): void {
    if (!this.lsAvailable()) return
    try {
      localStorage.removeItem(LS_PREFIX + key)
    } catch { /* ignore */ }
  }

  private clearLocal(): void {
    if (!this.lsAvailable()) return
    try {
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(LS_PREFIX)) toRemove.push(k)
      }
      toRemove.forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
  }
}

function now(): number {
  return Date.now()
}

/** 由 dataSource 配置构造稳定缓存 key */
export function buildCacheKey(config: { id?: string; url?: string; params?: Record<string, unknown> }): string {
  const base = config.id ?? config.url ?? 'anon'
  const params = config.params ? stableStringify(config.params) : ''
  return `${base}:${params}`
}

/** 键排序后的稳定序列化（保证同参同 key） */
function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort()
  return keys.map(k => `${k}=${String(obj[k])}`).join('&')
}

/** 全局单例 */
export const dataCache = new DataCache()
