/**
 * 统一错误处理：业务错误返回结构化 ApiError，未知错误兜底 500。
 */

import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') as string | undefined
  if (err instanceof ApiError) {
    return c.json({ error: err.code, message: err.message, requestId }, err.status as never)
  }
  if (err instanceof HTTPException) {
    return c.json({ error: 'http_error', message: err.message, requestId }, err.status)
  }
  console.error('[api] unhandled error', err)
  return c.json({ error: 'internal_error', message: '服务器内部错误', requestId }, 500)
}
