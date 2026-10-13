<script setup lang="ts">
/**
 * 属性面板
 * 根据选中卡片的 editorSchema 自动生成表单，编辑卡片配置。
 * 顶部含数据源绑定选择；'auto:dataFields' 字段从绑定数据推断。
 */

import { computed } from 'vue'
import { MEmpty, MForm, MFormItem, MSelect } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardRegistration, type EditorFieldSchema } from '../../engine/registry'
import { listDataSources } from '../../services/datasource'
import FieldRenderer from '../components/FieldRenderer.vue'

const editorStore = useEditorStore()
const dataStore = useDataStore()

const card = computed(() => editorStore.selectedCard)
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
    <template v-if="card">
      <div class="panel-section">
        <p class="panel-section-title">数据绑定</p>
        <MForm>
          <MFormItem label="数据源">
            <MSelect v-model="dataSourceId" :options="dataSourceOptions" fluid allow-clear />
          </MFormItem>
        </MForm>
      </div>

      <div v-if="editorSchema.length" class="panel-section">
        <p class="panel-section-title">卡片配置</p>
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
      </div>
    </template>

    <div v-else class="panel-placeholder">
      <MEmpty title="未选中卡片" description="点击画布中的卡片进行配置" />
    </div>
  </div>
</template>

<style scoped>
.property-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.panel-placeholder {
  padding: 24px 0;
}
</style>
