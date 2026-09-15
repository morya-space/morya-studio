import type { UserStatus } from '@morya-studio/shared'
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { AppConfig } from '../config/env'
import { createPool } from 'mysql2/promise'

type SqlValue = string | number | boolean | Date | Buffer | null

export interface StoredUser {
  id: string
  name: string
  email: string
  passwordHash: string
  status: UserStatus
  createdAt: string
}

export interface StoredRole {
  id: string
  name: string
  description: string
  isSystem: boolean
  createdAt: string
}

export interface StoredSession {
  id: string
  userId: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  ip: string | null
  userAgent: string | null
}

export interface StoredLoginEvent {
  id: string
  userId: string | null
  email: string
  success: boolean
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface ListUsersQuery {
  query?: string
  status?: UserStatus | 'all'
  page: number
  pageSize: number
}

export interface IdentityStore {
  ensureReady: () => Promise<void>
  countUsers: () => Promise<number>
  findUserById: (id: string) => Promise<StoredUser | null>
  findUserByEmail: (email: string) => Promise<StoredUser | null>
  listUsers: (params: ListUsersQuery) => Promise<{ items: StoredUser[]; total: number }>
  createUser: (user: StoredUser) => Promise<void>
  updateUser: (id: string, patch: Partial<Pick<StoredUser, 'name' | 'email' | 'passwordHash' | 'status'>>) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  listRoles: () => Promise<StoredRole[]>
  findRoleById: (id: string) => Promise<StoredRole | null>
  findRoleByName: (name: string) => Promise<StoredRole | null>
  createRole: (role: StoredRole) => Promise<void>
  updateRole: (id: string, patch: Partial<Pick<StoredRole, 'name' | 'description'>>) => Promise<void>
  deleteRole: (id: string) => Promise<void>
  getRolePermissions: (roleId: string) => Promise<string[]>
  setRolePermissions: (roleId: string, codes: string[]) => Promise<void>
  getUserRoleIds: (userId: string) => Promise<string[]>
  setUserRoles: (userId: string, roleIds: string[]) => Promise<void>
  countUsersWithRole: (roleId: string) => Promise<number>
  createSession: (session: StoredSession) => Promise<void>
  findSession: (id: string) => Promise<StoredSession | null>
  listSessionsByUser: (userId: string) => Promise<StoredSession[]>
  touchSession: (id: string, lastSeenAt: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  deleteOtherSessions: (userId: string, keepId: string) => Promise<void>
  addLoginEvent: (event: StoredLoginEvent) => Promise<void>
  listLoginEvents: (params: { userId?: string; page: number; pageSize: number }) => Promise<{ items: StoredLoginEvent[]; total: number }>
}

function matchesQuery(user: StoredUser, query?: string) {
  if (!query)
    return true
  const needle = query.trim().toLowerCase()
  return user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
}

export function createMemoryIdentityStore(): IdentityStore {
  const users = new Map<string, StoredUser>()
  const roles = new Map<string, StoredRole>()
  const rolePermissions = new Map<string, string[]>()
  const userRoles = new Map<string, string[]>()
  const sessions = new Map<string, StoredSession>()
  const loginEvents: StoredLoginEvent[] = []

  return {
    async ensureReady() {},
    async countUsers() {
      return users.size
    },
    async findUserById(id) {
      return users.get(id) ?? null
    },
    async findUserByEmail(email) {
      return [...users.values()].find(user => user.email === email) ?? null
    },
    async listUsers(params) {
      const filtered = [...users.values()]
        .filter(user => matchesQuery(user, params.query))
        .filter(user => !params.status || params.status === 'all' || user.status === params.status)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      const start = (params.page - 1) * params.pageSize
      return { items: filtered.slice(start, start + params.pageSize), total: filtered.length }
    },
    async createUser(user) {
      users.set(user.id, user)
    },
    async updateUser(id, patch) {
      const user = users.get(id)
      if (!user)
        return
      users.set(id, {
        ...user,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.passwordHash !== undefined ? { passwordHash: patch.passwordHash } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      })
    },
    async deleteUser(id) {
      users.delete(id)
      userRoles.delete(id)
      for (const [sessionId, session] of sessions) {
        if (session.userId === id)
          sessions.delete(sessionId)
      }
    },
    async listRoles() {
      return [...roles.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    },
    async findRoleById(id) {
      return roles.get(id) ?? null
    },
    async findRoleByName(name) {
      return [...roles.values()].find(role => role.name === name) ?? null
    },
    async createRole(role) {
      roles.set(role.id, role)
      rolePermissions.set(role.id, [])
    },
    async updateRole(id, patch) {
      const role = roles.get(id)
      if (!role)
        return
      roles.set(id, {
        ...role,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      })
    },
    async deleteRole(id) {
      roles.delete(id)
      rolePermissions.delete(id)
      for (const [userId, ids] of userRoles)
        userRoles.set(userId, ids.filter(roleId => roleId !== id))
    },
    async getRolePermissions(roleId) {
      return rolePermissions.get(roleId) ?? []
    },
    async setRolePermissions(roleId, codes) {
      rolePermissions.set(roleId, [...new Set(codes)])
    },
    async getUserRoleIds(userId) {
      return userRoles.get(userId) ?? []
    },
    async setUserRoles(userId, roleIds) {
      userRoles.set(userId, [...new Set(roleIds)])
    },
    async countUsersWithRole(roleId) {
      return [...userRoles.values()].filter(ids => ids.includes(roleId)).length
    },
    async createSession(session) {
      sessions.set(session.id, session)
    },
    async findSession(id) {
      const session = sessions.get(id)
      if (!session || new Date(session.expiresAt) <= new Date()) {
        if (session)
          sessions.delete(id)
        return null
      }
      return session
    },
    async listSessionsByUser(userId) {
      return [...sessions.values()]
        .filter(session => session.userId === userId && new Date(session.expiresAt) > new Date())
        .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
    },
    async touchSession(id, lastSeenAt) {
      const session = sessions.get(id)
      if (session)
        sessions.set(id, { ...session, lastSeenAt })
    },
    async deleteSession(id) {
      sessions.delete(id)
    },
    async deleteOtherSessions(userId, keepId) {
      for (const [sessionId, session] of sessions) {
        if (session.userId === userId && sessionId !== keepId)
          sessions.delete(sessionId)
      }
    },
    async addLoginEvent(event) {
      loginEvents.unshift(event)
    },
    async listLoginEvents(params) {
      const filtered = loginEvents.filter(event => !params.userId || event.userId === params.userId)
      const start = (params.page - 1) * params.pageSize
      return { items: filtered.slice(start, start + params.pageSize), total: filtered.length }
    },
  }
}

interface UserRow extends RowDataPacket {
  id: string
  name: string
  email: string
  password_hash: string
  status: UserStatus
  created_at: string | Date
}

interface RoleRow extends RowDataPacket {
  id: string
  name: string
  description: string
  is_system: number
  created_at: string | Date
}

interface SessionRow extends RowDataPacket {
  id: string
  user_id: string
  created_at: string | Date
  last_seen_at: string | Date
  expires_at: string | Date
  ip: string | null
  user_agent: string | null
}

interface LoginEventRow extends RowDataPacket {
  id: string
  user_id: string | null
  email: string
  success: number
  ip: string | null
  user_agent: string | null
  created_at: string | Date
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    status: row.status,
    createdAt: toIso(row.created_at),
  }
}

function mapRole(row: RoleRow): StoredRole {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: Boolean(row.is_system),
    createdAt: toIso(row.created_at),
  }
}

function mapSession(row: SessionRow): StoredSession {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: toIso(row.created_at),
    lastSeenAt: toIso(row.last_seen_at),
    expiresAt: toIso(row.expires_at),
    ip: row.ip,
    userAgent: row.user_agent,
  }
}

