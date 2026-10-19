<script setup lang="ts">
/**
 * 画布配置面板（对齐 go-view CanvasPage）
 * 尺寸 / 背景色 / 背景图 / 主题 / 预览缩放 / 选中框色 / 网格 / 吸附 / 画布滤镜。
 */

import { computed, ref } from 'vue'
import { MButton, MColorPicker, MForm, MFormItem, MInput, MInputNumber, MSelect, MSegmented, MSwitch, message } from 'morya-ui'
import { useEditorStore } from '../store'
import { plain } from '../plain'

const store = useEditorStore()
const canvas = computed(() => store.page.canvas ?? {})

function updateCanvas(field: string, value: unknown): void {
  const next = plain(store.page.canvas ?? {}) as Record<string, unknown>
  if (value === undefined || value === '') delete next[field]
  else next[field] = plain(value)
  store.updatePageField('canvas', next)
}

function num(field: string, fallback: number, min = 0, max = 99999) {
  return computed({
    get: () => (canvas.value as Record<string, number>)[field] ?? fallback,
    set: (v: number) => updateCanvas(field, Math.max(min, Math.min(max, Math.round(Number(v) || fallback)))),
  })
}

const width = num('width', 1200, 320, 6000)
const height = num('height', 760, 240, 6000)
const gridSize = num('gridSize', 10, 4, 40)
const snap = num('snap', 10, 0, 40)

const bgColor = computed({
  get: () => (canvas.value.bgColor as string) ?? '',
  set: (v: string) => updateCanvas('bgColor', v || undefined),
})
const bgImage = computed({
  get: () => canvas.value.backgroundImage ?? '',
  set: (v: string) => updateCanvas('backgroundImage', v || undefined),
})
const theme = computed({
  get: () => canvas.value.theme ?? 'light',
  set: (v: string) => updateCanvas('theme', v),
})
const scaleType = computed({
  get: () => canvas.value.scaleType ?? 'fit',
  set: (v: string) => updateCanvas('scaleType', v),
})
const selectColor = computed({
  get: () => canvas.value.selectColor ?? '',
  set: (v: string) => updateCanvas('selectColor', v || undefined),
})

const SCALE_TYPE_OPTIONS = [
  { label: '适应', value: 'fit' },
  { label: '横向滚动', value: 'scrollX' },
  { label: '纵向滚动', value: 'scrollY' },
  { label: '原始', value: 'full' },
]

// 画布滤镜（复用 CardStyles 字段）
function filterNum(field: string, fallback: number, min: number, max: number, step = 0.1) {
  return computed({
    get: () => ((canvas.value.filter ?? {}) as Record<string, number>)[field] ?? fallback,
    set: (v: number) => {
      const filter = { ...(canvas.value.filter ?? {}) } as Record<string, unknown>
      filter[field] = Math.max(min, Math.min(max, Number(v)))
      updateCanvas('filter', filter)
    },
  })
}
const fOpacity = filterNum('opacity', 1, 0, 1, 0.05)
const fBrightness = filterNum('brightness', 1, 0, 3)
const fContrast = filterNum('contrast', 1, 0, 3)
const fSaturate = filterNum('saturate', 1, 0, 3)
const fHue = filterNum('hueRotate', 0, -180, 180, 1)

const BLEND_MODES = [
  { label: '正常', value: 'normal' },
  { label: '正片叠底', value: 'multiply' },
  { label: '滤色', value: 'screen' },
  { label: '叠加', value: 'overlay' },
  { label: '变暗', value: 'darken' },
  { label: '变亮', value: 'lighten' },
]
const fBlend = computed({
  get: () => (canvas.value.filter?.blendMode as string) ?? 'normal',
  set: (v: string) => {
    const filter = { ...(canvas.value.filter ?? {}) } as Record<string, unknown>
    if (!v || v === 'normal') delete filter.blendMode
    else filter.blendMode = v
    updateCanvas('filter', filter)
  },
})

// 水印
const watermarkShow = computed({
  get: () => Boolean(canvas.value.watermark?.show),
  set: (v: boolean) => updateCanvas('watermark', { ...(canvas.value.watermark ?? {}), show: v }),
})
const watermarkText = computed({
  get: () => canvas.value.watermark?.text ?? '',
  set: (v: string) => updateCanvas('watermark', { ...(canvas.value.watermark ?? {}), text: v || undefined }),
})

