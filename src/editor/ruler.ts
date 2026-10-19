/** 标尺厚度（px），画布视口按此向内偏移 */
export const RULER_THICK = 20

/** 依据缩放选取刻度步长，保证屏幕间距 40~120px */
export function rulerStep(zoom: number): number {
  let s = 50
  while (s * zoom < 40) s *= 2
  while (s * zoom > 120) s /= 2
  return s
}
