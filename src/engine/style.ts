/**
 * 卡片样式 → CSS（v0.3）
 * 把 CardSchema.styles 映射为内联样式；编辑态与运行时共用，保证一致。
 */

import type { CSSProperties } from 'vue'
import type { CardSchema } from '../types/schema'

/** 卡片外观样式（透明度/滤镜/旋转/混合模式） */
export function cardWrapperStyle(card: CardSchema): CSSProperties {
  const s = card.styles
  if (!s) return {}
  const out: CSSProperties = {}

  if (s.opacity !== undefined) out.opacity = s.opacity

  const filters: string[] = []
  if (s.hueRotate) filters.push(`hue-rotate(${s.hueRotate}deg)`)
  if (s.saturate !== undefined && s.saturate !== 1) filters.push(`saturate(${s.saturate})`)
  if (s.contrast !== undefined && s.contrast !== 1) filters.push(`contrast(${s.contrast})`)
  if (s.brightness !== undefined && s.brightness !== 1) filters.push(`brightness(${s.brightness})`)
  if (filters.length) out.filter = filters.join(' ')

  const transforms: string[] = []
  if (s.rotateZ) transforms.push(`rotateZ(${s.rotateZ}deg)`)
  if (s.skewX) transforms.push(`skewX(${s.skewX}deg)`)
  if (s.skewY) transforms.push(`skewY(${s.skewY}deg)`)
  if (transforms.length) out.transform = transforms.join(' ')

  if (s.blendMode && s.blendMode !== 'normal') out.mixBlendMode = s.blendMode

  return out
}
