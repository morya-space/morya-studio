<script setup lang="ts">
/**
 * 属性面板（内容 / 定制）
 * 标题 + 注册表 editorSchema 自动生成表单。
 */

import { computed, ref, watch } from 'vue'
import { MDialog, MForm, MFormItem, MInput, MButton, message } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardRegistration, type EditorFieldSchema } from '../../engine/registry'
import FieldRenderer from '../components/FieldRenderer.vue'
import DataConfigCard from './DataConfigCard.vue'
import DataPanel from './DataPanel.vue'
import { plain } from '../plain'
import type { DataConfigDraft } from './dataDraft'

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

// 数据配置弹窗（草稿模式：编辑只写草稿，点「完成」才提交生效）
const dataDialog = ref(false)
const draft = ref<DataConfigDraft | null>(null)

function openDataDialog() {
  const c = card.value
  if (!c) return
  draft.value = {
    dataSource: c.dataSource ? plain(c.dataSource) : undefined,
    dataSourceId: c.dataSourceId,
    chart: c.chart ? plain(c.chart) : undefined,
  }
  dataDialog.value = true
}

/** commit=true「完成」提交；false「取消」/ 关闭则丢弃草稿 */
function closeDataDialog(commit: boolean) {
  const c = card.value
  const d = draft.value
  if (commit && c && d) {
    store.updateCardFields(c.id, {
      dataSource: d.dataSource,
      dataSourceId: d.dataSourceId,
      chart: d.chart,
    })
    // 提交后刷新卡片数据，画布即时生效
    const committed = store.selectedCard
    if (committed) void dataStore.refreshCard(committed)
    message.success('数据配置已生效')
  }
  draft.value = null
  dataDialog.value = false
}

// 通过遮罩 / 关闭按钮退出时同样丢弃草稿
watch(dataDialog, open => { if (!open) draft.value = null })
</script>

<template>
  <div v-if="card" class="properties-panel">
    <!-- 数据配置卡片（置顶） -->
    <p class="properties-panel__section">数据</p>
    <DataConfigCard @edit="openDataDialog" />

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
        <DataPanel v-if="draft" :draft="draft" />
      </div>
      <template #footer>
        <MButton type="default" @click="closeDataDialog(false)">取消</MButton>
        <MButton type="primary" @click="closeDataDialog(true)">完成</MButton>
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
