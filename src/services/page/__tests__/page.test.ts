import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listPages, getPage, savePage, deletePage, exportPage, importPage, genPageId } from '../index'
import { listDataSources, saveDataSource, deleteDataSource, genDataSourceId, getDataSource } from '../../datasource'
import type { PageSchema } from '../../../types/schema'

function makePage(id: string, title = 'T'): PageSchema {
  return { id, title, layout: 'grid', grid: { cols: 12 }, cards: [] }
}

describe('page service', () => {
  beforeEach(() => localStorage.clear())

  it('save and get roundtrip', () => {
    savePage(makePage('p1', '看板A'))
    expect(getPage('p1')?.title).toBe('看板A')
  })

  it('save stamps version and timestamps', () => {
    savePage(makePage('p1'))
    const p = getPage('p1')!
    expect(p.meta?.version).toBe(2)
    expect(p.meta?.createdAt).toBeTruthy()
    expect(p.meta?.updatedAt).toBeTruthy()
  })

  it('list returns sorted by updatedAt desc', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    savePage(makePage('p1', 'A'))
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    savePage(makePage('p2', 'B'))
    const list = listPages()
    expect(list.length).toBe(2)
    // 最新保存的排前
    expect(list[0].id).toBe('p2')
    expect(list[1].id).toBe('p1')
    vi.useRealTimers()
  })

  it('delete removes page', () => {
    savePage(makePage('p1'))
    deletePage('p1')
    expect(getPage('p1')).toBeNull()
  })

  it('export returns JSON string', () => {
    savePage(makePage('p1', 'X'))
    const json = exportPage('p1')
    expect(json).toBeTruthy()
    expect(JSON.parse(json!).title).toBe('X')
  })

  it('import parses and saves', () => {
    const json = JSON.stringify(makePage('imp1', '导入'))
    const page = importPage(json)
    expect(page.id).toBe('imp1')
    expect(getPage('imp1')).toBeTruthy()
  })

  it('import rejects invalid json', () => {
    expect(() => importPage('{"foo":1}')).toThrow(/非法/)
    expect(() => importPage('not json')).toThrow()
  })

  it('genPageId returns unique ids', () => {
    expect(genPageId()).not.toBe(genPageId())
  })
})

describe('datasource service', () => {
  beforeEach(() => localStorage.clear())

  it('save and list', () => {
    saveDataSource({ id: 'ds1', name: 'API', type: 'api', url: 'https://x' })
    expect(listDataSources()).toHaveLength(1)
    expect(getDataSource('ds1')?.name).toBe('API')
  })

  it('save requires id', () => {
    expect(() => saveDataSource({ type: 'api' } as never)).toThrow(/id/)
  })

  it('delete removes', () => {
    saveDataSource({ id: 'ds1', type: 'static', staticData: [] })
    deleteDataSource('ds1')
    expect(getDataSource('ds1')).toBeNull()
  })

  it('genDataSourceId unique', () => {
    expect(genDataSourceId()).not.toBe(genDataSourceId())
  })
})
