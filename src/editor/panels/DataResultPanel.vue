<script setup lang="ts">
/**
 * 左侧测试数据表（常显）。
 * 有数据即展示，不随上方配置滚走；计算列作为表中的列编辑，结果写回同一张表。
 */

import { computed } from 'vue'
import { MButton } from 'morya-ui'
import type { TestResult } from '../../data/adapters/base'
import type { ComputedField } from '../../types/schema'
import type { FieldProfile } from '../../data/field-profile'

const ROW_LIMIT = 50

const props = defineProps<{
  result: TestResult | null
  loading: boolean
  rows: Record<string, unknown>[]
  fields: ComputedField[]
  profiles?: readonly FieldProfile[]
}>()

const emit = defineEmits<{
  'update:fields': [ComputedField[]]
}>()

const TEMPLATES: { label: string; make: () => ComputedField }[] = [
  { label: '四则运算', make: () => ({ name: 'newField', expr: 'a - b' }) },
  { label: '比率', make: () => ({ name: 'ratio', expr: 'part / total * 100' }) },
  { label: '拼接', make: () => ({ name: 'fullName', expr: "firstName + ' ' + lastName" }) },
  { label: '条件', make: () => ({ name: 'flag', expr: "value >= 60 ? '达标' : '未达标'" }) },
]

const computedNames = computed(() => new Set(props.fields.map(f => f.name.trim()).filter(Boolean)))

const baseColumns = computed(() => {
  const keys = new Set<string>()
  for (const row of props.rows) {
    for (const key of Object.keys(row)) {
      if (!computedNames.value.has(key)) keys.add(key)
    }
  }
  return [...keys]
})

const visibleRows = computed(() => props.rows.slice(0, ROW_LIMIT))

const rawJson = computed(() => {
  try {
    return JSON.stringify(props.result?.raw ?? null, null, 2)
  } catch {
    return String(props.result?.raw ?? '')
  }
})

function add(field?: ComputedField): void {
  const base = field ?? { name: `field_${props.fields.length + 1}`, expr: '' }
  emit('update:fields', [...props.fields, { ...base }])
}

function remove(index: number): void {
  emit('update:fields', props.fields.filter((_, i) => i !== index))
}

