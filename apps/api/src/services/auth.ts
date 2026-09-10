import { randomUUID } from 'node:crypto'
import type { AuthStore, StoredAuthUser } from './auth-store'

export interface AuthUser {
  id: string
  name: string
  email: string
}

export interface AuthService {
  register(name: string, email: string, password: string): Promise<AuthUser>
  login(email: string, password: string): Promise<AuthUser>
  createSession(userId: string): Promise<string>
  getUserBySession(sessionId: string): Promise<AuthUser | null>
  deleteSession(sessionId: string): Promise<void>
}

export function createAuthService(store: AuthStore = createMemoryAuthStore()): AuthService {
  return {
    async register(name, email, password) {
      const normalizedEmail = email.trim().toLowerCase()
      if (await store.findUserByEmail(normalizedEmail)) {
        throw new AuthConflictError()
      }

      const user: StoredAuthUser = {
        id: randomUUID(),
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
      }
      await store.createUser(user)
      return toPublicUser(user)
    },

    async login(email, password) {
      const user = await store.findUserByEmail(email.trim().toLowerCase())
      if (!user || user.passwordHash !== await hashPassword(password)) {
        throw new AuthCredentialsError()
      }
      return toPublicUser(user)
    },

    async createSession(userId) {
      const sessionId = randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await store.createSession(sessionId, userId, expiresAt)
      return sessionId
    },

    async getUserBySession(sessionId) {
      const userId = await store.findUserIdBySession(sessionId)
      const user = userId ? await store.findUserById(userId) : null
      return user ? toPublicUser(user) : null
    },

    deleteSession(sessionId) {
      return store.deleteSession(sessionId)
    },
  }
}

function createMemoryAuthStore(): AuthStore {
  const usersByEmail = new Map<string, StoredAuthUser>()
  const usersById = new Map<string, StoredAuthUser>()
  const sessions = new Map<string, { userId: string; expiresAt: Date }>()

  return {
    async findUserByEmail(email) {
      return usersByEmail.get(email) ?? null
    },
    async findUserById(id) {
      return usersById.get(id) ?? null
    },
    async createUser(user) {
      usersByEmail.set(user.email, user)
      usersById.set(user.id, user)
    },
    async createSession(id, userId, expiresAt) {
      sessions.set(id, { userId, expiresAt })
    },
    async findUserIdBySession(id) {
      const session = sessions.get(id)
      if (!session || session.expiresAt <= new Date()) return null
      return session.userId
    },
    async deleteSession(id) {
      sessions.delete(id)
    },
  }
}

async function hashPassword(password: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Buffer.from(digest).toString('hex')
}

function toPublicUser({ passwordHash: _, ...user }: StoredAuthUser): AuthUser {
  return user
}

export class AuthConflictError extends Error {}
export class AuthCredentialsError extends Error {}