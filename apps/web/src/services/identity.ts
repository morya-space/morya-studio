import type { AuthSession, LoginEvent, Paginated, PermissionDefinition, Role, UserRecord, UserStatus } from '@morya-studio/shared'
import { request } from '../lib/http'

export async function fetchUsers(params: { query?: string; status?: UserStatus | 'all'; page: number; pageSize: number }) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    status: params.status ?? 'all',
  })
  if (params.query)
    search.set('query', params.query)
  return request<Paginated<UserRecord>>(`/api/users?${search.toString()}`)
}

export async function createUser(payload: { name: string; email: string; password: string; roleIds: string[]; status?: UserStatus }) {
  const result = await request<{ user: UserRecord }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return result.user
}

export async function updateUser(id: string, payload: { name?: string; email?: string; status?: UserStatus; roleIds?: string[] }) {
  const result = await request<{ user: UserRecord }>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return result.user
}

export async function deleteUser(id: string) {
  await request(`/api/users/${id}`, { method: 'DELETE' })
}

export async function fetchRoles() {
  const result = await request<{ items: Role[] }>('/api/roles')
  return result.items
}

export async function createRole(payload: { name: string; description?: string; permissions: string[] }) {
  const result = await request<{ role: Role }>('/api/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return result.role
}

export async function updateRole(id: string, payload: { name?: string; description?: string; permissions?: string[] }) {
  const result = await request<{ role: Role }>(`/api/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return result.role
}

export async function deleteRole(id: string) {
  await request(`/api/roles/${id}`, { method: 'DELETE' })
}

export async function fetchPermissions() {
  const result = await request<{ items: PermissionDefinition[] }>('/api/permissions')
  return result.items
}

export async function fetchSessions() {
  const result = await request<{ items: AuthSession[] }>('/api/auth/sessions')
  return result.items
}

export async function revokeSession(id: string) {
  await request(`/api/auth/sessions/${id}`, { method: 'DELETE' })
}

export async function revokeOtherSessions() {
  await request('/api/auth/sessions/others', { method: 'DELETE' })
}

export async function fetchLoginEvents(params: { page?: number; pageSize?: number } = {}) {
  const search = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 10),
  })
  return request<Paginated<LoginEvent>>(`/api/auth/login-events?${search.toString()}`)
}
