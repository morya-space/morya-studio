/**
 * 分享服务：发布/取消/查询分享状态 + 公开只读页面获取。
 * 分享链接为 /view/:pageId?token=xxx（公开路由 /api/public/pages/:id）。
 */

import type { PublicPageResult, PublishResult } from '@morya-studio/shared'
import { http } from '../../lib/http'

export interface ShareStatus {
  shared: boolean
  token: string | null
  url: string | null
}

/** 查询当前分享状态 */
export function getShareStatus(pageId: string): Promise<ShareStatus> {
  return http.get<ShareStatus>(`/pages/${pageId}/share`)
}

/** 发布（生成/轮换 token） */
export function publishPage(pageId: string): Promise<PublishResult> {
  return http.post<PublishResult>(`/pages/${pageId}/publish`)
}

/** 取消分享 */
export function unpublishPage(pageId: string): Promise<{ ok: boolean; shared: boolean }> {
  return http.post<{ ok: boolean; shared: boolean }>(`/pages/${pageId}/unpublish`)
}

/** 公开只读页面（免登录） */
export function getPublicPage(pageId: string, token: string): Promise<PublicPageResult> {
  return http.get<PublicPageResult>(`/public/pages/${pageId}?token=${encodeURIComponent(token)}`)
}

/** 由页面 id 与 token 拼出分享链接 */
export function buildShareLink(pageId: string, token: string): string {
  const { origin, pathname } = window.location
  const base = pathname.startsWith('/view/') ? origin : origin
  return `${base}/view/${pageId}?token=${encodeURIComponent(token)}`
}

/** 由页面 id 与 token 拼出 iframe 嵌入代码 */
export function buildEmbedCode(pageId: string, token: string, width = '100%', height = 600): string {
  const link = buildShareLink(pageId, token)
  return `<iframe src="${link}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`
}
