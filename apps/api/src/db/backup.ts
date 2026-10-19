/**
 * MySQL 数据库备份：启动时自动导出为 SQL 文件到本地文件夹。
 * 防止线上数据崩溃导致数据丢失。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseSync } from './mysql'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** apps/api 根目录 */
const API_ROOT = path.resolve(__dirname, '..', '..')

/** 备份目录：apps/api/backups/ */
const BACKUP_DIR = path.join(API_ROOT, 'backups')

/** 需要备份的表（按外键依赖顺序排列，恢复时反序执行） */
const BACKUP_TABLES = [
  'password_resets',
  'sync_logs',
  'login_events',
  'sessions',
  'user_roles',
  'role_permissions',
  'roles',
  'users',
  'workspace_configs',
  'components',
  'templates',
  'datasources',
  'page_versions',
  'page_shares',
  'pages',
]

/** 将值转义为 SQL 字面量 */
function sqlEscape(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'bigint') return String(value)
  const s = String(value)
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
}

/** 导出单表为 INSERT 语句 */
function exportTable(db: DatabaseSync, table: string): string {
  const rows = db.prepare(`SELECT * FROM ${table}`).all()
  if (rows.length === 0) return `-- Table: ${table} (empty)\n\n`

  const cols = Object.keys(rows[0])
  const lines: string[] = []
  lines.push(`-- Table: ${table} (${rows.length} rows)`)
  lines.push(`DELETE FROM ${table};`)

  for (const row of rows) {
    const vals = cols.map(c => sqlEscape(row[c])).join(', ')
    lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals});`)
  }
  lines.push('')
  return lines.join('\n') + '\n'
}

/** 执行完整备份 */
export function backupDatabase(db: DatabaseSync): string | null {
  try {
    // 确保备份目录存在
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
    }

    const now = new Date()
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `backup-${ts}.sql`
    const filePath = path.join(BACKUP_DIR, fileName)

    const parts: string[] = []
    parts.push('-- Morya Studio Database Backup')
    parts.push(`-- Generated: ${now.toISOString()}`)
    parts.push(`-- Database: ${process.env.MYSQL_DATABASE ?? 'morya_data'}`)
    parts.push('')
    parts.push('SET FOREIGN_KEY_CHECKS = 0;')
    parts.push('')

    for (const table of BACKUP_TABLES) {
      try {
        parts.push(exportTable(db, table))
      } catch (e) {
        parts.push(`-- Table: ${table} (skipped: ${e instanceof Error ? e.message : String(e)})\n\n`)
      }
    }

    parts.push('SET FOREIGN_KEY_CHECKS = 1;')
    parts.push('')

    fs.writeFileSync(filePath, parts.join('\n'), 'utf-8')
    console.log(`[backup] Database backed up to ${filePath}`)

    // 清理旧备份：保留最近 10 份
    cleanOldBackups(10)

    return filePath
  } catch (e) {
    console.error('[backup] Failed to backup database:', e)
    return null
  }
}

/** 清理旧备份文件，保留最近 N 份 */
function cleanOldBackups(keep: number): void {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
      .sort()
      .reverse()

    for (let i = keep; i < files.length; i++) {
      const filePath = path.join(BACKUP_DIR, files[i])
      fs.unlinkSync(filePath)
      console.log(`[backup] Removed old backup: ${files[i]}`)
    }
  } catch (e) {
    console.error('[backup] Failed to clean old backups:', e)
  }
}

/** 获取备份文件列表 */
export function listBackups(): { name: string; path: string; size: number; time: Date }[] {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return []
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f)
        const stat = fs.statSync(filePath)
        return {
          name: f,
          path: filePath,
          size: stat.size,
          time: stat.mtime,
        }
      })
      .sort((a, b) => b.time.getTime() - a.time.getTime())
  } catch {
    return []
  }
}
