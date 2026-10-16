/**
 * 会话：对接后端鉴权（/api/auth）。
 * 登录获取 Bearer token，持久化到 localStorage；请求统一经 http 层注入。
 * 401 时自动清会话并回登录页。
 */

import { computed, ref } from 'vue'
import type { PublicUser } from '@morya-studio/shared'
import { http, setAuthToken, getAuthToken, setUnauthorizedHandler } from '../lib/http'
import { resetPages } from '../services/page'
import { resetDataSources } from '../services/datasource'
import { resetComponents } from '../services/component'
import { resetTemplates } from '../services/template'

const STORAGE_KEY = 'morya-studio-auth'

interface StoredAuth {
  token: string
  user: PublicUser
}

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredAuth>
    if (!parsed.token || !parsed.user) return null
    return { token: parsed.token, user: parsed.user }
  } catch {
    return null
  }
}

const stored = readStored()
const token = ref<string | null>(stored?.token ?? null)
const user = ref<PublicUser | null>(stored?.user ?? null)

// 启动即注入令牌与 401 处理
setAuthToken(token.value)
setUnauthorizedHandler(() => {
  clearSession()
  // 避免在登录页重复跳转
  if (!location.pathname.startsWith('/login')) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    location.href = `/login?redirect=${redirect}`
  }
})

function persist(): void {
  if (token.value && user.value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token.value, user: user.value }))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function clearSession(): void {
  token.value = null
  user.value = null
  setAuthToken(null)
  persist()
  // 会话失效（登出/401）时清空业务缓存，避免串号；下次进入页面时由各页面重新 init
  resetPages()
  resetDataSources()
  resetComponents()
  resetTemplates()
}

export function useSession() {
  const isAuthenticated = computed(() => token.value !== null && user.value !== null)

  /** 登录：成功返回 true，失败返回 false（凭据错误） */
  async function login(email: string, password: string): Promise<boolean> {
    try {
      const result = await http.post<{ token: string; user: PublicUser }>('/auth/login', { email, password })
      token.value = result.token
      user.value = result.user
      setAuthToken(result.token)
      persist()
      return true
    } catch {
      return false
    }
  }

  /** 注册：成功返回 true */
  async function register(name: string, email: string, password: string): Promise<boolean> {
    try {
      await http.post<{ user: PublicUser }>('/auth/register', { name, email, password })
      return true
    } catch {
      return false
    }
  }

  /** 请求密码重置：返回 resetToken（MVP 无邮件，直接返回） */
  async function forgotPassword(email: string): Promise<{ ok: boolean; resetToken?: string }> {
    try {
      return await http.post<{ ok: boolean; resetToken?: string }>('/auth/forgot-password', { email })
    } catch {
      return { ok: false }
    }
  }

  /** 用 token 重置密码 */
  async function resetPassword(token: string, password: string): Promise<boolean> {
    try {
      await http.post('/auth/reset-password', { token, password })
      return true
    } catch {
      return false
    }
  }

  /** 从后端刷新当前用户（权限/资料变更后） */
  async function refreshUser(): Promise<void> {
    if (!token.value) return
    try {
      const { user: fresh } = await http.get<{ user: PublicUser }>('/auth/me')
      user.value = fresh
      persist()
    } catch {
      /* 401 由 http 层统一处理 */
    }
  }

  async function logout(): Promise<void> {
    // 先同步清空本地会话（路由守卫立即放行 /login），再用旧 token 后台吊销服务端会话
    const current = getAuthToken()
    clearSession()
    if (current) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${current}` },
        })
      } catch {
        /* 忽略服务端吊销失败，本地已登出 */
      }
    }
  }

  /** 资料更新后直接同步本地用户（含持久化） */
  function setUser(u: PublicUser): void {
    user.value = u
    persist()
  }

  return { user, token, isAuthenticated, login, register, forgotPassword, resetPassword, logout, refreshUser, setUser }
}
