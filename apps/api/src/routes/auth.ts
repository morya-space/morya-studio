import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import type { AuthService } from '../services/auth'
import { AuthConflictError, AuthCredentialsError } from '../services/auth'

const credentialsSchema = z.object({
  email: z.string().trim().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 位'),
})

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, '请输入姓名').max(80, '姓名不能超过 80 个字符'),
})

const sessionCookie = 'morya_session'

export function createAuthRoutes(auth: AuthService) {
  const routes = new Hono()

  routes.post('/register', async (c) => {
    const input = await readJson(c, registerSchema)
    if (!input.success) return input.response

    try {
      const user = await auth.register(input.data.name, input.data.email, input.data.password)
      return await createSessionResponse(c, auth, user)
    } catch (error) {
      if (error instanceof AuthConflictError) {
        return c.json({ error: { code: 'EMAIL_IN_USE', message: '该邮箱已经注册，请直接登录' } }, 409)
      }
      throw error
    }
  })

  routes.post('/login', async (c) => {
    const input = await readJson(c, credentialsSchema)
    if (!input.success) return input.response

    try {
      const user = await auth.login(input.data.email, input.data.password)
      return await createSessionResponse(c, auth, user)
    } catch (error) {
      if (error instanceof AuthCredentialsError) {
        return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码不正确' } }, 401)
      }
      throw error
    }
  })

  routes.get('/me', async (c) => {
    const user = await getSessionUser(c, auth)
    return user ? c.json({ user }) : c.json({ error: { code: 'UNAUTHENTICATED', message: '请先登录' } }, 401)
  })

  routes.post('/logout', async (c) => {
    const sessionId = getCookie(c, sessionCookie)
    if (sessionId) await auth.deleteSession(sessionId)
    deleteCookie(c, sessionCookie, { path: '/' })
    return c.json({ success: true })
  })

  return routes
}

async function getSessionUser(c: Context, auth: AuthService) {
  const sessionId = getCookie(c, sessionCookie)
  return sessionId ? auth.getUserBySession(sessionId) : null
}

async function createSessionResponse(c: Context, auth: AuthService, user: { id: string; name: string; email: string }) {
  setCookie(c, sessionCookie, await auth.createSession(user.id), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    path: '/',
  })
  return c.json({ user })
}

async function readJson<T extends z.ZodType>(c: Context, schema: T) {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return { success: false as const, response: c.json({ error: { code: 'INVALID_JSON', message: '请求内容不是有效 JSON' } }, 400) }
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return { success: false as const, response: c.json({ error: { code: 'VALIDATION_ERROR', message: result.error.issues[0]?.message ?? '请求参数不正确' } }, 400) }
  }
  return { success: true as const, data: result.data as z.output<T> }
}