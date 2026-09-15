import type {
  AuthSession,
  AuthUser,
  LoginEvent,
  Paginated,
  PermissionDefinition,
  Role,
  UserRecord,
  UserStatus,
} from '@morya-studio/shared'
import type { IdentityStore, StoredRole, StoredSession, StoredUser } from './identity-store'
import { randomUUID } from 'node:crypto'
import {
  ALL_PERMISSION_CODES,
  EDITOR_PERMISSIONS,
  PERMISSION_CATALOG,
  SEED_SUPER_ADMIN,
  SYSTEM_ROLE_DEFS,
  SYSTEM_ROLE_IDS,
  VIEWER_PERMISSIONS,
} from '@morya-studio/shared'
import {
  AuthConflictError,
  AuthCredentialsError,
  IdentityForbiddenError,
  IdentityNotFoundError,
  IdentityValidationError,
} from './identity-errors'
import { createMemoryIdentityStore } from './identity-store'
import { hashPassword, verifyPassword } from './password'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ALLOWED_PERMISSIONS = new Set(ALL_PERMISSION_CODES)

export interface ClientMeta {
  ip?: string | null
  userAgent?: string | null
}

export interface IdentityService {
  bootstrap: () => Promise<void>
  register: (name: string, email: string, password: string, meta?: ClientMeta) => Promise<{ user: AuthUser; sessionId: string }>
  login: (email: string, password: string, meta?: ClientMeta) => Promise<{ user: AuthUser; sessionId: string }>
  getUserBySession: (sessionId: string) => Promise<AuthUser | null>
  logout: (sessionId: string) => Promise<void>
  updateProfile: (userId: string, name: string) => Promise<AuthUser>
  changePassword: (userId: string, currentPassword: string, nextPassword: string, sessionId: string) => Promise<void>
  listSessions: (userId: string, currentSessionId: string) => Promise<AuthSession[]>
  revokeSession: (actor: AuthUser, sessionId: string, currentSessionId: string) => Promise<void>
  revokeOtherSessions: (userId: string, currentSessionId: string) => Promise<void>
  listLoginEvents: (actor: AuthUser, params: { userId?: string; page: number; pageSize: number }) => Promise<Paginated<LoginEvent>>
  listUsers: (params: { query?: string; status?: UserStatus | 'all'; page: number; pageSize: number }) => Promise<Paginated<UserRecord>>
  createUser: (input: { name: string; email: string; password: string; roleIds: string[]; status?: UserStatus }) => Promise<UserRecord>
  updateUser: (actor: AuthUser, id: string, input: { name?: string; email?: string; status?: UserStatus; roleIds?: string[] }) => Promise<UserRecord>
  deleteUser: (actor: AuthUser, id: string) => Promise<void>
  listRoles: () => Promise<Role[]>
  createRole: (input: { name: string; description?: string; permissions: string[] }) => Promise<Role>
  updateRole: (id: string, input: { name?: string; description?: string; permissions?: string[] }) => Promise<Role>
  deleteRole: (id: string) => Promise<void>
  listPermissions: () => PermissionDefinition[]
}

