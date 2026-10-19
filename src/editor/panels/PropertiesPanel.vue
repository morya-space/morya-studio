<script setup lang="ts">
/**
 * 属性面板（内容 / 定制）
 * 标题 + 注册表 editorSchema 自动生成表单。
 */

import { computed, ref } from 'vue'
import { MDialog, MForm, MFormItem, MInput, MButton } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardRegistration, type EditorFieldSchema } from '../../engine/registry'
import FieldRenderer from '../components/FieldRenderer.vue'
import DataConfigCard from './DataConfigCard.vue'
import DataPanel from './DataPanel.vue'

const store = useEditorStore()
const dataStore = useDataStore()

const card = computed(() => store.selectedCard)
const registration = computed(() => (card.value ? getCardRegistration(card.value.type) : undefined))
const editorSchema = computed<EditorFieldSchema[]>(() => registration.value?.editorSchema ?? [])

/** 从已加载数据推断字段（auto:dataFields），并排除 'title' 字段自身 */
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
  store.updateCardField(card.value.id, field.field, value)
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

// 数据配置弹窗
const dataDialog = ref(false)
</script>

<template>
  <div v-if="card" class="properties-panel">
    <!-- 数据配置卡片（置顶） -->
    <p class="properties-panel__section">数据</p>
    <DataConfigCard @edit="dataDialog = true" />

    <p class="properties-panel__section">内容</p>
    <MForm>
      <MFormItem label="标题">
        <MInput
          :model-value="card.title ?? ''"
          placeholder="组件标题"
          fluid
          @update:model-value="store.updateCardField(card.id, 'title', $event || undefined)"
        />
      </MFormItem>
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
    <p v-if="!editorSchema.length" class="properties-panel__empty">该组件无可配置内容</p>

    <MDialog v-model="dataDialog" title="数据配置" width="760px">
      <div class="data-dialog-body">
        <DataPanel />
      </div>
      <template #footer>
        <MButton type="primary" @click="dataDialog = false">完成</MButton>
      </template>
    </MDialog>
  </div>
</template>

<style scoped>
.properties-panel {
  display: flex;
  flex-direction: column;
}

.properties-panel__empty {
  font-size: 12px;
  color: var(--m-color-text-muted);
  text-align: center;
  padding: 20px 0;
}

.properties-panel__section {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 16px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--m-color-split);
}

.data-dialog-body {
  max-height: 66vh;
  overflow: auto;
  padding-right: 4px;
}
</style>
