import { describe, expect, it } from 'vitest'
import { dsSchema } from '../src/routes/datasources'

describe('datasource request schema', () => {
  it('preserves extended HTTP, WebSocket, and SQL fields', () => {
    const input = {
      id: 'source-1',
      name: 'Reporting API',
      type: 'sql',
      method: 'PATCH',
      url: 'https://api.example.test/reports',
      headers: { 'X-Api-Key': 'secret' },
      params: { region: 'north' },
      bodyType: 'x-www-form-urlencoded',
      body: 'status=active',
      timeoutMs: 12_000,
      retry: { count: 2, delayMs: 500 },
      wsUrl: 'wss://events.example.test',
      ws: { messagePath: 'data.items', aggregate: 'append' },
      cache: { enabled: true, ttl: 60_000, storage: 'memory' },
      auth: { type: 'bearer', token: 'token' },
      sql: {
        driver: 'mysql',
        host: 'db.example.test',
        port: 3306,
        database: 'reports',
        user: 'reader',
        password: 'secret',
        query: 'SELECT * FROM reports',
        limit: 250,
      },
      computedFields: [{ name: 'margin', expr: 'row.revenue - row.cost' }],
      transform: 'legacy-transform',
    }

    expect(dsSchema.parse(input)).toEqual(input)
  })

  it('rejects invalid SQL and WebSocket contract values', () => {
    expect(dsSchema.safeParse({ name: 'bad', type: 'sql', sql: { port: 0 } }).success).toBe(false)
    expect(dsSchema.safeParse({ name: 'bad', type: 'websocket', ws: { aggregate: 'invalid' } }).success).toBe(false)
  })
})
