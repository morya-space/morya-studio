/**
 * 对齐辅助线（v0.3）
 * 纯函数：给定正在拖动的矩形与参考矩形集合，计算最近的边/中线对齐增量与辅助线。
 * 参考实现借鉴 go-view 的 `_runAlignSnap`，但改为纯函数以便测试与响应式渲染。
 */

export interface Rect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface AlignGuide {
  /** 竖线（x 对齐）或横线（y 对齐） */
  axis: 'x' | 'y'
  /** 线的固定坐标 */
  pos: number
  /** 线在另一轴上的起点/终点（用于绘制跨越范围） */
  from: number
  to: number
}

export interface AlignResult {
  /** 需施加在 X/Y 上的吸附增量 */
  dx: number
  dy: number
  guides: AlignGuide[]
}

interface Edge {
  pos: number
}

function edgesX(r: Rect): Edge[] {
  return [{ pos: r.x }, { pos: r.x + r.w / 2 }, { pos: r.x + r.w }]
}

function edgesY(r: Rect): Edge[] {
  return [{ pos: r.y }, { pos: r.y + r.h / 2 }, { pos: r.y + r.h }]
}

/**
 * 计算对齐吸附。
 * @param moving 拖动/缩放后的候选矩形
 * @param refs 参考矩形（其它卡片 + 画布边界）
 * @param tolerance 命中阈值（px），<=0 时不吸附
 */
export function computeAlignGuides(moving: Rect, refs: Rect[], tolerance: number): AlignResult {
  const guides: AlignGuide[] = []
  if (tolerance <= 0 || refs.length === 0) return { dx: 0, dy: 0, guides }

  let bestX: { delta: number; pos: number; ref: Rect } | null = null
  let bestY: { delta: number; pos: number; ref: Rect } | null = null

  const mxs = edgesX(moving)
  const mys = edgesY(moving)

  for (const ref of refs) {
    for (const re of edgesX(ref)) {
      for (const me of mxs) {
        const delta = re.pos - me.pos
        if (Math.abs(delta) <= tolerance && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
          bestX = { delta, pos: re.pos, ref }
        }
      }
    }
    for (const re of edgesY(ref)) {
      for (const me of mys) {
        const delta = re.pos - me.pos
        if (Math.abs(delta) <= tolerance && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
          bestY = { delta, pos: re.pos, ref }
        }
      }
    }
  }

  if (bestX) {
    guides.push({
      axis: 'x',
      pos: bestX.pos,
      from: Math.min(moving.y, bestX.ref.y),
      to: Math.max(moving.y + moving.h, bestX.ref.y + bestX.ref.h),
    })
  }
  if (bestY) {
    guides.push({
      axis: 'y',
      pos: bestY.pos,
      from: Math.min(moving.x, bestY.ref.x),
      to: Math.max(moving.x + moving.w, bestY.ref.x + bestY.ref.w),
    })
  }

  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guides }
}
