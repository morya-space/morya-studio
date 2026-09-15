import type { AppBindings } from '../types/context'
import { Hono } from 'hono'
import { z } from 'zod'
import { readJson } from '../lib/http'
import { mapIdentityError } from '../lib/identity-http'
import { requireAuth, requirePermission } from '../middleware/auth'

const createUserSchema = z.object({
  name: z.string().trim().min(1, '请输入姓名').max(80, '姓名不能超过 80 个字符'),
  email: z.string().trim().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 位'),
  status: z.enum(['active', 'disabled']).optional(),
  roleIds: z.array(z.string().min(1)).min(1, '请至少选择一个角色'),
})

const updateUserSchema = z.object({
  name: z.string().trim().min(1, '请输入姓名').max(80, '姓名不能超过 80 个字符').optional(),
  email: z.string().trim().email('请输入有效的邮箱地址').optional(),
  status: z.enum(['active', 'disabled']).optional(),
  roleIds: z.array(z.string().min(1)).min(1, '请至少选择一个角色').optional(),
})

export function createUserRoutes() {
  const routes = new Hono<AppBindings>()
  routes.use('*', requireAuth)

  routes.get('/', requirePermission('users.read'), async (c) => {
    const page = Number(c.req.query('page') ?? 1) || 1
    const pageSize = Math.min(Number(c.req.query('pageSize') ?? 10) || 10, 50)
    const query = c.req.query('query')
    const status = (c.req.query('status') as 'active' | 'disabled' | 'all' | undefined) ?? 'all'
    const result = await c.get('identity').listUsers({ query, status, page, pageSize })
    return c.json(result)
  })

  routes.post('/', requirePermission('users.write'), async (c) => {
    const input = await readJson(c, createUserSchema)
    if (!input.success)
      return input.response
    try {
      const user = await c.get('identity').createUser(input.data)
      return c.json({ user }, 201)
    }
    catch (error) {
      return mapIdentityError(c, error, { code: 'EMAIL_IN_USE', message: '该邮箱已经注册' })
    }
  })

  routes.patch('/:id', requirePermission('users.write'), async (c) => {
    const input = await readJson(c, updateUserSchema)
    if (!input.success)
      return input.response
    try {
      const user = await c.get('identity').updateUser(c.get('user')!, c.req.param('id'), input.data)
      return c.json({ user })
    }
    catch (error) {
      return mapIdentityError(c, error, { code: 'EMAIL_IN_USE', message: '该邮箱已经注册' })
    }
  })

  routes.delete('/:id', requirePermission('users.write'), async (c) => {
    try {
      await c.get('identity').deleteUser(c.get('user')!, c.req.param('id'))
      return c.json({ success: true })
    }
    catch (error) {
      return mapIdentityError(c, error)
    }
  })

  return routes
}
