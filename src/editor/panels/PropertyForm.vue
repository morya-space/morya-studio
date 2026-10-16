<script setup lang="ts">
/**
 * 属性面板
 * 对齐 demos/editor.html 原型：按「布局 / 数据绑定 / 卡片配置 / 数据转换 / 操作」分组。
 * 选中卡片时显示卡片属性；未选中显示页面设置。
 */

import { computed } from 'vue'
import { MButton, MForm, MFormItem, MInputNumber, MSelect } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardRegistration, type EditorFieldSchema } from '../../engine/registry'
import { cardNeedsDataSource } from '../../engine/utils'
import { listDataSources } from '../../services/datasource'
import FieldRenderer from '../components/FieldRenderer.vue'
import TransformEditor from './TransformEditor.vue'
import PageSettings from './PageSettings.vue'
import PropGroup from './PropGroup.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'

const editorStore = useEditorStore()
const dataStore = useDataStore()

const card = computed(() => editorStore.selectedCard)
const isFree = computed(() => editorStore.page.layout === 'free')
const needsDataSource = computed(() => card.value ? cardNeedsDataSource(card.value) : false)
const registration = computed(() =>
  card.value ? getCardRegistration(card.value.type) : undefined,
)
const editorSchema = computed<EditorFieldSchema[]>(() => registration.value?.editorSchema ?? [])

const dataSourceOptions = computed(() => {
  const saved = listDataSources()
    .filter(ds => ds.id)
    .map(ds => ({ label: ds.name ?? ds.id ?? '', value: ds.id ?? '' }))
  return [{ label: '（不绑定）', value: '' }, ...saved]
})

const dataSourceId = computed({
  get: () => card.value?.dataSourceId ?? '',
  set: (v: string) => {
    if (!card.value) return
    editorStore.updateCardField(card.value.id, 'dataSourceId', v || undefined)
    // 绑定后预加载数据，供 auto:dataFields 推断
    if (v && card.value) void dataStore.loadCardData({ ...card.value, dataSourceId: v })
  },
})

/** 推断当前绑定数据源的字段名（从已加载数据的第一行） */
const dataFieldOptions = computed(() => {
  if (!card.value) return []
  const rows = dataStore.cardData.get(card.value.id) ?? []
  const first = rows[0]
  if (!first) return []
  return Object.keys(first).map(k => ({ label: k, value: k }))
})

function fieldValue(field: EditorFieldSchema): unknown {
  if (!card.value) return undefined
  return getByPath(card.value as unknown as Record<string, unknown>, field.field)
}

function onFieldChange(field: EditorFieldSchema, value: unknown) {
  if (!card.value) return
  editorStore.updateCardField(card.value.id, field.field, value)
}

function setGeometry(field: 'x' | 'y' | 'w' | 'h', v: number | undefined) {
  if (!card.value) return
  editorStore.updateCardField(card.value.id, field, Number(v) || 0)
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}
</script>

<template>
  <div class="property-form">
    <!-- 未选中卡片 → 页面设置 -->
    <PageSettings v-if="!card" />

    <template v-else>
      <!-- 布局 -->
      <PropGroup title="布局">
        <div v-if="isFree" class="field-2">
          <MFormItem label="X">
            <MInputNumber :model-value="card.x ?? 0" :min="0" fluid
              @update:model-value="setGeometry('x', $event as number | undefined)" />
          </MFormItem>
          <MFormItem label="Y">
            <MInputNumber :model-value="card.y ?? 0" :min="0" fluid
              @update:model-value="setGeometry('y', $event as number | undefined)" />
          </MFormItem>
          <MFormItem label="宽">
            <MInputNumber :model-value="card.w ?? 0" :min="60" fluid
              @update:model-value="setGeometry('w', $event as number | undefined)" />
          </MFormItem>
          <MFormItem label="高">
            <MInputNumber :model-value="card.h ?? 0" :min="40" fluid
              @update:model-value="setGeometry('h', $event as number | undefined)" />
          </MFormItem>
        </div>
        <MFormItem v-else label="跨列数">
          <MInputNumber
            :model-value="card.span ?? 6"
            :min="1"
            :max="editorStore.page.grid?.cols ?? 12"
            fluid
            @update:model-value="editorStore.resizeCard(card.id, Number($event ?? 6))"
          />
        </MFormItem>
      </PropGroup>

      <!-- 数据绑定 -->
      <PropGroup title="数据绑定">
        <MFormItem label="数据源">
          <MSelect v-model="dataSourceId" :options="dataSourceOptions" fluid allow-clear />
        </MFormItem>
        <p v-if="needsDataSource" class="datasource-hint">
          该组件需要数据源，绑定后即可显示
        </p>
      </PropGroup>

      <!-- 卡片配置 -->
      <PropGroup v-if="editorSchema.length" title="内容">
        <MForm>
          <MFormItem
            v-for="field in editorSchema"
            :key="field.field"
            :label="field.label"
            :help="field.help"
          >
            <FieldRenderer
              :field="field"
              :model-value="fieldValue(field)"
              :data-field-options="dataFieldOptions"
              @update:model-value="onFieldChange(field, $event)"
            />
          </MFormItem>
        </MForm>
      </PropGroup>

      <!-- 数据转换 -->
      <PropGroup title="数据转换">
        <TransformEditor />
      </PropGroup>

      <!-- 操作 -->
      <PropGroup v-if="isFree" title="操作" default-open>
        <div class="op-row">
          <MButton type="default" size="small" block @click="editorStore.duplicateCard(card.id)">
            <SvgIcon name="plus" :px="12" /> 复制
          </MButton>
          <MButton type="default" size="small" block @click="editorStore.bringTo(card.id, 'front')">
            <SvgIcon name="arrow-up-right" :px="12" /> 置顶
          </MButton>
        </div>
        <div class="op-row">
          <MButton type="default" size="small" block @click="editorStore.bringTo(card.id, 'back')">
            <SvgIcon name="arrow-down-right" :px="12" /> 置底
          </MButton>
          <MButton danger size="small" block @click="editorStore.removeCard(card.id)">
            <SvgIcon name="x" :px="12" /> 删除
          </MButton>
        </div>
      </PropGroup>
    </template>
  </div>
</template>

<style scoped>
.property-form {
  display: flex;
  flex-direction: column;
}

.op-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.datasource-hint {
  font-size: 12px;
  color: var(--m-color-warning);
  margin: 0;
  padding: 6px 10px;
  border-radius: var(--m-radius-sm);
  background: color-mix(in srgb, var(--m-color-warning) 10%, transparent);
}

.op-row :deep(.m-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
</style>
