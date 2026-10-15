/**
 * 数据库层入口：统一导出 DatabaseSync 接口与查询助手。
 * 当前使用 MySQL（mysql2 连接池），通过同步桥接保持与上层代码兼容。
 */

export type { DatabaseSync, SqlValue } from './mysql'
export { all, get, run, getDb, getMemoryDb, closePool } from './mysql'
