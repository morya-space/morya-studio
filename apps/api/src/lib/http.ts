import type { Context } from 'hono'
import type { z } from 'zod'

export async function readJson<T extends z.ZodType>(c: Context, schema: T) {
  let body: unknown
  try {
    body = await c.req.json()
  }
  catch {
    return {
      success: false as const,
      response: c.json({ error: { code: 'INVALID_JSON', message: '请求内容不是有效 JSON' } }, 400),
    }
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      success: false as const,
      response: c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.issues[0]?.message ?? '请求参数不正确',
        },
      }, 400),
    }
  }

  return { success: true as const, data: result.data as z.output<T> }
}

export function clientMeta(c: Context) {
  return {
    ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? c.req.header('x-real-ip')
      ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  }
}
