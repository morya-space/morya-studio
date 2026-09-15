import type { TableItem } from 'morya-ui'

export function asRow<T>(row: TableItem) {
  return row as unknown as T
}

export function asText(value: unknown) {
  return typeof value === 'string' ? value : undefined
}
