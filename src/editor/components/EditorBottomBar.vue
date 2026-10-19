<script setup lang="ts">
/**
 * 编辑器底部工具条（对齐 go-view EditBottom）
 * 缩放百分比 / 滑杆 / 锁定 / 适应 / 网格 / 面板显隐。
 */

import { computed } from 'vue'
import { MButton, MSlider, MTooltip } from 'morya-ui'
import { useEditorStore } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()

const zoomPct = computed(() => Math.round(store.zoom * 100))
const zoomModel = computed<number | number[]>({
  get: () => Math.round(store.zoom * 100),
  set: v => store.setZoom((Array.isArray(v) ? v[0] : v) / 100),
})

function onFit() {
  if (store.lockScale) return
  store.fitCanvas()
}
</script>

<template>
  <footer class="editor-bottom">
    <div class="eb-left">
      <MTooltip content="显示/隐藏左侧面板">
        <MButton
          type="text" icon-only
          :aria-label="store.showLeft ? '隐藏左侧面板' : '显示左侧面板'"
          @click="store.toggleLeftPanel()"
        >
          <template #icon><SvgIcon name="layout" :px="15" /></template>
        </MButton>
      </MTooltip>
      <MTooltip content="显示/隐藏网格">
        <MButton
          type="text" icon-only
          :aria-label="store.showGrid ? '隐藏网格' : '显示网格'"
          @click="store.showGrid = !store.showGrid"
        >
          <template #icon><SvgIcon name="grid" :px="15" /></template>
        </MButton>
      </MTooltip>
      <MTooltip content="显示/隐藏标尺">
        <MButton
          type="text" icon-only
          :aria-label="store.showRuler ? '隐藏标尺' : '显示标尺'"
          @click="store.showRuler = !store.showRuler"
        >
          <template #icon><SvgIcon name="more" :px="15" /></template>
        </MButton>
      </MTooltip>
    </div>

    <div class="eb-center">
      <MButton type="text" size="small" :disabled="store.zoom <= 0.4" aria-label="缩小"
        @click="store.zoomBy(-0.1)">−</MButton>
      <MSlider v-model="zoomModel" :min="40" :max="150" :step="5" class="eb-slider" />
      <MButton type="text" size="small" :disabled="store.zoom >= 1.5" aria-label="放大"
        @click="store.zoomBy(0.1)">＋</MButton>
      <span class="eb-percent">{{ zoomPct }}%</span>
      <MTooltip content="锁定缩放（适应时不改变）">
        <MButton
          type="text" icon-only
          :aria-label="store.lockScale ? '解锁缩放' : '锁定缩放'"
          @click="store.setLockScale(!store.lockScale)"
        >
          <template #icon><SvgIcon name="lock" :px="15" /></template>
        </MButton>
      </MTooltip>
      <MButton type="text" size="small" :disabled="store.lockScale" @click="onFit">适应</MButton>
    </div>

    <div class="eb-right">
      <MTooltip content="显示/隐藏右侧面板">
        <MButton
          type="text" icon-only
          :aria-label="store.showRight ? '隐藏右侧面板' : '显示右侧面板'"
          @click="store.toggleRightPanel()"
        >
          <template #icon><SvgIcon name="sliders" :px="15" /></template>
        </MButton>
      </MTooltip>
    </div>
  </footer>
</template>

<style scoped>
.editor-bottom {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--m-color-surface);
  border-top: 1px solid var(--m-color-border);
}

.eb-left,
.eb-right {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 100px;
}

.eb-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eb-slider {
  width: 140px;
}

.eb-percent {
  font-size: 12px;
  min-width: 42px;
  text-align: center;
  color: var(--m-color-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
