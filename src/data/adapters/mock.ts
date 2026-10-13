/**
 * Mock 数据适配器
 * MVP 阶段：模拟网络延迟后返回 staticData。
 * TODO: 后续接入 mockjs，按 mockTemplate 生成随机数据。
 */

import type { DataSourceConfig } from '../../types/schema'
import type { DataSourceAdapter, TestResult } from './base'

const MOCK_LATENCY = 300

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const mockAdapter: DataSourceAdapter = {
  async fetch(config: DataSourceConfig) {
    await delay(MOCK_LATENCY)
    return config.staticData ?? []
  },

  async test(config: DataSourceConfig): Promise<TestResult> {
    const rows = config.staticData ?? []
    return {
      ok: true,
      message: `Mock 返回 ${rows.length} rows（模拟延迟 ${MOCK_LATENCY}ms）`,
      sampleRows: rows.length,
      sample: rows.slice(0, 3),
    }
  },
}
