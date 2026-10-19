<script setup lang="ts">
/**
 * 页面设置面板（未选中卡片时显示）
 * 页面标题/描述、栅格列数与间距、布局方式、主题覆盖、全局过滤器。
 * 画布尺寸/背景等见 CanvasPanel。
 */

import { computed } from 'vue'
import { MButton, MColorPicker, MForm, MFormItem, MInput, MInputNumber, MSelect, MSegmented, MTextarea } from 'morya-ui'
import { useEditorStore } from '../store'
import { plain } from '../plain'
import type { PageFilter } from '../../types/schema'

const store = useEditorStore()
const page = computed(() => store.page)

const title = computed({
  get: () => page.value.title,
  set: (v: string) => store.updatePageField('title', v),
})
const description = computed({
  get: () => page.value.description ?? '',
  set: (v: string) => store.updatePageField('description', v || undefined),
})
const gridCols = computed({
  get: () => page.value.grid?.cols ?? 12,
  set: (v: number) => store.updatePageField('grid.cols', Math.max(4, Math.min(24, Number(v) || 12))),
})
const gridGap = computed({
  get: () => page.value.grid?.gap ?? 24,
  set: (v: number) => store.updatePageField('grid.gap', Math.max(0, Number(v) || 24)),
})
const layout = computed({
  get: () => page.value.layout,
  set: (v: string) => store.setLayout(v as 'free' | 'grid'),
})

// ---------- 主题覆盖 ----------
const primaryColor = computed({
  get: () => page.value.theme?.primaryColor ?? '',
  set: (v: string) => {
    const t = plain(page.value.theme ?? {})
    if (v) t.primaryColor = v
    else delete t.primaryColor
    store.updatePageField('theme', plain(t))
  },
})
const cardRadius = computed({
  get: () => page.value.theme?.cardRadius ?? undefined,
  set: (v: number | undefined) => {
    const t = plain(page.value.theme ?? {})
    if (v !== undefined && Number(v) > 0) t.cardRadius = Number(v)
    else delete t.cardRadius
    store.updatePageField('theme', plain(t))
  },
})

// ---------- 全局过滤器 ----------
const TYPE_OPTIONS = [
  { label: '日期', value: 'date' },
  { label: '数字', value: 'number' },
  { label: '文本', value: 'text' },
  { label: '下拉', value: 'select' },
]

function addFilter() {
  const next: PageFilter[] = [...plain(page.value.filters ?? []), { key: '', label: '过滤器', type: 'text' }]
  store.updatePageField('filters', plain(next))
}
function removeFilter(index: number) {
  const next = plain(page.value.filters ?? []).filter((_, i) => i !== index)
  store.updatePageField('filters', next.length ? plain(next) : undefined)
}
function patchFilter(index: number, patch: Partial<PageFilter>) {
  const next = plain(page.value.filters ?? [])
  next[index] = { ...next[index], ...plain(patch) }
  store.updatePageField('filters', plain(next))
}

const filterHint = '过滤器值会注入到数据源参数 {{var}}。用于 api 类型数据源的日期范围/筛选。'

function optionsText(index: number): string {
  const f = (page.value.filters ?? [])[index]
  return f?.options ? JSON.stringify(f.options) : '[]'
}
function onOptionsChange(index: number, text: string) {
  try {
    const options = JSON.parse(text || '[]')
    if (Array.isArray(options)) patchFilter(index, { options })
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="page-settings">
    <div class="panel-section">
      <p class="panel-section-title">页面</p>
      <MForm>
        <MFormItem label="标题"><MInput v-model="title" fluid /></MFormItem>
        <MFormItem label="描述"><MInput v-model="description" fluid /></MFormItem>
        <MFormItem label="布局方式">
          <MSegmented
            v-model="layout"
            :options="[{ label: '自由布局', value: 'free' }, { label: '网格布局', value: 'grid' }]"
            block
          />
        </MFormItem>
        <MFormItem label="栅格列数"><MInputNumber v-model="gridCols" :min="4" :max="24" fluid /></MFormItem>
        <MFormItem label="卡片间距(px)"><MInputNumber v-model="gridGap" :min="0" fluid /></MFormItem>
      </MForm>
    </div>

    <div class="panel-section">
      <p class="panel-section-title">主题覆盖</p>
      <MForm>
        <MFormItem label="主色" help="留空使用全局主题">
          <MColorPicker v-model="primaryColor" format="hex" clearable />
        </MFormItem>
        <MFormItem label="卡片圆角(px)">
          <MInputNumber v-model="cardRadius" :min="0" :max="40" clearable fluid />
        </MFormItem>
      </MForm>
    </div>

    <div class="panel-section">
      <p class="panel-section-title">全局过滤器</p>
      <p class="panel-section-hint">{{ filterHint }}</p>
      <div v-if="page.filters?.length" class="filter-list">
        <div v-for="(f, i) in page.filters" :key="i" class="filter-item">
          <div class="filter-item__row">
            <MInput :model-value="f.key" placeholder="参数名，如 startDate" fluid
              @update:model-value="patchFilter(i, { key: $event as string })" />
            <MButton type="text" size="small" danger @click="removeFilter(i)">删除</MButton>
          </div>
          <MForm>
            <MFormItem label="显示名">
              <MInput :model-value="f.label" fluid @update:model-value="patchFilter(i, { label: $event as string })" />
            </MFormItem>
            <MFormItem label="控件类型">
              <MSelect :model-value="f.type" :options="TYPE_OPTIONS" fluid
                @update:model-value="patchFilter(i, { type: $event as PageFilter['type'] })" />
            </MFormItem>
            <MFormItem label="默认值">
              <MInput :model-value="f.defaultValue ?? ''" fluid
                @update:model-value="patchFilter(i, { defaultValue: ($event as string) || undefined })" />
            </MFormItem>
            <MFormItem v-if="f.type === 'select'" label="选项(JSON)">
              <MTextarea :model-value="optionsText(i)" :rows="2" placeholder='[{"label":"近7天","value":"7"}]' fluid
                @update:model-value="onOptionsChange(i, $event as string)" />
            </MFormItem>
          </MForm>
        </div>
      </div>
      <MButton type="text" size="small" block @click="addFilter">+ 添加过滤器</MButton>
    </div>
  </div>
</template>

<style scoped>
.page-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--m-color-split);
}

.panel-section-hint {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-item {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
