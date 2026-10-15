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
  /** MySQL 连接配置 */
  MYSQL_HOST: string
  MYSQL_PORT: number
  MYSQL_DATABASE: string
  MYSQL_USER: string
  MYSQL_PASSWORD: string
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
    MYSQL_HOST: env.MYSQL_HOST ?? 'mysql6.sqlpub.com',
    MYSQL_PORT: Number(env.MYSQL_PORT ?? 3311),
    MYSQL_DATABASE: env.MYSQL_DATABASE ?? 'morya_data',
    MYSQL_USER: env.MYSQL_USER ?? 'morya_admin',
    MYSQL_PASSWORD: env.MYSQL_PASSWORD ?? 'bh4ZGrXLTBY8x9vJ',
    SESSION_TTL_MS: Number(env.SESSION_TTL_MS ?? 7 * 24 * 60 * 60 * 1000),
    ADMIN_EMAIL: env.ADMIN_EMAIL ?? 'grealish@teamdek.com',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD ?? 'studio',
    ADMIN_NAME: env.ADMIN_NAME ?? 'Grealish',
  }
}
