/**
 * 「数据配置」弹窗草稿
 * 弹窗内对数据源 / 引用 / 字段映射的修改先写入草稿，
 * 点「完成」才一次性提交回卡片（关闭或取消则丢弃）。
 */

import type { ComputedField, DataSourceConfig } from '../../types/schema'

export interface DataConfigDraft {
  dataSource?: DataSourceConfig
  dataSourceId?: string
  /** Role-field path to value patch, committed atomically with the data source. */
  bindings: Record<string, unknown>
  /** 计算列草稿；undefined 表示未编辑（提交时保持原值） */
  computedFields?: ComputedField[]
}
