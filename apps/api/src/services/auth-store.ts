import { createPool } from 'mysql2/promise'
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { AppConfig } from '../config/env'

export interface StoredAuthUser {
  id: string
  name: string
  email: string
  passwordHash: string
}

export interface AuthStore {
  findUserByEmail(email: string): Promise<StoredAuthUser | null>
  findUserById(id: string): Promise<StoredAuthUser | null>
  createUser(user: StoredAuthUser): Promise<void>
  createSession(id: string, userId: string, expiresAt: Date): Promise<void>
  findUserIdBySession(id: string): Promise<string | null>
  deleteSession(id: string): Promise<void>
}

interface UserRow extends RowDataPacket, StoredAuthUser {}
interface SessionRow extends RowDataPacket { user_id: string }

export function createMySqlAuthStore(pool: Pool): AuthStore {
  let schemaReady: Promise<void> | undefined

  async function ensureSchema() {
    schemaReady ??= (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          name VARCHAR(80) NOT NULL,
          email VARCHAR(320) NOT NULL UNIQUE,
          password_hash CHAR(64) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX sessions_expires_at_idx (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    })().catch((error) => {
      schemaReady = undefined
      throw error
    })
    return schemaReady
  }

  return {
    async findUserByEmail(email) {
      await ensureSchema()
      const [rows] = await pool.query<UserRow[]>('SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ? LIMIT 1', [email])
      return rows[0] ?? null
    },

    async findUserById(id) {
      await ensureSchema()
      const [rows] = await pool.query<UserRow[]>('SELECT id, name, email, password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1', [id])
      return rows[0] ?? null
    },

    async createUser(user) {
      await ensureSchema()
      await pool.execute<ResultSetHeader>(
        'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
        [user.id, user.name, user.email, user.passwordHash],
      )
    },

    async createSession(id, userId, expiresAt) {
      await ensureSchema()
      await pool.execute<ResultSetHeader>(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
        [id, userId, expiresAt],
      )
    },

    async findUserIdBySession(id) {
      await ensureSchema()
      const [rows] = await pool.query<SessionRow[]>(
        'SELECT user_id FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
        [id],
      )
      return rows[0]?.user_id ?? null
    },

    async deleteSession(id) {
      await ensureSchema()
      await pool.execute<ResultSetHeader>('DELETE FROM sessions WHERE id = ?', [id])
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