import type { AppBindings } from '../types/context'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { clientMeta, readJson } from '../lib/http'
import { requireAuth, requirePermission, SESSION_COOKIE } from '../middleware/auth'
import {
  AuthConflictError,
  AuthCredentialsError,
  IdentityForbiddenError,
  IdentityNotFoundError,
} from '../services/identity-errors'

const credentialsSchema = z.object({
  email: z.string().trim().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 位'),
})

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, '请输入姓名').max(80, '姓名不能超过 80 个字符'),
})

const profileSchema = z.object({
  name: z.string().trim().min(1, '请输入姓名').max(80, '姓名不能超过 80 个字符'),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(6, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少需要 6 位'),
})

export function createAuthRoutes() {
  const routes = new Hono<AppBindings>()

  routes.post('/register', async (c) => {
    const input = await readJson(c, registerSchema)
    if (!input.success)
      return input.response
    try {
      const { sessionId, user } = await c.get('identity').register(
        input.data.name,
        input.data.email,
        input.data.password,
        clientMeta(c),
      )
      return createSessionResponse(c, sessionId, user)
    }
    catch (error) {
      if (error instanceof AuthConflictError)
        return c.json({ error: { code: 'EMAIL_IN_USE', message: '该邮箱已经注册，请直接登录' } }, 409)
      throw error
    }
  })

  routes.post('/login', async (c) => {
    const input = await readJson(c, credentialsSchema)
    if (!input.success)
      return input.response
    try {
      const result = await c.get('identity').login(input.data.email, input.data.password, clientMeta(c))
      return createSessionResponse(c, result.sessionId, result.user)
    }
    catch (error) {
      if (error instanceof AuthCredentialsError)
        return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码不正确' } }, 401)
      if (error instanceof IdentityForbiddenError)
        return c.json({ error: { code: 'ACCOUNT_DISABLED', message: error.message } }, 403)
      throw error
    }
  })

  routes.get('/me', requireAuth, (c) => {
    return c.json({ user: c.get('user') })
  })

  routes.patch('/profile', requireAuth, requirePermission('profile.write'), async (c) => {
    const input = await readJson(c, profileSchema)
    if (!input.success)
      return input.response
    const user = await c.get('identity').updateProfile(c.get('user')!.id, input.data.name)
    return c.json({ user })
  })

  routes.post('/password', requireAuth, requirePermission('security.write'), async (c) => {
    const input = await readJson(c, passwordSchema)
    if (!input.success)
      return input.response
    try {
      await c.get('identity').changePassword(
        c.get('user')!.id,
        input.data.currentPassword,
        input.data.newPassword,
        c.get('sessionId')!,
      )
      return c.json({ success: true })
    }
    catch (error) {
      if (error instanceof AuthCredentialsError)
        return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '当前密码不正确' } }, 401)
      throw error
    }
  })

  routes.get('/sessions', requireAuth, requirePermission('security.read'), async (c) => {
    const items = await c.get('identity').listSessions(c.get('user')!.id, c.get('sessionId')!)
    return c.json({ items })
  })

  routes.delete('/sessions/others', requireAuth, requirePermission('security.write'), async (c) => {
    await c.get('identity').revokeOtherSessions(c.get('user')!.id, c.get('sessionId')!)
    return c.json({ success: true })
  })

  routes.delete('/sessions/:id', requireAuth, requirePermission('security.write'), async (c) => {
    try {
      await c.get('identity').revokeSession(c.get('user')!, c.req.param('id'), c.get('sessionId')!)
      return c.json({ success: true })
    }
    catch (error) {
      if (error instanceof IdentityNotFoundError)
        return c.json({ error: { code: 'NOT_FOUND', message: error.message } }, 404)
      if (error instanceof IdentityForbiddenError)
        return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403)
      throw error
    }
  })

  routes.get('/login-events', requireAuth, requirePermission('security.read'), async (c) => {
    const page = Number(c.req.query('page') ?? 1) || 1
    const pageSize = Math.min(Number(c.req.query('pageSize') ?? 10) || 10, 50)
    const userId = c.req.query('userId')
    const result = await c.get('identity').listLoginEvents(c.get('user')!, { userId, page, pageSize })
    return c.json(result)
  })

  routes.post('/logout', async (c) => {
    const sessionId = c.get('sessionId') ?? getCookie(c, SESSION_COOKIE)
    if (sessionId)
      await c.get('identity').logout(sessionId)
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ success: true })
  })

  return routes
}

function createSessionResponse(c: Parameters<typeof setCookie>[0], sessionId: string, user: unknown) {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    path: '/',
  })
  return c.json({ user })
}
