<script setup lang="ts">
/**
 * 表格卡（table）
 * 用 MTable 渲染 schema.table 配置的列。
 * columns.render 映射格式化函数。
 */

import { computed } from 'vue'
import { MTable, MTag } from 'morya-ui'
import CardShell from './CardShell.vue'
import { formatValue } from '../../data/format'
import { normalizeTableColumns } from './table-columns'
import type { TableColumn } from '../../types/schema'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const tableConfig = computed(() => props.schema.table)

/** 规格化列：装配面板写入的字段名数组与手工对象列统一处理；未配置时回退数据全列 */
const columnDefs = computed(() => normalizeTableColumns(tableConfig.value?.columns, props.data))

const columns = computed(() =>
  columnDefs.value.map(col => ({
    key: col.key,
    label: col.title,
    width: typeof col.width === 'number' ? col.width : undefined,
    align: (col.align === 'left' ? 'start' : col.align === 'right' ? 'end' : 'center') as 'start' | 'center' | 'end',
  })),
)

const showPagination = computed(() => tableConfig.value?.showPagination ?? true)
const pageSize = computed(() => tableConfig.value?.pageSize ?? 10)

function colDef(key: string): TableColumn | undefined {
  return columnDefs.value.find(c => c.key === key)
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
    <div class="table-card">
      <MTable
        :columns="columns"
        :rows="data"
        :row-key="tableConfig?.rowKey ?? 'id'"
        :paginator="showPagination"
        :rows-per-page="pageSize"
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

<style lang="scss" scoped>
.table-card {
  height: 100%;
  min-height: 0;
  overflow: auto;
}
</style>
