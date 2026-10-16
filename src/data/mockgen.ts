/**
 * 轻量 Mock 数据生成器（自研，无外部依赖）
 * 模板 = JSON：可整体为数组（逐行填充），或单行 + 顶层 "{{repeat N}}" 前缀生成 N 行。
 *
 * 占位符（仅字符串值内有效，递归替换）：
 *   {{int min max}} / {{float min max}} / {{bool}}
 *   {{string}} / {{word}} / {{name}} / {{email}} / {{date}} / {{date start end}}
 *   {{pick a|b|c}} / {{inc}} / {{uuid}}
 */

const FIRST = ['张', '李', '王', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙']
const GIVEN = ['伟', '芳', '娜', '敏', '静', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '霞']
const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'user', 'order', 'sales', 'revenue', 'traffic', 'click', 'view', 'vip', 'active', 'new', 'retain']

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}
function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}
function randomString(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[randInt(0, chars.length - 1)]
  return out
}
function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const d = new Date(s + Math.random() * (e - s))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function generateMockRows(template: string): Record<string, unknown>[] {
  let count = 1
  let body = (template ?? '').trim()
  const repeat = /^\{\{\s*repeat\s+(\d+)\s*\}\}\s*([\s\S]*)$/i.exec(body)
  if (repeat) {
    count = Math.max(1, Math.min(parseInt(repeat[1], 10) || 1, 1000))
    body = repeat[2].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return []
  }
  if (parsed === null || typeof parsed !== 'object') return []

  if (Array.isArray(parsed)) {
    return parsed.map(row => fillValue(row, 0) as Record<string, unknown>)
  }

  const base = parsed as Record<string, unknown>
  const out: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    out.push(fillValue(base, i) as Record<string, unknown>)
  }
  return out
}

/** 递归填充：字符串值里的 {{token}} 全部替换为随机值 */
function fillValue(value: unknown, index: number): unknown {
  if (typeof value === 'string') return render(value, index)
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) return value.map(v => fillValue(v, index))
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = fillValue(v, index)
    return out
  }
  return value
}

function render(template: string, index: number): unknown {
  // 整串是一个 token：返回原生类型（数字/布尔）
  const full = /^\s*\{\{\s*([\w\s|.:-]+?)\s*\}\}\s*$/.exec(template)
  if (full) {
    const value = renderToken(full[1], index)
    if (value !== null) return value
    return template
  }
  return template.replace(/\{\{\s*([\w\s|.:-]+?)\s*\}\}/g, (match, raw: string) => {
    const value = renderToken(raw, index)
    return value === null ? match : String(value)
  })
}

function renderToken(raw: string, index: number): unknown {
  const parts = raw.trim().split(/\s+/)
  const op = parts[0].toLowerCase()
  switch (op) {
    case 'int': return randInt(Number(parts[1] ?? 0), Number(parts[2] ?? 100))
    case 'float': return Number(rand(Number(parts[1] ?? 0), Number(parts[2] ?? 100)).toFixed(2))
    case 'bool': return Math.random() < 0.5
    case 'string': return randomString(Number(parts[1] ?? 8))
    case 'word': return pick(WORDS)
    case 'name': return pick(FIRST) + pick(GIVEN)
    case 'email': return randomString(6) + '@example.com'
    case 'date': {
      const [start, end] = [parts[1] ?? '2024-01-01', parts[2] ?? '2024-12-31']
      return randomDate(start, end)
    }
    case 'pick': {
      const opts = raw.trim().slice(4).split('|').map(s => s.trim()).filter(Boolean)
      return opts.length ? pick(opts) : ''
    }
    case 'inc': return index
    case 'uuid': return crypto.randomUUID?.() ?? randomString(16)
    default: return null
  }
}
