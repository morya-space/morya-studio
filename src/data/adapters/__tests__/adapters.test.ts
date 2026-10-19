import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { staticAdapter } from '../static'
import { mockAdapter } from '../mock'
import { apiAdapter, interpolate } from '../api'
import { websocketAdapter } from '../websocket'
import { getAdapter, hasAdapter, getByPath, ensureArray } from '../index'
import type { DataSourceConfig } from '../../../types/schema'

describe('registry', () => {
  it('has builtin adapters', () => {
    expect(hasAdapter('static')).toBe(true)
    expect(hasAdapter('api')).toBe(true)
    expect(hasAdapter('mock')).toBe(true)
    expect(hasAdapter('websocket')).toBe(true)
    expect(hasAdapter('sql')).toBe(true)
  })

  it('getAdapter returns adapter or throws for unknown', () => {
    expect(getAdapter('static')).toBe(staticAdapter)
    expect(() => getAdapter('unknown-type' as never)).toThrow(/No adapter/)
  })
})

describe('base utils', () => {
  it('getByPath resolves nested and array paths', () => {
    const obj = { data: { list: [{ id: 1 }] }, total: 3 }
    expect(getByPath(obj, 'data.list')).toEqual([{ id: 1 }])
    expect(getByPath(obj, 'data.list[0].id')).toBe(1)
    expect(getByPath(obj, 'missing.deep')).toBeUndefined()
    expect(getByPath(obj, '')).toBe(obj)
  })

  it('ensureArray wraps values', () => {
    expect(ensureArray([1, 2])).toEqual([1, 2])
    expect(ensureArray({ a: 1 })).toEqual([{ a: 1 }])
    expect(ensureArray(null)).toEqual([])
    expect(ensureArray('x')).toEqual([])
  })
})

describe('staticAdapter', () => {
  it('returns staticData', async () => {
    const config: DataSourceConfig = { type: 'static', staticData: [{ a: 1 }] }
    expect(await staticAdapter.fetch(config)).toEqual([{ a: 1 }])
  })

  it('returns empty array when no staticData', async () => {
    expect(await staticAdapter.fetch({ type: 'static' })).toEqual([])
  })

  it('test returns sample', async () => {
    const config: DataSourceConfig = { type: 'static', staticData: [{ a: 1 }, { a: 2 }] }
    const r = await staticAdapter.test!(config)
    expect(r.ok).toBe(true)
    expect(r.sampleRows).toBe(2)
  })
})

describe('mockAdapter', () => {
  it('generates rows from mockTemplate', async () => {
    const config: DataSourceConfig = { type: 'mock', mockTemplate: '{"a":1}' }
    const out = await mockAdapter.fetch(config)
    expect(out).toEqual([{ a: 1 }])
  })

  it('returns staticData when no mockTemplate (fixed-data mode)', async () => {
    const config: DataSourceConfig = { type: 'mock', staticData: [{ a: 1 }, { a: 2 }] }
    const out = await mockAdapter.fetch(config)
    expect(out).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('returns empty rows when neither mode is configured', async () => {
    const out = await mockAdapter.fetch({ type: 'mock' })
    expect(out).toEqual([])
  })
})

describe('interpolate', () => {
  it('replaces {{var}} with values', () => {
    expect(interpolate('page={{page}}', { page: 2 })).toBe('page=2')
    expect(interpolate('{{ a.b }}', { a: { b: 'x' } })).toBe('x')
    expect(interpolate('{{missing}}', {})).toBe('{{missing}}')
    expect(interpolate('no-vars', { a: 1 })).toBe('no-vars')
  })
})

describe('apiAdapter', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('requires url', async () => {
    await expect(apiAdapter.fetch({ type: 'api' })).rejects.toThrow(/url is required/)
  })

  it('GET with array response', async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: 1 }]))
    const out = await apiAdapter.fetch({ type: 'api', url: 'https://x.test/list' })
    expect(out).toEqual([{ id: 1 }])
    expect(mockFetch).toHaveBeenCalledWith('https://x.test/list', expect.objectContaining({ method: 'GET' }))
  })

  it('extracts dataPath', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ code: 0, data: { list: [{ id: 7 }] } }))
    const out = await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/list',
      dataPath: 'data.list',
    })
    expect(out).toEqual([{ id: 7 }])
  })

  it('appends GET query params with interpolation', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await apiAdapter.fetch(
      { type: 'api', url: 'https://x.test/list', params: { page: '{{page}}', size: 10 } },
      { params: { page: 3 } },
    )
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('page=3')
    expect(calledUrl).toContain('size=10')
  })

  it('POST sends JSON body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/create',
      method: 'POST',
      params: { name: 'a' },
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'a' }))
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('PUT sends JSON body (default bodyType)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/update',
      method: 'PUT',
      params: { id: 1 },
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ id: 1 }))
  })

  it('form bodyType encodes urlencoded', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/form',
      method: 'POST',
      bodyType: 'form',
      params: { a: '1', b: '2' },
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBe('a=1&b=2')
  })

  it('bodyType none sends no body and appends query', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/q',
      method: 'DELETE',
      bodyType: 'none',
      params: { id: 5 },
    })
    const [calledUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
    expect(calledUrl).toContain('id=5')
  })

  it('explicit body string is sent as-is', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/raw',
      method: 'POST',
      bodyType: 'json',
      body: '{"raw":true}',
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe('{"raw":true}')
  })

  it('injects bearer auth header', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/x',
      auth: { type: 'bearer', token: 'tok123' },
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123')
  })

  it('injects apikey header', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/x',
      auth: { type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'secret' },
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret')
  })

  it('injects basic auth header', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/x',
      auth: { type: 'basic', username: 'u', password: 'p' },
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('u:p')}`)
  })

  it('throws on non-2xx', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 404))
    await expect(apiAdapter.fetch({ type: 'api', url: 'https://x.test/x' })).rejects.toThrow(/404/)
  })

  it('retries on failure then succeeds', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]))
    const out = await apiAdapter.fetch({
      type: 'api',
      url: 'https://x.test/retry',
      retry: { count: 1, delayMs: 0 },
    })
    expect(out).toEqual([{ id: 1 }])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('test() reports status and duration', async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: 1 }]))
    const r = await apiAdapter.test!({ type: 'api', url: 'https://x.test/x' })
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(typeof r.durationMs).toBe('number')
  })

  it('test() reports success with sample', async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: 1 }, { id: 2 }]))
    const r = await apiAdapter.test!({ type: 'api', url: 'https://x.test/x' })
    expect(r.ok).toBe(true)
    expect(r.sampleRows).toBe(2)
  })

  it('test() reports failure gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))
    const r = await apiAdapter.test!({ type: 'api', url: 'https://x.test/x' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('network down')
  })
})

describe('websocketAdapter', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('collects first message and applies messagePath', async () => {
    class FakeWS {
      onopen: (() => void) | null = null
      onmessage: ((ev: { data: string }) => void) | null = null
      onerror: (() => void) | null = null
      onclose: (() => void) | null = null
      constructor(public url: string) {
        setTimeout(() => this.onmessage?.({ data: JSON.stringify({ data: { list: [{ a: 1 }] } }) }), 0)
      }
      close() { /* noop */ }
    }
    vi.stubGlobal('WebSocket', FakeWS)

    const out = await websocketAdapter.fetch({
      type: 'websocket',
      wsUrl: 'ws://x',
      ws: { messagePath: 'data.list', aggregate: 'first' },
    })
    expect(out).toEqual([{ a: 1 }])
  })
})
