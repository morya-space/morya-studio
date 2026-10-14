/**
 * 业务实体存储工厂：pages / datasources / templates / components 共用一套
 * 按 owner 隔离的 CRUD 逻辑。负载以 JSON 文本存储，标量列单独提取以便查询/约束。
 */

import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { all, get, run } from '../db/database'

export interface EntityRecord<TPayload = unknown> {
  id: string
  ownerId: string
  createdAt: string
  updatedAt: string
  /** 业务负载（已解析 JSON） */
  payload: TPayload
}

interface Row {
  id: string
  owner_id: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface EntityStoreOptions<TPayload> {
  /** 存放 JSON 文本的列名 */
  payloadColumn: string
  /** 除 payload 外需单独写入的标量列名（顺序与提取值一致） */
  scalarColumns: string[]
  /** 从负载提取标量列值（与 scalarColumns 顺序一致） */
  extractScalars: (payload: TPayload) => (string | number | null)[]
  /** 把解析后的 JSON 组装为返回负载（可合并标量列回读值） */
  toPayload: (row: Row, parsed: Record<string, unknown>) => TPayload
}

export interface EntityStore<TPayload = unknown> {
  list: (ownerId: string) => EntityRecord<TPayload>[]
  get: (ownerId: string, id: string) => EntityRecord<TPayload> | null
  create: (ownerId: string, payload: TPayload, id?: string) => EntityRecord<TPayload>
  update: (ownerId: string, id: string, payload: TPayload) => EntityRecord<TPayload> | null
  remove: (ownerId: string, id: string) => boolean
}

function now(): string {
  return new Date().toISOString()
}

export function createEntityStore<TPayload>(
  db: DatabaseSync,
  table: string,
  options: EntityStoreOptions<TPayload>,
): EntityStore<TPayload> {
  const { payloadColumn, scalarColumns, extractScalars, toPayload } = options

  function toRecord(row: Row): EntityRecord<TPayload> {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(String(row[payloadColumn] ?? '{}')) as Record<string, unknown>
    } catch {
      parsed = {}
    }
    return {
      id: row.id,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payload: toPayload(row, parsed),
    }
  }

  return {
    list(ownerId) {
      return all<Row>(db, `SELECT * FROM ${table} WHERE owner_id = ? ORDER BY updated_at DESC`, ownerId).map(toRecord)
    },
    get(ownerId, id) {
      const row = get<Row>(db, `SELECT * FROM ${table} WHERE owner_id = ? AND id = ?`, ownerId, id)
      return row ? toRecord(row) : null
    },
    create(ownerId, payload, id) {
      const eid = id ?? randomUUID()
      const ts = now()
      const scalars = extractScalars(payload)
      const cols = ['id', 'owner_id', ...scalarColumns, payloadColumn, 'created_at', 'updated_at']
      const placeholders = cols.map(() => '?').join(',')
      run(
        db,
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
        eid, ownerId, ...scalars, JSON.stringify(payload), ts, ts,
      )
      return { id: eid, ownerId, createdAt: ts, updatedAt: ts, payload }
    },
    update(ownerId, id, payload) {
      const existing = get<Row>(db, `SELECT * FROM ${table} WHERE owner_id = ? AND id = ?`, ownerId, id)
      if (!existing) return null
      const ts = now()
      const scalars = extractScalars(payload)
      const setScalars = scalarColumns.map(col => `${col} = ?`).join(', ')
      const setClause = scalarColumns.length > 0 ? `${setScalars}, ` : ''
      run(
        db,
        `UPDATE ${table} SET ${setClause}${payloadColumn} = ?, updated_at = ? WHERE owner_id = ? AND id = ?`,
        ...scalars, JSON.stringify(payload), ts, ownerId, id,
      )
      return { id, ownerId, createdAt: existing.created_at, updatedAt: ts, payload }
    },
    remove(ownerId, id) {
      const existing = get<Row>(db, `SELECT id FROM ${table} WHERE owner_id = ? AND id = ?`, ownerId, id)
      if (!existing) return false
      run(db, `DELETE FROM ${table} WHERE owner_id = ? AND id = ?`, ownerId, id)
      return true
    },
  }
}
