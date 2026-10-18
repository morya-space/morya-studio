<script setup lang="ts">
/**
 * 表格卡（table）
 * 用 MTable 渲染 schema.table 配置的列。
 * columns.render 映射格式化函数。
 */

import { computed, ref } from 'vue'
import { MTable, MTag } from 'morya-ui'
import CardShell from './CardShell.vue'
import { formatValue } from '../../data/format'
import { useElementSize } from '../../composables/useElementSize'
import type { TableColumn } from '../../types/schema'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const tableConfig = computed(() => props.schema.table)
const bodyRef = ref<HTMLElement | null>(null)
const { height: bodyHeight } = useElementSize(bodyRef)

/** 表格主体最大高度 = 卡片可用高度，超出的表体内部滚动，分页贴底（随卡片边框拖拽自适应） */
const tableMaxHeight = computed(() => (bodyHeight.value > 0 ? bodyHeight.value - 2 : undefined))

const columns = computed(() =>
  (tableConfig.value?.columns ?? []).map(col => ({
    key: col.key,
    label: col.title,
    width: typeof col.width === 'number' ? col.width : undefined,
    align: (col.align === 'left' ? 'start' : col.align === 'right' ? 'end' : 'center') as 'start' | 'center' | 'end',
  })),
)

const showPagination = computed(() => tableConfig.value?.showPagination ?? true)
const pageSize = computed(() => tableConfig.value?.pageSize ?? 10)

function colDef(key: string): TableColumn | undefined {
  return tableConfig.value?.columns.find(c => c.key === key)
}

function formatCell(col: TableColumn | undefined, value: unknown): string {
  if (!col || !col.render || col.render === 'text') return value === null || value === undefined ? '-' : String(value)
  switch (col.render) {
    case 'number': return formatValue(value, 'number', 0)
    case 'currency': return formatValue(value, 'currency', 2)
    case 'percent': return formatValue(value, 'percent', 1)
    case 'date': return value ? new Date(String(value)).toLocaleDateString() : '-'
    case 'status': return String(value ?? '-')
    default: return String(value ?? '-')
  }
}

function statusOf(col: TableColumn | undefined, value: unknown) {
  if (!col?.statusMap) return null
  return col.statusMap[String(value)] ?? null
}
</script>

<template>
  <CardShell
    :title="schema.title"
    :subtitle="schema.subtitle"
    :loading="loading"
    :error="error"
    :empty="data.length === 0"
    :state-text="schema.stateText"
    :actions="schema.actions"
    :show-header="true"
    @retry="emit('retry')"
    @action="emit('action', $event)"
  >
    <div ref="bodyRef" class="table-card__body">
    <MTable
      :columns="columns"
      :rows="data"
      :row-key="tableConfig?.rowKey ?? 'id'"
      :paginator="showPagination"
      :rows-per-page="pageSize"
      :max-height="tableMaxHeight"
      :empty-text="schema.stateText?.empty ?? '暂无数据'"
    >
      <template
        v-for="col in columns"
        :key="col.key"
        #[`cell-${col.key}`]="{ value }"
      >
        <template v-if="statusOf(colDef(col.key), value)">
          <MTag :type="statusOf(colDef(col.key), value)!.type">
            {{ statusOf(colDef(col.key), value)!.label }}
          </MTag>
        </template>
        <template v-else>
          {{ formatCell(colDef(col.key), value) }}
        </template>
      </template>
    </MTable>
    </div>
  </CardShell>
</template>

<style scoped>
.table-card__body {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
