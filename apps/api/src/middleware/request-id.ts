/**
 * 请求 ID：每个请求注入 x-request-id。
 */

import { randomUUID } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header('x-request-id') ?? randomUUID()
  c.set('requestId', id)
  c.header('x-request-id', id)
  await next()
}
