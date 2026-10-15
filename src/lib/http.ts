/**
 * 统一 HTTP 层：基于 fetch，自动注入 Bearer 令牌与 JSON 处理。
 * 401 时清空会话并跳转登录页。
 */

import type { ApiError } from '@morya-studio/shared'

const BASE = '/api'

export class HttpError extends Error {
  public status: number
  public code: string
  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message)
    this.status = status
    this.code = code
  }
}

let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

/** 注册 401 回调（清会话 + 跳登录），由会话层注入 */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {}
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new HttpError(0, 'network_error', '无法连接服务器，请确认后端已启动')
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined

  if (!res.ok) {
    const err = data as ApiError | undefined
    if (res.status === 401) onUnauthorized?.()
    throw new HttpError(res.status, err?.error ?? 'error', err?.message ?? `请求失败（${res.status}）`)
  }
  return data as T
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
