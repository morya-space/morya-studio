/**
 * 静态数据适配器
 * 直接返回 config.staticData。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, TestResult } from './base'

export const staticAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig) {
    return config.staticData ?? []
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    const rows = config.staticData ?? []
    return {
      ok: true,
      message: `${rows.length} rows`,
      sampleRows: rows.length,
      sample: rows.slice(0, 3),
    }
  },
}
