/**
 * 身份服务：用户 / 角色 / 权限 / 会话（SQLite 存储）。
 * 首次启动若无用户，播种默认角色 + 管理员。
 */

import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from '../db/mysql'
import type { PublicUser, Role, SessionInfo, UserStatus } from '@morya-studio/shared'
import { all, get, run } from '../db/database'
import { hashPassword, verifyPassword } from './password'
import { ApiError } from '../middleware/error-handler'
import type { AppConfig } from '../config/env'

/** 系统权限码 */
export const PERMISSIONS = [
  'panel:read', 'panel:write',
  'datasource:read', 'datasource:write',
  'connector:use',
  'component:read', 'component:write',
  'template:read', 'template:write',
  'admin:user', 'admin:role',
] as const

export type PermissionCode = (typeof PERMISSIONS)[number]

interface UserRow {
  id: string
  name: string
  email: string
  password_hash: string
  status: UserStatus
  created_at: string
}

interface RoleRow {
  id: string
  name: string
  description: string
  is_system: number
  created_at: string
}

export interface IdentityService {
  seed: () => void
  login: (email: string, password: string, meta: { ip: string | null; userAgent: string | null }) => { token: string; user: PublicUser } | null
  findSessionUser: (sessionId: string) => PublicUser | null
  logout: (sessionId: string) => void
  listSessions: (userId: string, currentId: string) => SessionInfo[]
  // users
  listUsers: () => PublicUser[]
  createUser: (input: { name: string; email: string; password: string; roleIds?: string[] }) => PublicUser
  updateUserStatus: (id: string, status: UserStatus) => void
  updateProfile: (id: string, patch: { name?: string; avatar?: string }) => PublicUser | null
  changePassword: (id: string, current: string, next: string) => void
  setUserRoles: (id: string, roleIds: string[]) => void
  deleteUser: (id: string) => void
  // roles
  listRoles: () => Role[]
  createRole: (input: { name: string; description?: string; permissions: string[] }) => Role
  updateRole: (id: string, patch: { name?: string; description?: string; permissions?: string[] }) => Role | null
  deleteRole: (id: string) => void
  listPermissions: () => string[]
  getUserPermissions: (userId: string) => string[]
}

function now(): string {
  return new Date().toISOString()
}

