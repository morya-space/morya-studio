<script setup lang="ts">
/**
 * 属性面板
 * 对齐 demos/editor.html 原型：按「布局 / 数据绑定 / 卡片配置 / 数据转换 / 操作」分组。
 * 选中卡片时显示卡片属性；未选中显示页面设置。
 */

import { computed, ref } from 'vue'
import { MButton, MForm, MFormItem, MInputNumber, MTag } from 'morya-ui'
import type { DataSourceConfig } from '../../types/schema'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getCardRegistration, type EditorFieldSchema } from '../../engine/registry'
import { cardDataSourceIds, cardNeedsDataSource } from '../../engine/utils'
import { getDataSource } from '../../services/datasource'
import { describeFields, fieldOptions, type FieldDescriptor } from '../../data/fields'
import FieldRenderer from '../components/FieldRenderer.vue'
import TransformEditor from './TransformEditor.vue'
import DataSourceBindingDialog from './DataSourceBindingDialog.vue'
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

// ==================== 数据源绑定（弹窗） ====================
const bindingVisible = ref(false)

const boundIds = computed<string[]>(() => card.value ? cardDataSourceIds(card.value) : [])
const boundSources = computed<DataSourceConfig[]>(() =>
  boundIds.value.map(id => getDataSource(id)).filter((ds): ds is DataSourceConfig => !!ds),
)
const unboundIds = computed(() =>
  boundIds.value.filter(id => !getDataSource(id)),
)

function unbindSource(id: string) {
  const c = card.value
  if (!c) return
  const next = boundIds.value.filter(x => x !== id)
  editorStore.updateSchema(draft => {
    const target = draft.cards.find(cc => cc.id === c.id)
    if (!target) return
    if (next.length) {
      target.dataSourceIds = next
      target.dataSourceId = next[0]
    } else {
      delete target.dataSourceIds
      delete target.dataSourceId
    }
  })
  const updated = editorStore.selectedCard
  if (updated) void dataStore.loadCardData({ ...updated })
}

/** 从已加载卡片数据探测字段描述符（类型 + 维度/指标/时间角色） */
const fieldDescriptors = computed<FieldDescriptor[]>(() => {
  if (!card.value) return []
  const rows = dataStore.cardData.get(card.value.id) ?? []
  return describeFields(rows)
})

/** 全部字段（含角色徽标），供 'auto:dataFields' 选择器 */
const dataFieldOptions = computed(() => fieldOptions(fieldDescriptors.value, 'all'))
/** 维度优先，供 X 轴 / 标签 / 标题等「类别」字段选择器 */
const dimensionFieldOptions = computed(() => fieldOptions(fieldDescriptors.value, 'dimension'))
/** 指标优先，供 Y 轴 / 数值 / 趋势等「数值」字段选择器 */
const metricFieldOptions = computed(() => fieldOptions(fieldDescriptors.value, 'metric'))

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
        <div class="binding-row">
          <div class="binding-chips">
            <MTag
              v-for="ds in boundSources" :key="ds.id"
              type="secondary" size="small" closable
              @close="unbindSource(ds.id!)"
            >{{ ds.name || ds.id }}</MTag>
            <MTag
              v-for="id in unboundIds" :key="id"
              type="danger" size="small" closable
              @close="unbindSource(id)"
            >{{ id }}（已失效）</MTag>
            <span v-if="!boundIds.length" class="binding-empty">未绑定数据源</span>
          </div>
          <MButton type="secondary" size="small" @click="bindingVisible = true">
            <SvgIcon name="plug" :px="12" /> 配置绑定
          </MButton>
        </div>
        <p v-if="boundIds.length > 1" class="binding-note">
          {{ boundIds.length }} 个数据源按行纵向合并
        </p>
        <p v-else-if="card?.dataSource" class="binding-note">
          该卡片仍有内联数据源；绑定注册数据源后以注册数据源优先
        </p>
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
              :dimension-field-options="dimensionFieldOptions"
              :metric-field-options="metricFieldOptions"
              :field-descriptors="fieldDescriptors"
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

      <DataSourceBindingDialog v-model="bindingVisible" />
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

.binding-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.binding-chips {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.binding-empty {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.binding-note {
  margin: 0;
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.binding-row :deep(.m-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.op-row :deep(.m-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
</style>
