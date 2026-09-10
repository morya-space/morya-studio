import { computed, ref } from 'vue'

export interface AuthUser {
  id: string
  name: string
  email: string
}

const SESSION_KEY = 'morya-studio:session'
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const currentUser = ref<AuthUser | null>(readSession())

function readSession(): AuthUser | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? JSON.parse(value) as AuthUser : null
  } catch {
    return null
  }
}

function saveSession(user: AuthUser) {
  currentUser.value = user
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export async function register(name: string, email: string, password: string) {
  const result = await request<{ user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  saveSession(result.user)
  return result.user
}

export async function login(email: string, password: string) {
  const result = await request<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  saveSession(result.user)
  return result.user
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
  currentUser.value = null
  localStorage.removeItem(SESSION_KEY)
}

export async function restoreSession() {
  try {
    const result = await request<{ user: AuthUser }>('/api/auth/me')
    saveSession(result.user)
  } catch {
    currentUser.value = null
    localStorage.removeItem(SESSION_KEY)
  }
}

export function useAuth() {
  return {
    user: computed(() => currentUser.value),
    isAuthenticated: computed(() => currentUser.value !== null),
  }
}

async function request<T = { success: boolean }>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const body = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(body.error?.message ?? '请求失败，请稍后再试')
  }
  return body as T
}