// 背景图上传
const bgInput = ref<HTMLInputElement | null>(null)
function triggerBgUpload() {
  bgInput.value?.click()
}
function onBgFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.error('请选择图片文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => updateCanvas('backgroundImage', String(reader.result ?? '') || undefined)
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="canvas-panel">
    <MForm>
      <section class="canvas-panel__section">
        <div class="canvas-panel__head">
          <h4>画布基础</h4>
          <p>设置页面的尺寸和预览适配方式。</p>
        </div>
        <div class="field-2">
        <MFormItem label="画布宽(px)"><MInputNumber v-model="width" :min="320" :max="6000" fluid /></MFormItem>
        <MFormItem label="画布高(px)"><MInputNumber v-model="height" :min="240" :max="6000" fluid /></MFormItem>
        </div>
      </section>
      <section class="canvas-panel__section">
        <div class="canvas-panel__head">
          <h4>背景与主题</h4>
          <p>背景设置会随页面一同保存和分享。</p>
        </div>
      <MFormItem label="背景色" help="留空使用默认表面色">
        <MColorPicker v-model="bgColor" format="hex" clearable />
      </MFormItem>
      <MFormItem label="背景图 URL">
        <div class="bg-row">
          <MInput v-model="bgImage" placeholder="https://… 或 dataURL" fluid />
          <MButton type="default" size="small" @click="triggerBgUpload">上传</MButton>
          <input ref="bgInput" type="file" accept="image/*" aria-label="上传画布背景图" class="bg-file" @change="onBgFile">
        </div>
      </MFormItem>
      <MFormItem label="画布主题">
        <MSegmented
          :model-value="theme"
          :options="[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }]"
          block
          @update:model-value="updateCanvas('theme', $event)"
        />
      </MFormItem>
      <MFormItem label="预览缩放">
        <MSelect v-model="scaleType" :options="SCALE_TYPE_OPTIONS" fluid />
      </MFormItem>
      </section>
      <section class="canvas-panel__section">
        <div class="canvas-panel__head">
          <h4>编辑辅助</h4>
          <p>仅影响画布中的辅助显示与拖拽对齐。</p>
        </div>
      <MFormItem label="选中框颜色" help="留空使用主色">
        <MColorPicker v-model="selectColor" format="hex" clearable />
      </MFormItem>

      <MFormItem label="显示网格">
        <MSwitch v-model="store.showGrid" />
      </MFormItem>
      <MFormItem label="网格颜色" help="留空用默认">
        <MColorPicker
          :model-value="(canvas.gridColor as string) ?? ''"
          format="hex" clearable
          @update:model-value="updateCanvas('gridColor', ($event as string) || undefined)"
        />
      </MFormItem>
      <MFormItem label="网格大小(px)"><MInputNumber v-model="gridSize" :min="4" :max="40" fluid /></MFormItem>
      <MFormItem label="对齐吸附(px)" help="0 关闭"><MInputNumber v-model="snap" :min="0" :max="40" fluid /></MFormItem>
      </section>

      <section class="canvas-panel__section">
        <div class="canvas-panel__head">
          <h4>高级视觉</h4>
          <p>调整整体滤镜和水印，默认值为不应用效果。</p>
        </div>
      <div class="field-2">
        <MFormItem label="透明度"><MInputNumber v-model="fOpacity" :min="0" :max="1" :step="0.05" clearable fluid /></MFormItem>
        <MFormItem label="亮度"><MInputNumber v-model="fBrightness" :min="0" :max="3" :step="0.1" clearable fluid /></MFormItem>
        <MFormItem label="对比度"><MInputNumber v-model="fContrast" :min="0" :max="3" :step="0.1" clearable fluid /></MFormItem>
        <MFormItem label="饱和度"><MInputNumber v-model="fSaturate" :min="0" :max="3" :step="0.1" clearable fluid /></MFormItem>
        <MFormItem label="色相(deg)"><MInputNumber v-model="fHue" :min="-180" :max="180" :step="1" clearable fluid /></MFormItem>
        <MFormItem label="混合模式"><MSelect v-model="fBlend" :options="BLEND_MODES" fluid /></MFormItem>
      </div>
      <MFormItem label="显示水印"><MSwitch v-model="watermarkShow" /></MFormItem>
      <MFormItem v-if="watermarkShow" label="水印文本">
        <MInput v-model="watermarkText" placeholder="Morya" fluid />
      </MFormItem>
      </section>
    </MForm>
  </div>
</template>

<style scoped>
.canvas-panel {
  display: flex;
  flex-direction: column;
}

.bg-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.bg-file {
  display: none;
}

.canvas-panel :deep(.m-form) {
  display: flex;
  flex-direction: column;
  gap: var(--m-space-5, 20px);
}

.canvas-panel__section {
  display: flex;
  flex-direction: column;
  gap: var(--m-space-3, 12px);
}

.canvas-panel__head {
  padding-bottom: var(--m-space-2, 8px);
  border-bottom: 1px solid var(--m-color-split);
}

.canvas-panel__head h4,
.canvas-panel__head p {
  margin: 0;
}

.canvas-panel__head h4 {
  color: var(--m-color-text);
  font-size: 13px;
  font-weight: 600;
}

.canvas-panel__head p {
  margin-top: 3px;
  color: var(--m-color-text-muted);
  font-size: 12px;
  line-height: 1.45;
}
</style>
