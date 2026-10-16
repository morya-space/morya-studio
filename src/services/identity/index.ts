/**
 * 身份管理服务：用户 / 角色（对接后端 /api/users、/api/roles，需 admin 权限）。
 */

import type { PublicUser, Role, UserStatus } from '@morya-studio/shared'
import { http } from '../../lib/http'

export async function listUsers(): Promise<PublicUser[]> {
  const { items } = await http.get<{ items: PublicUser[] }>('/users')
  return items
}

export async function listRoles(): Promise<Role[]> {
  const { items } = await http.get<{ items: Role[] }>('/roles')
  return items
}

export async function createUser(input: { name: string; email: string; password: string; roleIds?: string[] }): Promise<PublicUser> {
  const { user } = await http.post<{ user: PublicUser }>('/users', input)
  return user
}

export async function setUserRoles(userId: string, roleIds: string[]): Promise<void> {
  await http.put(`/users/${userId}/roles`, { roleIds })
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<void> {
  await http.patch(`/users/${userId}/status`, { status })
}

export async function deleteUser(userId: string): Promise<void> {
  await http.delete(`/users/${userId}`)
}
