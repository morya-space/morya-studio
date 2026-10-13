/**
 * 读取 CSS 变量（--m-* token）的工具
 * 供图表等 JS 场景获取 token 值，避免在 JS 中写死颜色。
 */

const cache = new Map<string, string>()

/**
 * 读取当前文档根元素的 CSS 变量值。
 * @param name 变量名（含 -- 前缀），如 '--m-color-primary'
 * @param fallback 取不到时的兜底值
 */
export function getToken(name: string, fallback: string = ''): string {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') return fallback
  if (cache.has(name)) {
    const v = cache.get(name)
    if (v) return v
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (value) cache.set(name, value)
  return value || fallback
}

/** 读取一组图表调色板 token（--m-chart-1 .. --m-chart-6） */
export function getChartPalette(): string[] {
  const palette: string[] = []
  for (let i = 1; i <= 6; i++) {
    const v = getToken(`--m-chart-${i}`)
    if (v) palette.push(v)
  }
  return palette
}

/** 主题切换时清除缓存（例如 [data-theme] 变化后调用） */
export function clearTokenCache(): void {
  cache.clear()
}
