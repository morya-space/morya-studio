/**
 * 鉴权路由：登录 / 登出 / 当前用户 / 会话列表。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '../types/context'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export function createAuthRoutes() {
  const app = new Hono<AppBindings>()

  app.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '邮箱或密码格式不正确')
    const identity = c.get('identity')
    const result = identity.login(parsed.data.email, parsed.data.password, {
      ip: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    })
    if (!result) throw new ApiError(401, 'invalid_credentials', '邮箱或密码不正确')
    return c.json(result)
  })

  app.get('/me', requireAuth, (c) => {
    return c.json({ user: c.get('user') })
  })

  app.post('/logout', requireAuth, (c) => {
    c.get('identity').logout(c.get('sessionId'))
    return c.json({ ok: true })
  })

  app.get('/sessions', requireAuth, (c) => {
    const identity = c.get('identity')
    return c.json({ items: identity.listSessions(c.get('user').id, c.get('sessionId')) })
  })

  return app
}
