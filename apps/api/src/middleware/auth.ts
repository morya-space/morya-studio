import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types/context'
import { getCookie } from 'hono/cookie'

export const SESSION_COOKIE = 'morya_session'

export const optionalAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE)
  if (sessionId) {
    const user = await c.get('identity').getUserBySession(sessionId)
    if (user) {
      c.set('user', user)
      c.set('sessionId', sessionId)
    }
  }
  await next()
}

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE)
  const user = sessionId ? await c.get('identity').getUserBySession(sessionId) : null
  if (!user) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: '请先登录' } }, 401)
  }
  c.set('user', user)
  c.set('sessionId', sessionId)
  await next()
}

export function requirePermission(...codes: string[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get('user')
    if (!user)
      return c.json({ error: { code: 'UNAUTHENTICATED', message: '请先登录' } }, 401)
    if (!codes.some(code => user.permissions.includes(code)))
      return c.json({ error: { code: 'FORBIDDEN', message: '没有执行该操作的权限' } }, 403)
    await next()
  }
}
