/**
 * 身份管理路由：用户 / 角色 / 权限（需 admin 权限）。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '../types/context'
import { requireAuth, requirePermission } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
  roleIds: z.array(z.string()).optional(),
})

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
})

export function createIdentityRoutes() {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  // ---- 权限码 ----
  app.get('/permissions', (c) => {
    return c.json({ items: c.get('identity').listPermissions() })
  })

  // ---- 用户 ----
  app.get('/users', requirePermission('admin:user'), (c) => {
    return c.json({ items: c.get('identity').listUsers() })
  })

  app.post('/users', requirePermission('admin:user'), async (c) => {
    const parsed = createUserSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '用户信息不完整或格式不正确')
    const identity = c.get('identity')
    const user = identity.createUser(parsed.data)
    return c.json({ user }, 201)
  })

  app.patch('/users/:id/status', requirePermission('admin:user'), async (c) => {
    const body = z.object({ status: z.enum(['active', 'disabled']) }).safeParse(await c.req.json().catch(() => null))
    if (!body.success) throw new ApiError(400, 'invalid_input', '状态不合法')
    c.get('identity').updateUserStatus(c.req.param('id'), body.data.status)
    return c.json({ ok: true })
  })

  app.put('/users/:id/roles', requirePermission('admin:user'), async (c) => {
    const body = z.object({ roleIds: z.array(z.string()) }).safeParse(await c.req.json().catch(() => null))
    if (!body.success) throw new ApiError(400, 'invalid_input', '角色列表不合法')
    c.get('identity').setUserRoles(c.req.param('id'), body.data.roleIds)
    return c.json({ ok: true })
  })

  app.delete('/users/:id', requirePermission('admin:user'), (c) => {
    c.get('identity').deleteUser(c.req.param('id'))
    return c.json({ ok: true })
  })

  // ---- 角色 ----
  app.get('/roles', requirePermission('admin:role'), (c) => {
    return c.json({ items: c.get('identity').listRoles() })
  })

  app.post('/roles', requirePermission('admin:role'), async (c) => {
    const parsed = roleSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '角色信息不完整')
    return c.json({ role: c.get('identity').createRole(parsed.data) }, 201)
  })

  app.patch('/roles/:id', requirePermission('admin:role'), async (c) => {
    const parsed = roleSchema.partial().safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '角色信息不合法')
    const role = c.get('identity').updateRole(c.req.param('id'), parsed.data)
    if (!role) throw new ApiError(404, 'not_found', '角色不存在')
    return c.json({ role })
  })

  app.delete('/roles/:id', requirePermission('admin:role'), (c) => {
    c.get('identity').deleteRole(c.req.param('id'))
    return c.json({ ok: true })
  })

  return app
}
