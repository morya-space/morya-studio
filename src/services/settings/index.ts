/**
 * 设置服务：个人资料 / 工作区配置，对接后端 /api/settings。
 */

import type { PublicUser, WorkspaceConfig } from '@morya-studio/shared'
import { http } from '../../lib/http'

export async function updateProfile(patch: { name?: string; avatar?: string }): Promise<PublicUser> {
  const { user } = await http.patch<{ user: PublicUser }>('/settings/profile', patch)
  return user
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await http.post('/settings/profile/password', { currentPassword, newPassword })
}

export async function getWorkspace(): Promise<WorkspaceConfig> {
  const { config } = await http.get<{ config: WorkspaceConfig }>('/settings/workspace')
  return config
}

export async function saveWorkspace(patch: { name?: string; data?: Record<string, unknown> }): Promise<WorkspaceConfig> {
  const { config } = await http.put<{ config: WorkspaceConfig }>('/settings/workspace', patch)
  return config
}
