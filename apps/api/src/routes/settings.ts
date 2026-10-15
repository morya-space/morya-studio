/**
 * 设置路由：个人资料（displayName/avatar/改密码）+ 工作区配置（按 owner 键值存储）。
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { WorkspaceConfig } from '@morya-studio/shared'
import type { DatabaseSync } from '../db/mysql'
import type { AppBindings } from '../types/context'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../middleware/error-handler'
import { get, run } from '../db/database'
import type { IdentityService } from '../services/identity'

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().optional(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

const workspaceSchema = z.object({
  name: z.string().optional(),
  data: z.record(z.unknown()).optional(),
})

interface WsRow { owner_id: string; name: string; data: string; updated_at: string }

export function createSettingsRoutes(db: DatabaseSync, identity: IdentityService) {
  const app = new Hono<AppBindings>()
  app.use('*', requireAuth)

  // ---- 个人资料 ----
  app.patch('/profile', async (c) => {
    const parsed = profileSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '资料格式不正确')
    const user = identity.updateProfile(c.get('user').id, parsed.data)
    if (!user) throw new ApiError(404, 'not_found', '用户不存在')
    return c.json({ user })
  })

  app.post('/profile/password', async (c) => {
    const parsed = passwordSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '新密码至少 6 位')
    identity.changePassword(c.get('user').id, parsed.data.currentPassword, parsed.data.newPassword)
    return c.json({ ok: true })
  })

  // ---- 工作区配置 ----
  app.get('/workspace', (c) => {
    const uid = c.get('user').id
    const row = get<WsRow>(db, 'SELECT * FROM workspace_configs WHERE owner_id = ?', uid)
    const config: WorkspaceConfig = row
      ? { name: row.name, data: JSON.parse(row.data) as Record<string, unknown>, updatedAt: row.updated_at }
      : { name: '', data: {} }
    return c.json({ config })
  })

  app.put('/workspace', async (c) => {
    const parsed = workspaceSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, 'invalid_input', '配置格式不正确')
    const uid = c.get('user').id
    const existing = get<WsRow>(db, 'SELECT * FROM workspace_configs WHERE owner_id = ?', uid)
    const name = parsed.data.name ?? existing?.name ?? ''
    const data = parsed.data.data ?? (existing ? (JSON.parse(existing.data) as Record<string, unknown>) : {})
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    run(
      db,
      `INSERT INTO workspace_configs (owner_id, name, data, updated_at) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), data = VALUES(data), updated_at = VALUES(updated_at)`,
      uid, name, JSON.stringify(data), ts,
    )
    const config: WorkspaceConfig = { name, data, updatedAt: ts }
    return c.json({ config })
  })

  return app
}
