import type { ActionConfig } from '../types/schema'

export type SupportedAction =
  | { type: 'refresh' }
  | { type: 'navigate'; url: string }

/**
 * Only declarative actions are accepted at runtime. This deliberately leaves
 * no path for schema data to evaluate code or invoke arbitrary functions.
 */
export function parseAction(action: string): SupportedAction | null {
  if (action === 'refresh') return { type: 'refresh' }
  if (!action.startsWith('navigate:')) return null

  const url = action.slice('navigate:'.length).trim()
  return isSafeNavigationUrl(url) ? { type: 'navigate', url } : null
}

export function isSafeNavigationUrl(url: string): boolean {
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return false

  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return true
  if (url.startsWith('#')) return true

  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function actionDescription(action: string): string | null {
  const parsed = parseAction(action)
  if (!parsed) return null
  return parsed.type === 'refresh' ? '刷新当前卡片' : `导航到 ${parsed.url}`
}

export function isSupportedAction(action: ActionConfig): boolean {
  return Boolean(action.label.trim()) && parseAction(action.action) !== null
}