function patch(index: number, key: keyof ComputedField, value: string): void {
  emit('update:fields', props.fields.map((f, i) => (i === index ? { ...f, [key]: value } : f)))
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<template>
  <div class="result-panel">
    <div class="result-panel__bar">
      <div v-if="loading && !rows.length" class="result-panel__state">加载中…</div>
      <div v-else-if="result" class="result-panel__status" :class="result.ok ? 'is-ok' : 'is-err'">
        <span class="result-panel__dot" />
        <span class="result-panel__badge">{{ result.ok ? '成功' : '失败' }}</span>
        <span v-if="result.status" class="result-panel__meta">状态 {{ result.status }}</span>
        <span v-if="result.durationMs != null" class="result-panel__meta">{{ result.durationMs }} ms</span>
        <span class="result-panel__meta">{{ rows.length || result.sampleRows || 0 }} 行</span>
      </div>
      <div v-else-if="rows.length" class="result-panel__status is-ok">
        <span class="result-panel__dot" />
        <span class="result-panel__badge">数据</span>
        <span class="result-panel__meta">{{ rows.length }} 行</span>
      </div>
      <div v-else class="result-panel__state">点击「测试」查看结果</div>
      <span v-if="rows.length > ROW_LIMIT" class="result-panel__more">显示前 {{ ROW_LIMIT }} 行</span>
    </div>
    <p v-if="result?.message" class="result-panel__msg">{{ result.message }}</p>

    <div class="result-panel__tools">
      <MButton v-for="t in TEMPLATES" :key="t.label" type="default" size="small" @click="add(t.make())">
        + {{ t.label }}
      </MButton>
      <MButton type="text" size="small" @click="add()">自定义列</MButton>
    </div>

    <div class="result-panel__table-wrap">
      <table class="result-panel__table">
        <thead>
          <tr>
            <th v-for="c in baseColumns" :key="c">{{ c }}</th>
            <th v-for="(f, i) in fields" :key="`cf-${i}`" class="is-computed">
              <div class="result-panel__cf">
                <input
                  class="result-panel__cf-name"
                  :value="f.name"
                  placeholder="列名"
                  aria-label="计算列名称"
                  @input="patch(i, 'name', ($event.target as HTMLInputElement).value)"
                />
                <input
                  class="result-panel__cf-expr"
                  :value="f.expr"
                  placeholder="表达式，如 a - b"
                  aria-label="计算列表达式"
                  @input="patch(i, 'expr', ($event.target as HTMLInputElement).value)"
                />
                <button type="button" class="result-panel__cf-x" aria-label="删除计算列" @click="remove(i)">×</button>
              </div>
              <div v-if="profiles?.length" class="result-panel__cf-fields">
                <button
                  v-for="p in profiles.slice(0, 6)"
                  :key="p.key"
                  type="button"
                  class="result-panel__cf-field"
                  @click="patch(i, 'expr', `${f.expr ?? ''}${f.expr && !/\s$/.test(f.expr) ? ' ' : ''}${p.key}`)"
                >
                  {{ p.key }}
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in visibleRows" :key="i">
            <td v-for="c in baseColumns" :key="c">{{ formatCell(row[c]) }}</td>
            <td v-for="(f, fi) in fields" :key="`cfv-${fi}`" class="is-computed">{{ formatCell(row[f.name.trim()]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <details v-if="result?.raw != null" class="result-panel__raw">
      <summary>原始响应</summary>
      <pre>{{ rawJson }}</pre>
    </details>
  </div>
</template>

<style scoped>
.result-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 12px;
  background: var(--m-color-fill-light);
}

.result-panel__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.result-panel__state {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.result-panel__more {
  font-size: 12px;
  color: var(--m-color-text-muted);
  white-space: nowrap;
}

.result-panel__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.result-panel__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--m-color-text-muted);
}

.result-panel__status.is-ok .result-panel__dot {
  background: var(--m-color-success);
}

.result-panel__status.is-err .result-panel__dot {
  background: var(--m-color-danger);
}

.result-panel__badge {
  font-weight: 600;
  color: var(--m-color-text);
}

.result-panel__meta {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--m-color-surface);
  font-variant-numeric: tabular-nums;
}

.result-panel__msg {
  margin: 0;
  flex-shrink: 0;
  font-size: 12.5px;
  color: var(--m-color-text);
  word-break: break-word;
}

.result-panel__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}

.result-panel__table-wrap {
  flex: 1;
  min-height: 180px;
  overflow: auto;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  background: var(--m-color-surface);
}

.result-panel__table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.result-panel__table th,
.result-panel__table td {
  text-align: left;
  padding: 4px 8px;
  border-bottom: 1px solid var(--m-color-split);
  white-space: nowrap;
  vertical-align: top;
}

.result-panel__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: var(--m-color-text-muted);
  font-weight: 600;
  background: var(--m-color-fill-light);
}

.result-panel__table th.is-computed,
.result-panel__table td.is-computed {
  background: color-mix(in srgb, var(--m-color-primary) 6%, var(--m-color-surface));
}

.result-panel__table th.is-computed {
  background: color-mix(in srgb, var(--m-color-primary) 10%, var(--m-color-fill-light));
  min-width: 220px;
}

.result-panel__cf {
  display: flex;
  align-items: center;
  gap: 4px;
}

.result-panel__cf-name,
.result-panel__cf-expr {
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  background: var(--m-color-surface);
  color: var(--m-color-text);
  font-size: 12px;
}

.result-panel__cf-name {
  width: 72px;
  flex: none;
}

.result-panel__cf-expr {
  width: 120px;
  flex: 1;
}

.result-panel__cf-x {
  border: none;
  background: transparent;
  color: var(--m-color-text-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.result-panel__cf-x:hover {
  color: var(--m-color-danger);
}

.result-panel__cf-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.result-panel__cf-field {
  border: none;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--m-color-surface);
  color: var(--m-color-primary);
  font-size: 11px;
  cursor: pointer;
}

.result-panel__raw summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--m-color-primary);
}

.result-panel__raw pre {
  margin: 8px 0 0;
  max-height: 120px;
  overflow: auto;
  padding: 10px;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-surface);
  font-size: 12px;
  font-family: var(--m-font-mono, monospace);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
