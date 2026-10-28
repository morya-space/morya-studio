/**
 * Mock 数据适配器
 * 两种模式（二选一，由配置决定）：
 * - 模板模式：配置 mockTemplate，按轻量模板语法（见 data/mockgen.ts）随机生成数据
 * - 固定数据：未配置模板时，直接返回 staticData
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
    const started = Date.now()
    const rows = rowsOf(config)
    return {
      ok: true,
      message: `Mock 返回 ${rows.length} rows（模拟延迟 ${MOCK_LATENCY}ms）`,
      sampleRows: rows.length,
      sample: rows.slice(0, 3),
      rows,
      durationMs: Date.now() - started + MOCK_LATENCY,
      raw: rows[0],
    }
  },
}
