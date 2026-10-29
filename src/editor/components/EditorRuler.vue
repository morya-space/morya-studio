<script setup lang="ts">
/**
 * 画布标尺（对齐 go-view EditRule）
 * 顶部/左侧标尺贴住容器边缘；刻度随「画布平移 + 缩放」同步。
 */

import { computed } from 'vue'
import { RULER_THICK, rulerStep } from '../ruler'

const props = defineProps<{
  /** 画布在内容区中的左上角偏移（屏幕像素） */
  panX: number
  panY: number
  /** 缩放比例 */
  zoom: number
  /** 视口尺寸（含标尺） */
  vw: number
  vh: number
}>()

const step = computed(() => rulerStep(props.zoom))

const hMarks = computed(() => {
  const out: { pos: number; label: number }[] = []
  const span = props.vw - RULER_THICK
  const s = step.value
  const startCanvas = Math.floor((0 - props.panX) / props.zoom / s) * s
  for (let c = startCanvas; ; c += s) {
    const pos = props.panX + c * props.zoom
    if (pos > span) break
    if (pos >= 0) out.push({ pos, label: Math.round(c) })
  }
  return out
})

const vMarks = computed(() => {
  const out: { pos: number; label: number }[] = []
  const span = props.vh - RULER_THICK
  const s = step.value
  const startCanvas = Math.floor((0 - props.panY) / props.zoom / s) * s
  for (let c = startCanvas; ; c += s) {
    const pos = props.panY + c * props.zoom
    if (pos > span) break
    if (pos >= 0) out.push({ pos, label: Math.round(c) })
  }
  return out
})
</script>

<template>
  <div class="ruler">
    <!-- 顶部水平标尺 -->
    <div class="ruler__h" :style="{ left: `${RULER_THICK}px`, height: `${RULER_THICK}px` }">
      <span
        v-for="m in hMarks"
        :key="`h${m.pos}`"
        class="ruler__tick ruler__tick--h"
        :style="{ left: `${m.pos}px` }"
      >{{ m.label }}</span>
    </div>

    <!-- 左侧垂直标尺 -->
    <div class="ruler__v" :style="{ top: `${RULER_THICK}px`, width: `${RULER_THICK}px` }">
      <span
        v-for="m in vMarks"
        :key="`v${m.pos}`"
        class="ruler__tick ruler__tick--v"
        :style="{ top: `${m.pos}px` }"
      >{{ m.label }}</span>
    </div>

    <!-- 左上角块 -->
    <div class="ruler__corner" :style="{ width: `${RULER_THICK}px`, height: `${RULER_THICK}px` }" />
  </div>
</template>

<style lang="scss" scoped>
.ruler {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}

.ruler__h,
.ruler__v,
.ruler__corner {
  position: absolute;
  background: var(--m-color-surface);
  border-color: var(--m-color-border);
}

.ruler__h {
  top: 0;
  right: 0;
  border-bottom: 1px solid var(--m-color-border);
}

.ruler__v {
  left: 0;
  bottom: 0;
  border-right: 1px solid var(--m-color-border);
}

.ruler__corner {
  left: 0;
  top: 0;
  border-right: 1px solid var(--m-color-border);
  border-bottom: 1px solid var(--m-color-border);
}

.ruler__tick {
  position: absolute;
  font-size: 10px;
  line-height: 1;
  color: var(--m-color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ruler__tick--h {
  top: 4px;
  transform: translateX(3px);
  border-left: 1px solid var(--m-color-border);
  padding-left: 3px;
}

.ruler__tick--v {
  left: 4px;
  transform: translateY(3px);
  border-top: 1px solid var(--m-color-border);
  padding-top: 3px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
</style>
