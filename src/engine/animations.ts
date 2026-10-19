/**
 * 卡片入场动画（v0.3）
 * 内置轻量动画（不引入 animate.css），类名定义见 src/styles/theme/animations.css。
 */

export interface AnimationOption {
  label: string
  value: string
}

export const CARD_ANIMATIONS: AnimationOption[] = [
  { label: '无', value: '' },
  { label: '淡入', value: 'fade-in' },
  { label: '上浮', value: 'slide-up' },
  { label: '下移', value: 'slide-down' },
  { label: '左入', value: 'slide-left' },
  { label: '右入', value: 'slide-right' },
  { label: '放大', value: 'zoom-in' },
  { label: '弹跳', value: 'bounce' },
]

const KNOWN = new Set(CARD_ANIMATIONS.map(o => o.value).filter(Boolean))

/** 返回卡片应附加的动画类名（空串表示无） */
export function cardAnimationClass(animations?: string[]): string {
  const name = animations?.[0]
  if (!name || !KNOWN.has(name)) return ''
  return `m-anim m-anim--${name}`
}
