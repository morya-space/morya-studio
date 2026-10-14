/**
 * 应用配置（环境变量 + 默认值）。
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** apps/api 根目录 */
export const API_ROOT = path.resolve(__dirname, '..')

export interface AppConfig {
  /** 服务端口 */
  PORT: number
  /** 允许跨域来源（前端地址），逗号分隔多个 */
  APP_ORIGIN: string
  /** SQLite 数据库文件路径 */
  DB_FILE: string
  /** 会话有效期（毫秒），默认 7 天 */
  SESSION_TTL_MS: number
  /** 初始管理员账号（首次启动无用户时播种） */
  ADMIN_EMAIL: string
  ADMIN_PASSWORD: string
  ADMIN_NAME: string
}

export function getConfig(): AppConfig {
  const env = process.env
  return {
    PORT: Number(env.PORT ?? 3000),
    APP_ORIGIN: env.APP_ORIGIN ?? 'http://localhost:7828',
    DB_FILE: env.DB_FILE ?? path.join(API_ROOT, 'data', 'morya.db'),
    SESSION_TTL_MS: Number(env.SESSION_TTL_MS ?? 7 * 24 * 60 * 60 * 1000),
    ADMIN_EMAIL: env.ADMIN_EMAIL ?? 'grealish@teamdek.com',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD ?? 'studio',
    ADMIN_NAME: env.ADMIN_NAME ?? 'Grealish',
  }
}
