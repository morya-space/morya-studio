/**
 * API 契约类型（前后端共用）
 * 鉴权 / 用户 / 通用响应。
 */

// ==================== 鉴权与身份 ====================

export type UserStatus = 'active' | 'disabled'

export interface PublicUser {
  id: string
  name: string
  email: string
  status: UserStatus
  roles: string[]
  permissions: string[]
  createdAt: string
}

export interface Role {
  id: string
  name: string
  description: string
  isSystem: boolean
  permissions: string[]
  createdAt: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  token: string
  user: PublicUser
}

export interface SessionInfo {
  id: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  ip: string | null
  userAgent: string | null
  current: boolean
}

// ==================== 通用 ====================

export interface ApiError {
  error: string
  message: string
  requestId?: string
}

export interface ListQuery {
  page?: number
  pageSize?: number
  query?: string
}

export interface ListResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface IdResult {
  id: string
}
