import type { AppBindings } from '../types/context'
import { Hono } from 'hono'
import { z } from 'zod'
import { readJson } from '../lib/http'
import { mapIdentityError } from '../lib/identity-http'
import { requireAuth, requirePermission } from '../middleware/auth'

const roleSchema = z.object({
  name: z.string().trim().min(1, '请输入角色名称').max(80, '角色名称不能超过 80 个字符'),
  description: z.string().trim().max(255, '描述不能超过 255 个字符').optional(),
  permissions: z.array(z.string().min(1)).default([]),
})

const updateRoleSchema = roleSchema.partial()

export function createRoleRoutes() {
  const routes = new Hono<AppBindings>()
  routes.use('*', requireAuth)

  routes.get('/', requirePermission('roles.read', 'users.write'), async (c) => {
    return c.json({ items: await c.get('identity').listRoles() })
  })

  routes.post('/', requirePermission('roles.write'), async (c) => {
    const input = await readJson(c, roleSchema)
    if (!input.success)
      return input.response
    try {
      const role = await c.get('identity').createRole(input.data)
      return c.json({ role }, 201)
    }
    catch (error) {
      return mapIdentityError(c, error, { code: 'ROLE_IN_USE', message: '角色名称已存在' })
    }
  })

  routes.patch('/:id', requirePermission('roles.write'), async (c) => {
    const input = await readJson(c, updateRoleSchema)
    if (!input.success)
      return input.response
    try {
      const role = await c.get('identity').updateRole(c.req.param('id'), input.data)
      return c.json({ role })
    }
    catch (error) {
      return mapIdentityError(c, error, { code: 'ROLE_IN_USE', message: '角色名称已存在' })
    }
  })

  routes.delete('/:id', requirePermission('roles.write'), async (c) => {
    try {
      await c.get('identity').deleteRole(c.req.param('id'))
      return c.json({ success: true })
    }
    catch (error) {
      return mapIdentityError(c, error)
    }
  })

  return routes
}
