/**
 * MySQL 数据库层：用 mysql2/promise 连接池模拟 node:sqlite 的同步接口。
 * 通过 worker_threads 在独立线程执行查询，主线程用 Atomics.wait 等待结果。
 * 这样不会阻塞主线程事件循环，避免死锁。
 *
 * 生产建议：逐步将上层迁移到 async/await，移除此同步桥接。
 */

import { Worker, MessageChannel, receiveMessageOnPort } from 'node:worker_threads'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

// ---------- Worker 线程同步查询 ----------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKER_PATH = path.join(__dirname, 'worker-query.cjs')

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(WORKER_PATH, {
      workerData: {
        host: process.env.MYSQL_HOST ?? 'mysql6.sqlpub.com',
        port: Number(process.env.MYSQL_PORT ?? 3311),
        database: process.env.MYSQL_DATABASE ?? 'morya_data',
        user: process.env.MYSQL_USER ?? 'morya_admin',
        password: process.env.MYSQL_PASSWORD ?? 'bh4ZGrXLTBY8x9vJ',
      },
    })
  }
  return worker
}

/** 同步执行 SQL：发送给 worker 线程，用 Atomics.wait + receiveMessageOnPort 等待结果 */
function syncQuery(sql: string, params: SqlValue[]): { rows: Record<string, unknown>[]; fields: unknown[] } {
  const w = getWorker()
  const sab = new SharedArrayBuffer(4)
  const int32 = new Int32Array(sab)
  Atomics.store(int32, 0, 0)

  const { port1: mainPort, port2: workerPort } = new MessageChannel()
  w.postMessage({ sab, port: workerPort, sql, params }, [workerPort as never])

  // 主线程阻塞等待 worker 完成（worker 在不同线程，不会被阻塞）
  Atomics.wait(int32, 0, 0)

  const msg = receiveMessageOnPort(mainPort)
  mainPort.close()

  if (!msg) throw new Error('Worker did not respond')
  const result = msg.message as { ok: boolean; rows?: Record<string, unknown>[]; error?: string }
  if (!result.ok) throw new Error(result.error ?? 'Unknown worker error')
  return { rows: result.rows ?? [], fields: [] }
}

/** 同步执行写操作 */
function syncRun(sql: string, params: SqlValue[]): void {
  syncQuery(sql, params)
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
      avatar TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS workspace_configs (
      owner_id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      data TEXT,
      updated_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  d.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
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
    CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at VARCHAR(30) NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensureIndex(d, 'idx_password_resets_token', 'password_resets', 'token')

  d.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id VARCHAR(36) PRIMARY KEY,
      owner_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      \`schema\` LONGTEXT NOT NULL,
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
      config LONGTEXT NOT NULL,
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
      description TEXT,
      icon VARCHAR(50) NOT NULL DEFAULT 'layout',
      page LONGTEXT NOT NULL,
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
      description TEXT,
      icon VARCHAR(50) NOT NULL DEFAULT 'layers',
      config LONGTEXT NOT NULL,
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
  ensureColumn(d, 'users', 'avatar', "TEXT")

  // 大字段列类型升级：TEXT(64KB) → LONGTEXT(4GB)，面板/数据源/组件 JSON 可能超 64KB
  ensureLongTextColumn(d, 'pages', 'schema')
  ensureLongTextColumn(d, 'datasources', 'config')
  ensureLongTextColumn(d, 'templates', 'page')
  ensureLongTextColumn(d, 'components', 'config')
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

/** 若列类型不是 LONGTEXT 则升级（TEXT → LONGTEXT，幂等） */
function ensureLongTextColumn(d: DatabaseSync, table: string, column: string): void {
  try {
    const rows = d.prepare(
      `SELECT DATA_TYPE AS type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    ).all(table, column) as { type: string }[]
    if (rows.length === 0) return
    if (rows[0].type === 'longtext') return
    d.exec(`ALTER TABLE ${table} MODIFY COLUMN ${column} LONGTEXT NOT NULL`)
  } catch {
    // 表不存在或已是 LONGTEXT，忽略
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
  if (worker) {
    worker.terminate()
    worker = null
  }
}
