import { ref, computed, type Ref } from 'vue'
import type { DataSourceConfig } from '../types/schema'

export interface UseDataSourceReturn {
  data: Ref<Record<string, unknown>[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
  refresh: () => Promise<void>
}

/**
 * 数据适配器 Composable
 * 统一处理 static / mock / api 三种数据源
 */
export function useDataSource(config: DataSourceConfig): UseDataSourceReturn {
  const data = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const fetchStatic = () => {
    data.value = config.staticData ?? []
  }

  const fetchMock = async () => {
    // TODO: 接入 mock 数据生成器
    await new Promise(resolve => setTimeout(resolve, 300))
    data.value = config.staticData ?? []
  }

  const fetchApi = async () => {
    if (!config.url) {
      throw new Error('API dataSource requires url')
    }

    const response = await fetch(config.url, {
      method: config.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: config.method === 'POST' ? JSON.stringify(config.params) : undefined,
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const result = await response.json()
    data.value = Array.isArray(result) ? result : [result]
  }

  const refresh = async () => {
    loading.value = true
    error.value = null

    try {
      switch (config.type) {
        case 'static':
          fetchStatic()
          break
        case 'mock':
          await fetchMock()
          break
        case 'api':
          await fetchApi()
          break
        default:
          throw new Error(`Unknown dataSource type: ${config.type}`)
      }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  // 初始化加载
  refresh()

  return {
    data,
    loading,
    error,
    refresh,
  }
}

/**
 * 格式化数值
 */
export function formatValue(
  value: unknown,
  type: 'number' | 'currency' | 'percent' = 'number',
  precision: number = 0,
): string {
  if (value === null || value === undefined) return '-'

  const num = Number(value)
  if (Number.isNaN(num)) return String(value)

  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(num)
    case 'percent':
      return `${num.toFixed(precision)}%`
    case 'number':
    default:
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(num)
  }
}

/**
 * 获取趋势方向
 */
export function getTrendType(value: unknown): 'up' | 'down' {
  const num = Number(value)
  if (Number.isNaN(num)) return 'up'
  return num >= 0 ? 'up' : 'down'
}

/**
 * 计算总和
 */
export function useSum(data: Ref<Record<string, unknown>[]>, field: string) {
  return computed(() => {
    return data.value.reduce((sum, item) => {
      const val = Number(item[field])
      return sum + (Number.isNaN(val) ? 0 : val)
    }, 0)
  })
}
