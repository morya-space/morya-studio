/**
 * 数值格式化工具（从 composables/useDataSource.ts 迁移）
 * 供卡片组件统一格式化数字 / 货币 / 百分比。
 */

export type FormatType = 'number' | 'currency' | 'percent'

export function formatValue(
  value: unknown,
  type: FormatType = 'number',
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

/** 趋势方向：>=0 为 up，否则 down */
export function getTrendType(value: unknown): 'up' | 'down' {
  const num = Number(value)
  if (Number.isNaN(num)) return 'up'
  return num >= 0 ? 'up' : 'down'
}

/** 求和 */
export function sumBy(data: Record<string, unknown>[], field: string): number {
  return data.reduce((sum, item) => {
    const val = Number(item[field])
    return sum + (Number.isNaN(val) ? 0 : val)
  }, 0)
}