export function createMySqlIdentityStore(pool: Pool): IdentityStore {
  let schemaReady: Promise<void> | undefined

  async function ensureSchema() {
    schemaReady ??= (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          name VARCHAR(80) NOT NULL,
          email VARCHAR(320) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await pool.query(`ALTER TABLE users MODIFY password_hash VARCHAR(255) NOT NULL`).catch(() => undefined)
      await pool.query(`ALTER TABLE users ADD COLUMN status ENUM('active', 'disabled') NOT NULL DEFAULT 'active'`).catch(() => undefined)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS roles (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          name VARCHAR(80) NOT NULL UNIQUE,
          description VARCHAR(255) NOT NULL DEFAULT '',
          is_system TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          user_id VARCHAR(36) NOT NULL,
          role_id VARCHAR(36) NOT NULL,
          PRIMARY KEY (user_id, role_id),
          CONSTRAINT user_roles_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT user_roles_role_id_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          role_id VARCHAR(36) NOT NULL,
          permission_code VARCHAR(80) NOT NULL,
          PRIMARY KEY (role_id, permission_code),
          CONSTRAINT role_permissions_role_id_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          expires_at DATETIME NOT NULL,
          last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ip VARCHAR(64) NULL,
          user_agent VARCHAR(512) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX sessions_expires_at_idx (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await pool.query(`ALTER TABLE sessions ADD COLUMN last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => undefined)
      await pool.query(`ALTER TABLE sessions ADD COLUMN ip VARCHAR(64) NULL`).catch(() => undefined)
      await pool.query(`ALTER TABLE sessions ADD COLUMN user_agent VARCHAR(512) NULL`).catch(() => undefined)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS login_events (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          user_id VARCHAR(36) NULL,
          email VARCHAR(320) NOT NULL,
          success TINYINT(1) NOT NULL,
          ip VARCHAR(64) NULL,
          user_agent VARCHAR(512) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX login_events_user_id_idx (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    })().catch((error) => {
      schemaReady = undefined
      throw error
    })
    return schemaReady
  }

  return {
    ensureReady: ensureSchema,
    async countUsers() {
      await ensureSchema()
      const [rows] = await pool.query<Array<RowDataPacket & { total: number }>>('SELECT COUNT(*) AS total FROM users')
      return Number(rows[0]?.total ?? 0)
    },
    async findUserById(id) {
      await ensureSchema()
      const [rows] = await pool.query<UserRow[]>('SELECT id, name, email, password_hash, status, created_at FROM users WHERE id = ? LIMIT 1', [id])
      return rows[0] ? mapUser(rows[0]) : null
    },
    async findUserByEmail(email) {
      await ensureSchema()
      const [rows] = await pool.query<UserRow[]>('SELECT id, name, email, password_hash, status, created_at FROM users WHERE email = ? LIMIT 1', [email])
      return rows[0] ? mapUser(rows[0]) : null
    },
    async listUsers(params) {
      await ensureSchema()
      const filters: string[] = []
      const values: SqlValue[] = []
      if (params.query) {
        filters.push('(name LIKE ? OR email LIKE ?)')
        values.push(`%${params.query}%`, `%${params.query}%`)
      }
      if (params.status && params.status !== 'all') {
        filters.push('status = ?')
        values.push(params.status)
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(`SELECT COUNT(*) AS total FROM users ${where}`, values)
      const [rows] = await pool.query<UserRow[]>(
        `SELECT id, name, email, password_hash, status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...values, params.pageSize, (params.page - 1) * params.pageSize],
      )
      return { items: rows.map(mapUser), total: Number(countRows[0]?.total ?? 0) }
    },
    async createUser(user) {
      await ensureSchema()
      await pool.execute<ResultSetHeader>(
        'INSERT INTO users (id, name, email, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, user.name, user.email, user.passwordHash, user.status, new Date(user.createdAt)],
      )
    },
    async updateUser(id, patch) {
      await ensureSchema()
      const fields: string[] = []
      const values: SqlValue[] = []
      if (patch.name !== undefined) {
        fields.push('name = ?')
        values.push(patch.name)
      }
      if (patch.email !== undefined) {
        fields.push('email = ?')
        values.push(patch.email)
      }
      if (patch.passwordHash !== undefined) {
        fields.push('password_hash = ?')
        values.push(patch.passwordHash)
      }
      if (patch.status !== undefined) {
        fields.push('status = ?')
        values.push(patch.status)
      }
      if (!fields.length)
        return
      values.push(id)
      await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    },
    async deleteUser(id) {
      await ensureSchema()
      await pool.execute('DELETE FROM users WHERE id = ?', [id])
    },
    async listRoles() {
      await ensureSchema()
      const [rows] = await pool.query<RoleRow[]>('SELECT id, name, description, is_system, created_at FROM roles ORDER BY created_at ASC')
      return rows.map(mapRole)
    },
    async findRoleById(id) {
      await ensureSchema()
      const [rows] = await pool.query<RoleRow[]>('SELECT id, name, description, is_system, created_at FROM roles WHERE id = ? LIMIT 1', [id])
      return rows[0] ? mapRole(rows[0]) : null
    },
    async findRoleByName(name) {
      await ensureSchema()
      const [rows] = await pool.query<RoleRow[]>('SELECT id, name, description, is_system, created_at FROM roles WHERE name = ? LIMIT 1', [name])
      return rows[0] ? mapRole(rows[0]) : null
    },
    async createRole(role) {
      await ensureSchema()
      await pool.execute(
        'INSERT INTO roles (id, name, description, is_system, created_at) VALUES (?, ?, ?, ?, ?)',
        [role.id, role.name, role.description, role.isSystem ? 1 : 0, new Date(role.createdAt)],
      )
    },
    async updateRole(id, patch) {
      await ensureSchema()
      const fields: string[] = []
      const values: SqlValue[] = []
      if (patch.name !== undefined) {
        fields.push('name = ?')
        values.push(patch.name)
      }
      if (patch.description !== undefined) {
        fields.push('description = ?')
        values.push(patch.description)
      }
      if (!fields.length)
        return
      values.push(id)
      await pool.execute(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, values)
    },
    async deleteRole(id) {
      await ensureSchema()
      await pool.execute('DELETE FROM roles WHERE id = ?', [id])
    },
    async getRolePermissions(roleId) {
      await ensureSchema()
      const [rows] = await pool.query<Array<RowDataPacket & { permission_code: string }>>(
        'SELECT permission_code FROM role_permissions WHERE role_id = ?',
        [roleId],
      )
      return rows.map(row => row.permission_code)
    },
    async setRolePermissions(roleId, codes) {
      await ensureSchema()
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId])
        for (const code of [...new Set(codes)])
          await connection.execute('INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)', [roleId, code])
        await connection.commit()
      }
      catch (error) {
        await connection.rollback()
        throw error
      }
      finally {
        connection.release()
      }
    },
    async getUserRoleIds(userId) {
      await ensureSchema()
      const [rows] = await pool.query<Array<RowDataPacket & { role_id: string }>>(
        'SELECT role_id FROM user_roles WHERE user_id = ?',
        [userId],
      )
      return rows.map(row => row.role_id)
    },
    async setUserRoles(userId, roleIds) {
      await ensureSchema()
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId])
        for (const roleId of [...new Set(roleIds)])
          await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId])
        await connection.commit()
      }
      catch (error) {
        await connection.rollback()
        throw error
      }
      finally {
        connection.release()
      }
    },
    async countUsersWithRole(roleId) {
      await ensureSchema()
      const [rows] = await pool.query<Array<RowDataPacket & { total: number }>>(
        'SELECT COUNT(*) AS total FROM user_roles WHERE role_id = ?',
        [roleId],
      )
      return Number(rows[0]?.total ?? 0)
    },
    async createSession(session) {
      await ensureSchema()
      await pool.execute(
        'INSERT INTO sessions (id, user_id, expires_at, last_seen_at, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [session.id, session.userId, new Date(session.expiresAt), new Date(session.lastSeenAt), session.ip, session.userAgent, new Date(session.createdAt)],
      )
    },
    async findSession(id) {
      await ensureSchema()
      const [rows] = await pool.query<SessionRow[]>(
        'SELECT id, user_id, created_at, last_seen_at, expires_at, ip, user_agent FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
        [id],
      )
      return rows[0] ? mapSession(rows[0]) : null
    },
    async listSessionsByUser(userId) {
      await ensureSchema()
      const [rows] = await pool.query<SessionRow[]>(
        'SELECT id, user_id, created_at, last_seen_at, expires_at, ip, user_agent FROM sessions WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP ORDER BY last_seen_at DESC',
        [userId],
      )
      return rows.map(mapSession)
    },
    async touchSession(id, lastSeenAt) {
      await ensureSchema()
      await pool.execute('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [new Date(lastSeenAt), id])
    },
    async deleteSession(id) {
      await ensureSchema()
      await pool.execute('DELETE FROM sessions WHERE id = ?', [id])
    },
    async deleteOtherSessions(userId, keepId) {
      await ensureSchema()
      await pool.execute('DELETE FROM sessions WHERE user_id = ? AND id <> ?', [userId, keepId])
    },
    async addLoginEvent(event) {
      await ensureSchema()
      await pool.execute(
        'INSERT INTO login_events (id, user_id, email, success, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [event.id, event.userId, event.email, event.success ? 1 : 0, event.ip, event.userAgent, new Date(event.createdAt)],
      )
    },
    async listLoginEvents(params) {
      await ensureSchema()
      const filters: string[] = []
      const values: unknown[] = []
      if (params.userId) {
        filters.push('user_id = ?')
        values.push(params.userId)
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(`SELECT COUNT(*) AS total FROM login_events ${where}`, values)
      const [rows] = await pool.query<LoginEventRow[]>(
        `SELECT id, user_id, email, success, ip, user_agent, created_at FROM login_events ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...values, params.pageSize, (params.page - 1) * params.pageSize],
      )
      return {
        items: rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          email: row.email,
          success: Boolean(row.success),
          ip: row.ip,
          userAgent: row.user_agent,
          createdAt: toIso(row.created_at),
        })),
        total: Number(countRows[0]?.total ?? 0),
      }
    },
  }
}

export function createMySqlPool(config: AppConfig) {
  return createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectionLimit: config.DB_CONNECTION_LIMIT,
    ssl: config.DB_SSL ? {} : undefined,
    waitForConnections: true,
  })
}
