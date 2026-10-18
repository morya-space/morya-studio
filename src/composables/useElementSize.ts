/**
 * useElementSize
 * 监听元素尺寸变化（含卡片拖拽缩放），返回 { width, height }。
 * 供需要随容器高度自适应的卡片（表格 maxHeight 等）使用。
 */

import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useElementSize(target: Ref<HTMLElement | null>) {
  const size = ref({ width: 0, height: 0 })
  let observer: ResizeObserver | null = null

  watch(target, (el, old) => {
    if (old) observer?.disconnect()
    if (!el) return
    const measure = () => {
      size.value = { width: el.clientWidth, height: el.clientHeight }
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(el)
    }
  }, { flush: 'post', immediate: true })

  onBeforeUnmount(() => observer?.disconnect())

  return size
}