/**
 * 数据源详情服务：对接后端 /api/datasources/:id/detail、/test、/sync。
 * 替代原 mock 数据服务，提供真实的数据源详情页数据。
 */

import { http } from '../../lib/http'

export interface DataSourceDetail {
  icon: string
  name: string
  type: string
  desc: string
  tags: string[]
  connTitle: string
  kpis: [string, string, string, string?][]
  conn: [string, string][]
  chart: { title: string; tag: string; unit: string; labels: string[]; vals: number[]; max: number }
  fields: [string, string, string, string, string, string, string][]
  preview: [string, string[], string[][]]
  syncs: [string, string, string, string][]
  boards: [string, string][]
  syncOk: string
  testOk: string
  quality: [string, number, string][]
}

export interface TestResult {
  ok: boolean
  message?: string
  sampleRows?: number
  sample?: Record<string, unknown>[]
}

export interface SyncResult {
  ok: boolean
  message?: string
  rows?: number
}

/** 获取数据源详情页数据 */
export async function getDataSourceDetail(id: string): Promise<DataSourceDetail> {
  const { detail } = await http.get<{ detail: DataSourceDetail }>(`/datasources/${id}/detail`)
  return detail
}

/** 测试数据源连接 */
export async function testDataSourceConnection(id: string): Promise<TestResult> {
  return http.post<TestResult>(`/datasources/${id}/test`)
}

/** 手动触发数据同步 */
export async function syncDataSource(id: string): Promise<SyncResult> {
  return http.post<SyncResult>(`/datasources/${id}/sync`)
}
