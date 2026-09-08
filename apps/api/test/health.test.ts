import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'

describe('aPI documentation', () => {
  it('serves OpenAPI JSON and a browser documentation page', async () => {
    const openApi = await createApp().request('/openapi.json')
    const docs = await createApp().request('/docs')

    expect(openApi.status).toBe(200)
    await expect(openApi.json()).resolves.toMatchObject({
      openapi: '3.0.3',
      paths: expect.objectContaining({ '/health': expect.anything() }),
    })
    expect(docs.status).toBe(200)
    expect(docs.headers.get('content-type')).toContain('text/html')
    await expect(docs.text()).resolves.toContain('Wise Kit Studio API')
  })
})

describe('aPI routes', () => {
  it('returns the registered route list', async () => {
    const response = await createApp().request('/api/routes')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      count: expect.any(Number),
      routes: expect.arrayContaining([
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/api/routes' },
      ]),
    })
  })
})

describe('gET /health', () => {
  it('returns the API health status and request id', async () => {
    const response = await createApp().request('/health', {
      headers: { 'x-request-id': 'test-request' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('test-request')
    await expect(response.json()).resolves.toEqual({ status: 'ok', service: 'api' })
  })

  it('returns 404 for unknown routes', async () => {
    const response = await createApp().request('/missing')

    expect(response.status).toBe(404)
  })
})
