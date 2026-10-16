/**
 * Mock 数据适配器
 * 优先按 mockTemplate（轻量模板语法，见 data/mockgen.ts）生成随机数据；
 * 无模板时回退 staticData（旧数据源兼容）。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, TestResult } from './base'
import { generateMockRows } from '../mockgen'

const MOCK_LATENCY = 300

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function rowsOf(config: DataSourceConfig): Record<string, unknown>[] {
  if (config.mockTemplate?.trim()) return generateMockRows(config.mockTemplate)
  return config.staticData ?? []
}

export const mockAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig) {
    await delay(MOCK_LATENCY)
    return rowsOf(config)
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    const rows = rowsOf(config)
    return {
      ok: true,
      message: `Mock 返回 ${rows.length} rows（模拟延迟 ${MOCK_LATENCY}ms）`,
      sampleRows: rows.length,
      sample: rows.slice(0, 3),
    }
  },
}
