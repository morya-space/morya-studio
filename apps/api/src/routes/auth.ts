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

const registerSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(128),
})

const forgotSchema = z.object({
  email: z.string().email(),
})

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(128),
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

  app.post('/register', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '请检查输入格式')
    const user = c.get('identity').register(parsed.data)
    return c.json({ user }, 201)
  })

  app.post('/forgot-password', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = forgotSchema.safeParse(body)
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '邮箱格式不正确')
    const result = c.get('identity').requestPasswordReset(parsed.data.email)
    return c.json(result)
  })

  app.post('/reset-password', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = resetSchema.safeParse(body)
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '请检查输入格式')
    c.get('identity').resetPassword(parsed.data.token, parsed.data.password)
    return c.json({ ok: true })
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
