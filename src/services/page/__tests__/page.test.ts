import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageSchema } from '../../../types/schema'

vi.mock('../../../lib/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import {
  deletePage,
  exportPage,
  genPageId,
  getPage,
  importPage,
  initPages,
  listPages,
  resetPages,
  savePage,
} from '../index'
import { http } from '../../../lib/http'
import { SCHEMA_VERSION } from '../../../types/schema'

function makePage(id: string, title = 'T'): PageSchema {
  return { id, title, layout: 'grid', grid: { cols: 12 }, cards: [] }
}

const mockedHttp = vi.mocked(http)

describe('page service', () => {
  beforeEach(() => {
    resetPages()
    vi.resetAllMocks()
    mockedHttp.post.mockImplementation(async (_path, page) => ({ page: page as PageSchema }))
    mockedHttp.put.mockImplementation(async (_path, page) => ({ page: page as PageSchema }))
    mockedHttp.delete.mockResolvedValue({ ok: true })
  })

  it('saves server-confirmed schema and preserves page extensions', async () => {
    const page = {
      ...makePage('p1', '看板A'),
      mode: 'screen' as const,
      groups: [{ id: 'group-1', title: '指标', order: 0 }],
      canvas: { width: 1440, height: 900, snap: 8 },
    }

    await savePage(page)

    expect(getPage('p1')).toMatchObject({
      title: '看板A',
      mode: 'screen',
      groups: [{ id: 'group-1' }],
      canvas: { width: 1440, height: 900, snap: 8 },
      meta: { version: SCHEMA_VERSION },
    })
  })

  it('does not alter cache when a save fails', async () => {
    mockedHttp.post.mockRejectedValueOnce(new Error('offline'))

    await expect(savePage(makePage('p1'))).rejects.toThrow('offline')

    expect(getPage('p1')).toBeNull()
  })

  it('serializes writes for the same page in call order', async () => {
    await savePage(makePage('p1', 'initial'))
    let releaseFirst: (() => void) | undefined
    const first = new Promise<{ page: PageSchema }>(resolve => {
      releaseFirst = () => resolve({ page: makePage('p1', 'first') })
    })
    mockedHttp.put
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async (_path, page) => ({ page: page as PageSchema }))

    const firstSave = savePage(makePage('p1', 'first'))
    const secondSave = savePage(makePage('p1', 'second'))
    await vi.waitFor(() => expect(mockedHttp.put).toHaveBeenCalledTimes(1))

    releaseFirst?.()
    await Promise.all([firstSave, secondSave])

    expect(mockedHttp.put).toHaveBeenCalledTimes(2)
    expect(getPage('p1')?.title).toBe('second')
  })

  it('retries initialization after a failed request without clearing confirmed cache', async () => {
    mockedHttp.get.mockRejectedValueOnce(new Error('offline'))
    await expect(initPages()).rejects.toThrow('offline')

    mockedHttp.get.mockResolvedValueOnce({ items: [makePage('p1', 'loaded')] })
    await initPages()

    expect(getPage('p1')?.title).toBe('loaded')
  })

  it('list returns pages sorted by updatedAt descending', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await savePage(makePage('p1', 'A'))
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    await savePage(makePage('p2', 'B'))

    expect(listPages().map(page => page.id)).toEqual(['p2', 'p1'])
    vi.useRealTimers()
  })

  it('deletes only after the server confirms deletion', async () => {
    await savePage(makePage('p1'))
    mockedHttp.delete.mockRejectedValueOnce(new Error('offline'))

    await expect(deletePage('p1')).rejects.toThrow('offline')
    expect(getPage('p1')).not.toBeNull()

    await deletePage('p1')
    expect(getPage('p1')).toBeNull()
  })

  it('exports and imports confirmed page data', async () => {
    await savePage(makePage('p1', 'X'))
    const json = exportPage('p1')
    expect(JSON.parse(json!).title).toBe('X')

    const imported = await importPage(JSON.stringify(makePage('imp1', '导入')))
    expect(imported.id).toBe('imp1')
    expect(getPage('imp1')).toBeTruthy()
  })

  it('imports a duplicate ID as a new page without overwriting the original', async () => {
    await savePage(makePage('p1', 'original'))

    const imported = await importPage(JSON.stringify(makePage('p1', 'imported')))

    expect(imported.id).not.toBe('p1')
    expect(getPage('p1')?.title).toBe('original')
    expect(getPage(imported.id)?.title).toBe('imported')
  })

  it('rejects invalid import input', async () => {
    await expect(importPage('{"foo":1}')).rejects.toThrow(/非法/)
    await expect(importPage('not json')).rejects.toThrow()
  })

  it('generates unique page IDs', () => {
    expect(genPageId()).not.toBe(genPageId())
  })
})
