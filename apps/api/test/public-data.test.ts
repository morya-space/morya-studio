import { describe, expect, it } from 'vitest'
import type { DataSourceConfig, PageSchema } from '@morya-studio/shared'
import { collectPublicDataSources, executePublicDataSource } from '../src/routes/public-data'

const page = {
  id: 'page-1',
  title: 'Shared page',
  cards: [
    { id: 'referenced', type: 'table', dataSourceId: 'stored' },
    { id: 'inline', type: 'table', dataSource: { type: 'static', staticData: [{ safe: true }] } },
  ],
} as unknown as PageSchema

describe('public data authorization', () => {
  it('only resolves referenced or inline card data sources', () => {
    const stored = new Map<string, DataSourceConfig>([
      ['stored', { id: 'stored', type: 'static', staticData: [{ id: 1 }] }],
      ['unreferenced', { id: 'unreferenced', type: 'static', staticData: [{ id: 2 }] }],
    ])

    const sources = collectPublicDataSources(page, stored)
    expect([...sources.keys()]).toEqual(['stored', 'inline:inline'])
    expect(sources.has('unreferenced')).toBe(false)
  })

  it('returns bounded static rows without exposing configuration', async () => {
    const rows = await executePublicDataSource({
      id: 'stored',
      config: { type: 'static', staticData: [{ id: 1 }, { id: 2 }] },
    })
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('rejects public WebSocket and templated mock sources', async () => {
    await expect(executePublicDataSource({ id: 'ws', config: { type: 'websocket', wsUrl: 'wss://events.example.test' } }))
      .rejects.toMatchObject({ code: 'unsupported_public_datasource' })
    await expect(executePublicDataSource({ id: 'mock', config: { type: 'mock', mockTemplate: '{"id": "@integer"}' } }))
      .rejects.toMatchObject({ code: 'unsupported_public_datasource' })
  })
})
