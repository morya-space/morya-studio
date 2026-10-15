/**
 * MySQL 数据库层：用 mysql2/promise 连接池模拟 node:sqlite 的同步接口。
 * 通过 deasync 风格的 Atomics.wait 实现同步阻塞查询，保持上层代码零改动。
 *
 * 生产建议：逐步将上层迁移到 async/await，移除此同步桥接。
 */

import mysql from 'mysql2/promise'

export type SqlValue = string | number | bigint | null

/** 模拟 node:sqlite 的 DatabaseSync 接口 */
export interface DatabaseSync {
  exec(sql: string): void
  prepare(sql: string): PreparedStatement
}

export interface PreparedStatement {
  all(...params: SqlValue[]): Record<string, unknown>[]
  get(...params: SqlValue[]): Record<string, unknown> | undefined
  run(...params: SqlValue[]): void
}

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? 'mysql6.sqlpub.com',
      port: Number(process.env.MYSQL_PORT ?? 3311),
      database: process.env.MYSQL_DATABASE ?? 'morya_data',
      user: process.env.MYSQL_USER ?? 'morya_admin',
      password: process.env.MYSQL_PASSWORD ?? '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    })
  }
  return pool
}

/** 同步执行 SQL（阻塞当前线程直到完成） */
function syncQuery(sql: string, params: SqlValue[]): { rows: Record<string, unknown>[]; fields: unknown[] } {
  const p = getPool()
  const sab = new SharedArrayBuffer(4)
  const int32 = new Int32Array(sab)
  let result: { rows: Record<string, unknown>[]; fields: unknown[] } | null = null
  let error: Error | null = null

  p.query(sql, params).then(([rows, fields]) => {
    result = { rows: rows as Record<string, unknown>[], fields: fields as unknown[] }
    Atomics.store(int32, 0, 1)
    Atomics.notify(int32, 0)
  }).catch((e: Error) => {
    error = e
    Atomics.store(int32, 0, 1)
    Atomics.notify(int32, 0)
  })

  // 阻塞等待
  Atomics.wait(int32, 0, 0)
  if (error) throw error
  return result!
}

/** 同步执行写操作 */
function syncRun(sql: string, params: SqlValue[]): void {
  const p = getPool()
  const sab = new SharedArrayBuffer(4)
  const int32 = new Int32Array(sab)
  let error: Error | null = null

  p.query(sql, params).then(() => {
    Atomics.store(int32, 0, 1)
    Atomics.notify(int32, 0)
  }).catch((e: Error) => {
    error = e
    Atomics.store(int32, 0, 1)
    Atomics.notify(int32, 0)
  })

  Atomics.wait(int32, 0, 0)
  if (error) throw error
}

class MysqlPreparedStatement implements PreparedStatement {
  constructor(private sql: string) {}

  all(...params: SqlValue[]): Record<string, unknown>[] {
    const { rows } = syncQuery(this.sql, params)
    return rows
  }

  get(...params: SqlValue[]): Record<string, unknown> | undefined {
    const { rows } = syncQuery(this.sql, params)
    return rows[0]
  }

  run(...params: SqlValue[]): void {
    syncRun(this.sql, params)
  }
}

class MysqlDatabaseSync implements DatabaseSync {
  exec(sql: string): void {
    syncRun(sql, [])
  }

  prepare(sql: string): PreparedStatement {
    return new MysqlPreparedStatement(sql)
  }
}

let db: MysqlDatabaseSync | null = null

export function getDb(_file?: string): DatabaseSync {
  if (db) return db
  db = new MysqlDatabaseSync()
  migrate(db)
  return db
}

export function getMemoryDb(): DatabaseSync {
  return getDb()
}

function migrate(d: DatabaseSync): void {
  // MySQL 建表语法
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS workspace_configs (
      owner_id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{}',
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      is_system TINYINT NOT NULL DEFAULT 0,
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id VARCHAR(36) NOT NULL,
      code VARCHAR(64) NOT NULL,
      PRIMARY KEY (role_id, code),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id VARCHAR(36) NOT NULL,
      role_id VARCHAR(36) NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      last_seen_at VARCHAR(30) NOT NULL,
      expires_at VARCHAR(30) NOT NULL,
      ip VARCHAR(45),
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS login_events (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      email VARCHAR(255) NOT NULL,
      success TINYINT NOT NULL,
      ip VARCHAR(45),
      user_agent TEXT,
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensureIndex(d, 'idx_sessions_user', 'sessions', 'user_id')
  ensureIndex(d, 'idx_login_events_user', 'login_events', 'user_id')

  d.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      \`schema\` TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensureIndex(d, 'idx_pages_owner', 'pages', 'owner_id')

  d.exec(`
    CREATE TABLE IF NOT EXISTS datasources (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      config TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensureIndex(d, 'idx_datasources_owner', 'datasources', 'owner_id')

  d.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon VARCHAR(50) NOT NULL DEFAULT 'layout',
      page TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensureIndex(d, 'idx_templates_owner', 'templates', 'owner_id')

  d.exec(`
    CREATE TABLE IF NOT EXISTS components (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      base_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon VARCHAR(50) NOT NULL DEFAULT 'layers',
      config TEXT NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensureIndex(d, 'idx_components_owner', 'components', 'owner_id')

  // 同步日志表
  d.exec(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id VARCHAR(36) PRIMARY KEY,
      datasource_id VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'success',
      rows_synced INT NOT NULL DEFAULT 0,
      message TEXT,
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensureIndex(d, 'idx_sync_logs_ds', 'sync_logs', 'datasource_id')

  // 轻量列迁移：为已存在的旧库补充后加的列（幂等，忽略「列已存在」错误）
  ensureColumn(d, 'users', 'avatar', "TEXT NOT NULL DEFAULT ''")
}

/** 若索引不存在则创建（MySQL 无 CREATE INDEX IF NOT EXISTS） */
function ensureIndex(d: DatabaseSync, indexName: string, table: string, column: string): void {
  try {
    const rows = d.prepare(
      `SELECT INDEX_NAME AS name FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    ).all(table, indexName) as { name: string }[]
    if (rows.length > 0) return
    d.exec(`CREATE INDEX ${indexName} ON ${table}(${column})`)
  } catch {
    // 索引已存在或表不存在，忽略
  }
}

/** 若列不存在则添加（MySQL 无 IF NOT EXISTS 列语法，捕获重复列错误） */
function ensureColumn(d: DatabaseSync, table: string, column: string, definition: string): void {
  try {
    const rows = d.prepare(`SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`).all(table, column) as { name: string }[]
    if (rows.length > 0) return
    d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch {
    // 列已存在或表不存在，忽略
  }
}

// ---------- 查询助手 ----------

export function all<T = Record<string, unknown>>(d: DatabaseSync, sql: string, ...params: SqlValue[]): T[] {
  return d.prepare(sql).all(...params) as T[]
}

export function get<T = Record<string, unknown>>(d: DatabaseSync, sql: string, ...params: SqlValue[]): T | null {
  const row = d.prepare(sql).get(...params)
  return (row ?? null) as T | null
}

export function run(d: DatabaseSync, sql: string, ...params: SqlValue[]): void {
  d.prepare(sql).run(...params)
}

/** 关闭连接池（测试/迁移用） */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
