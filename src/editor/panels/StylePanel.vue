<script setup lang="ts">
/**
 * 样式面板（v0.3）
 * 透明度 / 旋转 / 饱和度 / 对比度 / 亮度 / 混合模式 / 内容裁剪。
 */

import { computed } from 'vue'
import { MForm, MFormItem, MInputNumber, MSelect, MSwitch } from 'morya-ui'
import { useEditorStore } from '../store'

const store = useEditorStore()
const card = computed(() => store.selectedCard)

const BLEND_MODES = [
  { label: '正常', value: 'normal' },
  { label: '正片叠底', value: 'multiply' },
  { label: '滤色', value: 'screen' },
  { label: '叠加', value: 'overlay' },
  { label: '变暗', value: 'darken' },
  { label: '变亮', value: 'lighten' },
  { label: '差值', value: 'difference' },
]

function num(field: string) {
  return computed<number | undefined>({
    get: () => getByPath(card.value as unknown as Record<string, unknown>, field) as number | undefined,
    set: (v) => {
      if (!card.value) return
      store.updateCardField(card.value.id, field, v === undefined || Number.isNaN(v) ? undefined : Number(v))
    },
  })
}

const opacity = num('styles.opacity')
const rotateZ = num('styles.rotateZ')
const saturate = num('styles.saturate')
const contrast = num('styles.contrast')
const brightness = num('styles.brightness')

const blendMode = computed({
  get: () => card.value?.styles?.blendMode ?? 'normal',
  set: (v: string) => {
    if (!card.value) return
    store.updateCardField(card.value.id, 'styles.blendMode', v || undefined)
  },
})

const overflowHidden = computed({
  get: () => Boolean(card.value?.preview?.overflowHidden),
  set: (v: boolean) => {
    if (!card.value) return
    store.updateCardField(card.value.id, 'preview.overflowHidden', v)
  },
})

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}
</script>

<template>
  <div v-if="card" class="style-panel">
    <MForm>
      <div class="field-2">
      <MFormItem label="透明度" help="1 为完全不透明">
        <MInputNumber v-model="opacity" :min="0" :max="1" :step="0.05" clearable fluid />
      </MFormItem>
      <MFormItem label="旋转(deg)" help="0° 为默认">
        <MInputNumber v-model="rotateZ" :step="1" clearable fluid />
      </MFormItem>
      </div>
      <div class="field-2">
      <MFormItem label="饱和度" help="1 为默认">
        <MInputNumber v-model="saturate" :min="0" :step="0.1" clearable fluid />
      </MFormItem>
      <MFormItem label="对比度" help="1 为默认">
        <MInputNumber v-model="contrast" :min="0" :step="0.1" clearable fluid />
      </MFormItem>
      <MFormItem label="亮度" help="1 为默认">
        <MInputNumber v-model="brightness" :min="0" :step="0.1" clearable fluid />
      </MFormItem>
      </div>
      <MFormItem label="混合模式">
      <MSelect v-model="blendMode" :options="BLEND_MODES" fluid />
      </MFormItem>
      <MFormItem label="内容裁剪" help="开启后，内容超出组件边界时隐藏">
      <MSwitch v-model="overflowHidden" />
      </MFormItem>
    </MForm>
  </div>
</template>

<style scoped>
.style-panel {
  display: flex;
  flex-direction: column;
}
</style>
