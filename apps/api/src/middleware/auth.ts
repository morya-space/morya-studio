/**
 * 鉴权中间件：解析 Bearer 会话令牌，注入 user / sessionId。
 * requireAuth：必须登录；requirePermission：校验权限码。
 */

import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types/context'
import { ApiError } from './error-handler'

function extractToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const token = extractToken(c.req.header('authorization'))
  if (!token) throw new ApiError(401, 'unauthorized', '缺少访问令牌')
  const identity = c.get('identity')
  const user = identity.findSessionUser(token)
  if (!user) throw new ApiError(401, 'unauthorized', '会话已失效，请重新登录')
  c.set('user', user)
  c.set('sessionId', token)
  await next()
}

export function requirePermission(code: string): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) throw new ApiError(401, 'unauthorized', '请先登录')
    if (!user.permissions.includes(code)) {
      throw new ApiError(403, 'forbidden', '没有执行该操作的权限')
    }
    await next()
  }
}