export function createIdentityService(store: IdentityStore = createMemoryIdentityStore()): IdentityService {
  let bootstrapped: Promise<void> | undefined

  async function ready() {
    bootstrapped ??= (async () => {
      await store.ensureReady()
      await seedSystemRoles()
      await ensureSuperAdmin()
    })().catch((error) => {
      bootstrapped = undefined
      throw error
    })
    return bootstrapped
  }

  async function seedSystemRoles() {
    await upsertSystemRole(SYSTEM_ROLE_DEFS.admin, ALL_PERMISSION_CODES)
    await upsertSystemRole(SYSTEM_ROLE_DEFS.editor, [...EDITOR_PERMISSIONS])
    await upsertSystemRole(SYSTEM_ROLE_DEFS.viewer, [...VIEWER_PERMISSIONS])
  }

  async function ensureSuperAdmin() {
    if (await countAdmins() > 0)
      return
    const existing = await store.findUserByEmail(normalizeEmail(SEED_SUPER_ADMIN.email))
    if (existing) {
      await store.updateUser(existing.id, { name: SEED_SUPER_ADMIN.name, status: 'active' })
      await store.setUserRoles(existing.id, [SYSTEM_ROLE_IDS.admin])
      return
    }
    const admin = await persistUser({
      name: SEED_SUPER_ADMIN.name,
      email: SEED_SUPER_ADMIN.email,
      password: SEED_SUPER_ADMIN.password,
      status: 'active',
    })
    await store.setUserRoles(admin.id, [SYSTEM_ROLE_IDS.admin])
  }

  async function upsertSystemRole(
    def: { id: string; name: string; description: string },
    permissions: string[],
  ) {
    const existing = await store.findRoleById(def.id)
    if (!existing) {
      await store.createRole({
        id: def.id,
        name: def.name,
        description: def.description,
        isSystem: true,
        createdAt: new Date().toISOString(),
      })
    }
    else {
      await store.updateRole(def.id, { name: def.name, description: def.description })
    }
    await store.setRolePermissions(def.id, permissions)
  }

  async function persistUser(input: { name: string; email: string; password: string; status: UserStatus }) {
    const email = normalizeEmail(input.email)
    if (await store.findUserByEmail(email))
      throw new AuthConflictError()
    const user: StoredUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      status: input.status,
      createdAt: new Date().toISOString(),
    }
    await store.createUser(user)
    return user
  }

  async function toPublicUser(user: StoredUser): Promise<AuthUser> {
    const roleIds = await store.getUserRoleIds(user.id)
    const roles: AuthUser['roles'] = []
    const permissions = new Set<string>()
    for (const roleId of roleIds) {
      const role = await store.findRoleById(roleId)
      if (!role)
        continue
      roles.push({ id: role.id, name: role.name, isSystem: role.isSystem })
      for (const code of await store.getRolePermissions(role.id))
        permissions.add(code)
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles,
      permissions: [...permissions].sort(),
      createdAt: user.createdAt,
    }
  }

  async function getRoleRecord(role: StoredRole): Promise<Role> {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: await store.getRolePermissions(role.id),
      userCount: await store.countUsersWithRole(role.id),
      createdAt: role.createdAt,
    }
  }

  async function assertRolesExist(roleIds: string[]) {
    const unique = [...new Set(roleIds)]
    for (const roleId of unique) {
      if (!await store.findRoleById(roleId))
        throw new IdentityValidationError('选择的角色不存在')
    }
    return unique
  }

  function assertKnownPermissions(codes: string[]) {
    const unique = [...new Set(codes)]
    for (const code of unique) {
      if (!ALLOWED_PERMISSIONS.has(code))
        throw new IdentityValidationError(`未知权限：${code}`)
    }
    return unique
  }

  async function countAdmins(exceptUserId?: string) {
    const { items } = await store.listUsers({ page: 1, pageSize: 1000, status: 'all' })
    let count = 0
    for (const user of items) {
      if (exceptUserId && user.id === exceptUserId)
        continue
      const roleIds = await store.getUserRoleIds(user.id)
      if (roleIds.includes(SYSTEM_ROLE_IDS.admin) && user.status === 'active')
        count += 1
    }
    return count
  }

  async function issueSession(user: StoredUser, meta: ClientMeta = {}) {
    const now = new Date()
    const sessionId = randomUUID()
    await store.createSession({
      id: sessionId,
      userId: user.id,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    })
    return { user: await toPublicUser(user), sessionId }
  }

  async function assertAdminRemains(userId: string, nextRoleIds?: string[], nextStatus?: UserStatus) {
    const current = await store.findUserById(userId)
    if (!current)
      throw new IdentityNotFoundError('用户不存在')
    const roleIds = nextRoleIds ?? await store.getUserRoleIds(userId)
    const status = nextStatus ?? current.status
    const stillAdmin = status === 'active' && roleIds.includes(SYSTEM_ROLE_IDS.admin)
    if (!stillAdmin && await countAdmins(userId) === 0)
      throw new IdentityForbiddenError('至少需要保留一名启用的超级管理员')
  }

  return {
    bootstrap: ready,
    async register(name, email, password, meta = {}) {
      await ready()
      const user = await persistUser({ name, email, password, status: 'active' })
      await store.setUserRoles(user.id, [SYSTEM_ROLE_IDS.viewer])
      const { sessionId, user: publicUser } = await issueSession(user, meta)
      await store.addLoginEvent({
        id: randomUUID(),
        userId: user.id,
        email: user.email,
        success: true,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        createdAt: new Date().toISOString(),
      })
      return { user: publicUser, sessionId }
    },
    async login(email, password, meta = {}) {
      await ready()
      const user = await store.findUserByEmail(normalizeEmail(email))
      const ok = user ? await verifyPassword(password, user.passwordHash) : false
      await store.addLoginEvent({
        id: randomUUID(),
        userId: user?.id ?? null,
        email: normalizeEmail(email),
        success: Boolean(ok && user && user.status === 'active'),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        createdAt: new Date().toISOString(),
      })
      if (!user || !ok)
        throw new AuthCredentialsError()
      if (user.status === 'disabled')
        throw new IdentityForbiddenError('账号已被禁用')
      return issueSession(user, meta)
    },
    async getUserBySession(sessionId) {
      await ready()
      const session = await store.findSession(sessionId)
      if (!session)
        return null
      const user = await store.findUserById(session.userId)
      if (!user || user.status === 'disabled')
        return null
      await store.touchSession(sessionId, new Date().toISOString())
      return toPublicUser(user)
    },
    async logout(sessionId) {
      await ready()
      await store.deleteSession(sessionId)
    },
    async updateProfile(userId, name) {
      await ready()
      const user = await store.findUserById(userId)
      if (!user)
        throw new IdentityNotFoundError('用户不存在')
      await store.updateUser(userId, { name: name.trim() })
      return toPublicUser({ ...user, name: name.trim() })
    },
    async changePassword(userId, currentPassword, nextPassword, sessionId) {
      await ready()
      const user = await store.findUserById(userId)
      if (!user)
        throw new IdentityNotFoundError('用户不存在')
      if (!await verifyPassword(currentPassword, user.passwordHash))
        throw new AuthCredentialsError()
      await store.updateUser(userId, { passwordHash: await hashPassword(nextPassword) })
      await store.deleteOtherSessions(userId, sessionId)
    },
    async listSessions(userId, currentSessionId) {
      await ready()
      return (await store.listSessionsByUser(userId)).map(session => toPublicSession(session, currentSessionId))
    },
    async revokeSession(actor, sessionId, currentSessionId) {
      await ready()
      const session = await store.findSession(sessionId)
      if (!session)
        throw new IdentityNotFoundError('会话不存在')
      if (session.userId !== actor.id)
        throw new IdentityForbiddenError('只能管理自己的会话')
      if (session.id === currentSessionId)
        throw new IdentityForbiddenError('不能注销当前会话，请使用退出登录')
      await store.deleteSession(sessionId)
    },
    async revokeOtherSessions(userId, currentSessionId) {
      await ready()
      await store.deleteOtherSessions(userId, currentSessionId)
    },
    async listLoginEvents(actor, params) {
      await ready()
      const userId = actor.permissions.includes('users.read') ? params.userId : actor.id
      const result = await store.listLoginEvents({
        userId: userId ?? actor.id,
        page: params.page,
        pageSize: params.pageSize,
      })
      return {
        items: result.items.map(event => ({
          id: event.id,
          email: event.email,
          success: event.success,
          ip: event.ip,
          userAgent: event.userAgent,
          createdAt: event.createdAt,
        })),
        meta: { page: params.page, pageSize: params.pageSize, total: result.total },
      }
    },
    async listUsers(params) {
      await ready()
      const result = await store.listUsers(params)
      return {
        items: await Promise.all(result.items.map(item => toPublicUser(item))),
        meta: { page: params.page, pageSize: params.pageSize, total: result.total },
      }
    },
    async createUser(input) {
      await ready()
      const roleIds = await assertRolesExist(input.roleIds)
      const user = await persistUser({
        name: input.name,
        email: input.email,
        password: input.password,
        status: input.status ?? 'active',
      })
      await store.setUserRoles(user.id, roleIds.length ? roleIds : [SYSTEM_ROLE_IDS.viewer])
      return toPublicUser(user)
    },
    async updateUser(actor, id, input) {
      await ready()
      const user = await store.findUserById(id)
      if (!user)
        throw new IdentityNotFoundError('用户不存在')
      if (input.email && normalizeEmail(input.email) !== user.email) {
        const existing = await store.findUserByEmail(normalizeEmail(input.email))
        if (existing)
          throw new AuthConflictError()
      }
      const nextRoleIds = input.roleIds ? await assertRolesExist(input.roleIds) : undefined
      if (input.status === 'disabled' && actor.id === id)
        throw new IdentityForbiddenError('不能禁用当前登录账号')
      if (nextRoleIds || input.status)
        await assertAdminRemains(id, nextRoleIds, input.status)
      await store.updateUser(id, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      if (nextRoleIds)
        await store.setUserRoles(id, nextRoleIds)
      const updated = await store.findUserById(id)
      return toPublicUser(updated!)
    },
    async deleteUser(actor, id) {
      await ready()
      if (actor.id === id)
        throw new IdentityForbiddenError('不能删除当前登录账号')
      const user = await store.findUserById(id)
      if (!user)
        throw new IdentityNotFoundError('用户不存在')
      await assertAdminRemains(id, [], 'disabled')
      await store.deleteUser(id)
    },
    async listRoles() {
      await ready()
      const roles = await store.listRoles()
      return Promise.all(roles.map(role => getRoleRecord(role)))
    },
    async createRole(input) {
      await ready()
      const name = input.name.trim()
      if (await store.findRoleByName(name))
        throw new AuthConflictError()
      const role: StoredRole = {
        id: randomUUID(),
        name,
        description: input.description?.trim() ?? '',
        isSystem: false,
        createdAt: new Date().toISOString(),
      }
      await store.createRole(role)
      await store.setRolePermissions(role.id, assertKnownPermissions(input.permissions))
      return getRoleRecord(role)
    },
    async updateRole(id, input) {
      await ready()
      const role = await store.findRoleById(id)
      if (!role)
        throw new IdentityNotFoundError('角色不存在')
      if (input.name && input.name.trim() !== role.name) {
        if (role.isSystem)
          throw new IdentityForbiddenError('系统角色不能改名')
        if (await store.findRoleByName(input.name.trim()))
          throw new AuthConflictError()
      }
      if (role.isSystem && input.permissions)
        throw new IdentityForbiddenError('系统角色权限由平台维护')
      await store.updateRole(id, {
        name: role.isSystem ? undefined : input.name?.trim(),
        description: input.description?.trim(),
      })
      if (input.permissions && !role.isSystem)
        await store.setRolePermissions(id, assertKnownPermissions(input.permissions))
      const updated = await store.findRoleById(id)
      return getRoleRecord(updated!)
    },
    async deleteRole(id) {
      await ready()
      const role = await store.findRoleById(id)
      if (!role)
        throw new IdentityNotFoundError('角色不存在')
      if (role.isSystem)
        throw new IdentityForbiddenError('系统角色不能删除')
      if (await store.countUsersWithRole(id) > 0)
        throw new IdentityForbiddenError('仍有用户使用该角色，无法删除')
      await store.deleteRole(id)
    },
    listPermissions() {
      return PERMISSION_CATALOG
    },
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toPublicSession(session: StoredSession, currentSessionId: string): AuthSession {
  return {
    id: session.id,
    current: session.id === currentSessionId,
    ip: session.ip,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  }
}

export {
  AuthConflictError,
  AuthCredentialsError,
  IdentityForbiddenError,
  IdentityNotFoundError,
  IdentityValidationError,
}
