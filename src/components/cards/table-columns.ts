/**
 * 表格列规格化（TableCard / ScrollTableCard 共用）。
 *
 * 列来源有两种形态：
 * - 手工 / 模板配置：TableColumn 对象数组（含 title / width / render …）
 * - 装配面板「表格列」入参：字段名字符串数组（deriveBindings 输出）
 * 统一规整为 TableColumn[]；未配置列时回退为数据首行的全部字段。
 */

import type { TableColumn } from '../../types/schema'

type Row = Record<string, unknown>

export function normalizeTableColumns(
  columns: readonly (TableColumn | string)[] | undefined,
  rows: readonly Row[],
): TableColumn[] {
  if (columns?.length) {
    return columns.map(col => (typeof col === 'string' ? { key: col, title: col } : col))
  }
  const first = rows[0]
  if (!first) return []
  return Object.keys(first).map(key => ({ key, title: key }))
}
