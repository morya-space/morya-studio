import type { AuthUser } from '@morya-studio/shared'
import { computed, ref } from 'vue'
import { request } from '../lib/http'

const SESSION_KEY = 'morya-studio:session'
const currentUser = ref<AuthUser | null>(readSession())

function readSession(): AuthUser | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? JSON.parse(value) as AuthUser : null
  }
  catch {
    return null
  }
}

export function saveSession(user: AuthUser) {
  currentUser.value = user
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  currentUser.value = null
  localStorage.removeItem(SESSION_KEY)
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
  clearSession()
}

export async function restoreSession() {
  try {
    const result = await request<{ user: AuthUser }>('/api/auth/me')
    saveSession(result.user)
  }
  catch {
    clearSession()
  }
}

export async function updateProfile(name: string) {
  const result = await request<{ user: AuthUser }>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
  saveSession(result.user)
  return result.user
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await request('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function useAuth() {
  return {
    user: computed(() => currentUser.value),
    isAuthenticated: computed(() => currentUser.value !== null),
  }
}