export function createIdentityService(db: DatabaseSync, config: AppConfig): IdentityService {
  // ---------- 内部读取 ----------

  function rolePermissions(roleId: string): string[] {
    return all<{ code: string }>(db, 'SELECT code FROM role_permissions WHERE role_id = ?', roleId).map(r => r.code)
  }

  function userRoleIds(userId: string): string[] {
    return all<{ role_id: string }>(db, 'SELECT role_id FROM user_roles WHERE user_id = ?', userId).map(r => r.role_id)
  }

  function getUserPermissions(userId: string): string[] {
    const rows = all<{ code: string }>(
      db,
      `SELECT DISTINCT rp.code FROM role_permissions rp
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = ?`,
      userId,
    )
    return rows.map(r => r.code)
  }

  function toPublicUser(row: UserRow): PublicUser {
    const roleIds = userRoleIds(row.id)
    const roleNames = roleIds
      .map(id => get<RoleRow>(db, 'SELECT * FROM roles WHERE id = ?', id)?.name)
      .filter((n): n is string => Boolean(n))
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: (row as UserRow & { avatar?: string }).avatar ?? '',
      status: row.status,
      roles: roleNames,
      permissions: getUserPermissions(row.id),
      createdAt: row.created_at,
    }
  }

  function findUserRowByEmail(email: string): UserRow | null {
    return get<UserRow>(db, 'SELECT * FROM users WHERE lower(email) = lower(?)', email)
  }

  function findUserRowById(id: string): UserRow | null {
    return get<UserRow>(db, 'SELECT * FROM users WHERE id = ?', id)
  }

  // ---------- 播种 ----------

  function seed(): void {
    const ts = now()
    // 系统角色
    if (!get(db, 'SELECT id FROM roles WHERE name = ?', 'admin')) {
      const adminRoleId = randomUUID()
      run(db, 'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?,?,?,1,?)',
        adminRoleId, 'admin', '系统管理员，拥有全部权限', ts)
      for (const code of PERMISSIONS) {
        run(db, 'INSERT INTO role_permissions (role_id, code) VALUES (?,?)', adminRoleId, code)
      }
    }
    if (!get(db, 'SELECT id FROM roles WHERE name = ?', 'member')) {
      const memberRoleId = randomUUID()
      run(db, 'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?,?,?,1,?)',
        memberRoleId, 'member', '普通成员，业务读写', ts)
      const memberPerms: PermissionCode[] = [
        'panel:read', 'panel:write',
        'datasource:read', 'datasource:write',
        'connector:use',
        'component:read', 'component:write',
        'template:read', 'template:write',
      ]
      for (const code of memberPerms) {
        run(db, 'INSERT INTO role_permissions (role_id, code) VALUES (?,?)', memberRoleId, code)
      }
    }
    // 首个用户 → 管理员
    const count = get<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM users')?.c ?? 0
    if (count === 0) {
      const userId = randomUUID()
      run(db, 'INSERT INTO users (id, name, email, password_hash, status, created_at) VALUES (?,?,?,?,?,?)',
        userId, config.ADMIN_NAME, config.ADMIN_EMAIL, hashPassword(config.ADMIN_PASSWORD), 'active', ts)
      const adminRole = get<RoleRow>(db, 'SELECT * FROM roles WHERE name = ?', 'admin')
      if (adminRole) run(db, 'INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', userId, adminRole.id)
    }
  }

  // ---------- 会话 ----------

  function login(email: string, password: string, meta: { ip: string | null; userAgent: string | null }) {
    const row = findUserRowByEmail(email)
    const ok = row !== null && row.status === 'active' && verifyPassword(password, row.password_hash)
    run(db, 'INSERT INTO login_events (id, user_id, email, success, ip, user_agent, created_at) VALUES (?,?,?,?,?,?,?)',
      randomUUID(), row?.id ?? null, email, ok ? 1 : 0, meta.ip, meta.userAgent, now())
    if (!ok || !row) return null

    const sessionId = randomUUID()
    const ts = now()
    const expires = new Date(Date.now() + config.SESSION_TTL_MS).toISOString()
    run(db, 'INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)',
      sessionId, row.id, ts, ts, expires, meta.ip, meta.userAgent)
    return { token: sessionId, user: toPublicUser(row) }
  }

  function findSessionUser(sessionId: string): PublicUser | null {
    const session = get<{ id: string; user_id: string; expires_at: string }>(
      db, 'SELECT id, user_id, expires_at FROM sessions WHERE id = ?', sessionId)
    if (!session) return null
    if (new Date(session.expires_at).getTime() < Date.now()) {
      run(db, 'DELETE FROM sessions WHERE id = ?', sessionId)
      return null
    }
    run(db, 'UPDATE sessions SET last_seen_at = ? WHERE id = ?', now(), sessionId)
    const row = findUserRowById(session.user_id)
    if (!row || row.status !== 'active') return null
    return toPublicUser(row)
  }

  function logout(sessionId: string): void {
    run(db, 'DELETE FROM sessions WHERE id = ?', sessionId)
  }

  function listSessions(userId: string, currentId: string): SessionInfo[] {
    return all<{
      id: string; created_at: string; last_seen_at: string; expires_at: string; ip: string | null; user_agent: string | null
    }>(db, 'SELECT * FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC', userId)
      .map(s => ({
        id: s.id,
        createdAt: s.created_at,
        lastSeenAt: s.last_seen_at,
        expiresAt: s.expires_at,
        ip: s.ip,
        userAgent: s.user_agent,
        current: s.id === currentId,
      }))
  }

  // ---------- 用户 ----------

  function listUsers(): PublicUser[] {
    return all<UserRow>(db, 'SELECT * FROM users ORDER BY created_at ASC').map(toPublicUser)
  }

  function createUser(input: { name: string; email: string; password: string; roleIds?: string[] }): PublicUser {
    const id = randomUUID()
    run(db, 'INSERT INTO users (id, name, email, password_hash, status, created_at) VALUES (?,?,?,?,?,?)',
      id, input.name, input.email, hashPassword(input.password), 'active', now())
    for (const roleId of input.roleIds ?? []) {
      run(db, 'INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', id, roleId)
    }
    return toPublicUser(findUserRowById(id)!)
  }

  function updateUserStatus(id: string, status: UserStatus): void {
    run(db, 'UPDATE users SET status = ? WHERE id = ?', status, id)
  }

  function updateProfile(id: string, patch: { name?: string; avatar?: string }): PublicUser | null {
    if (patch.name !== undefined) run(db, 'UPDATE users SET name = ? WHERE id = ?', patch.name, id)
    if (patch.avatar !== undefined) run(db, 'UPDATE users SET avatar = ? WHERE id = ?', patch.avatar, id)
    const row = findUserRowById(id)
    return row ? toPublicUser(row) : null
  }

  function changePassword(id: string, current: string, next: string): void {
    const row = findUserRowById(id)
    if (!row) throw new ApiError(404, 'not_found', '用户不存在')
    if (!verifyPassword(current, row.password_hash)) {
      throw new ApiError(400, 'invalid_password', '当前密码不正确')
    }
    run(db, 'UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), id)
    // 修改密码后吊销该用户所有会话，需重新登录
    run(db, 'DELETE FROM sessions WHERE user_id = ?', id)
  }

  function setUserRoles(id: string, roleIds: string[]): void {
    run(db, 'DELETE FROM user_roles WHERE user_id = ?', id)
    for (const roleId of roleIds) {
      run(db, 'INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', id, roleId)
    }
  }

  function deleteUser(id: string): void {
    run(db, 'DELETE FROM users WHERE id = ?', id)
  }

  // ---------- 角色 ----------

  function toRole(row: RoleRow): Role {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: row.is_system === 1,
      permissions: rolePermissions(row.id),
      createdAt: row.created_at,
    }
  }

  function listRoles(): Role[] {
    return all<RoleRow>(db, 'SELECT * FROM roles ORDER BY created_at ASC').map(toRole)
  }

  function createRole(input: { name: string; description?: string; permissions: string[] }): Role {
    const id = randomUUID()
    run(db, 'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?,?,?,0,?)',
      id, input.name, input.description ?? '', now())
    for (const code of input.permissions) {
      run(db, 'INSERT INTO role_permissions (role_id, code) VALUES (?,?)', id, code)
    }
    return toRole(get<RoleRow>(db, 'SELECT * FROM roles WHERE id = ?', id)!)
  }

  function updateRole(id: string, patch: { name?: string; description?: string; permissions?: string[] }): Role | null {
    const row = get<RoleRow>(db, 'SELECT * FROM roles WHERE id = ?', id)
    if (!row) return null
    if (patch.name !== undefined) run(db, 'UPDATE roles SET name = ? WHERE id = ?', patch.name, id)
    if (patch.description !== undefined) run(db, 'UPDATE roles SET description = ? WHERE id = ?', patch.description, id)
    if (patch.permissions !== undefined) {
      run(db, 'DELETE FROM role_permissions WHERE role_id = ?', id)
      for (const code of patch.permissions) {
        run(db, 'INSERT INTO role_permissions (role_id, code) VALUES (?,?)', id, code)
      }
    }
    return toRole(get<RoleRow>(db, 'SELECT * FROM roles WHERE id = ?', id)!)
  }

  function deleteRole(id: string): void {
    run(db, 'DELETE FROM roles WHERE id = ?', id)
  }

  function listPermissions(): string[] {
    return [...PERMISSIONS]
  }

  return {
    seed,
    login,
    findSessionUser,
    logout,
    listSessions,
    listUsers,
    createUser,
    updateUserStatus,
    updateProfile,
    changePassword,
    setUserRoles,
    deleteUser,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    listPermissions,
    getUserPermissions,
  }
}
