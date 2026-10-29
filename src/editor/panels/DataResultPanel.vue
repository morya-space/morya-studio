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
    <div class="result-panel__head">
      <div v-if="loading && !rows.length" class="text-helper">加载中…</div>
      <div v-else-if="result" class="result-panel__status" :class="result.ok ? 'is-ok' : 'is-err'">
        <span class="result-panel__dot" />
        <span class="result-panel__status-label">{{ result.ok ? '成功' : '失败' }}</span>
        <span v-if="result.status" class="result-panel__tag">状态 {{ result.status }}</span>
        <span v-if="result.durationMs != null" class="result-panel__tag">{{ result.durationMs }} ms</span>
        <span class="result-panel__tag">{{ rows.length || result.sampleRows || 0 }} 行</span>
      </div>
      <div v-else-if="rows.length" class="result-panel__status is-ok">
        <span class="result-panel__dot" />
        <span class="result-panel__status-label">数据</span>
        <span class="result-panel__tag">{{ rows.length }} 行</span>
      </div>
      <div v-else class="text-helper">点击「测试」查看结果</div>
      <span v-if="rows.length > ROW_LIMIT" class="result-panel__limit">显示前 {{ ROW_LIMIT }} 行</span>
    </div>

    <div class="result-panel__toolbar">
      <MButton v-for="t in TEMPLATES" :key="t.label" type="default" size="small" @click="add(t.make())">
        + {{ t.label }}
      </MButton>
      <MButton type="text" size="small" @click="add()">自定义列</MButton>
    </div>

    <div class="result-panel__body">
      <table class="result-panel__table">
        <thead>
          <tr>
            <th v-for="c in baseColumns" :key="c">{{ c }}</th>
            <th v-for="(f, i) in fields" :key="`cf-${i}`" class="is-computed">
              <div class="result-panel__cf-row">
                <input
                  class="result-panel__cf-input result-panel__cf-input--name"
                  :value="f.name"
                  placeholder="列名"
                  aria-label="计算列名称"
                  @input="patch(i, 'name', ($event.target as HTMLInputElement).value)"
                />
                <input
                  class="result-panel__cf-input result-panel__cf-input--expr"
                  :value="f.expr"
                  placeholder="表达式，如 a - b"
                  aria-label="计算列表达式"
                  @input="patch(i, 'expr', ($event.target as HTMLInputElement).value)"
                />
                <button type="button" class="result-panel__cf-remove" aria-label="删除计算列" @click="remove(i)">×</button>
              </div>
              <div v-if="profiles?.length" class="result-panel__cf-profiles">
                <button
                  v-for="p in profiles.slice(0, 6)"
                  :key="p.key"
                  type="button"
                  class="result-panel__cf-chip"
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
      <summary class="result-panel__raw-toggle">原始响应</summary>
      <pre class="result-panel__raw-pre">{{ rawJson }}</pre>
    </details>
  </div>
</template>

<style lang="scss" scoped>
.result-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: var(--m-radius-md);
  border: 1px solid var(--m-color-border);
  background: var(--m-color-fill-light);
  padding: 0.75rem;

  &__head {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__tag {
    border-radius: 9999px;
    background: var(--m-color-surface);
    padding: 1px 0.5rem;
    font-variant-numeric: tabular-nums;
  }

  &__limit {
    white-space: nowrap;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text-muted);
  }

  &__toolbar {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  &__body {
    min-height: 180px;
    flex: 1;
    overflow: auto;
    border-radius: var(--m-radius-sm);
    border: 1px solid var(--m-color-border);
    background: var(--m-color-surface);
  }

  &__cf-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  &__cf-remove {
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 0 0.125rem;
    font-size: 0.875rem;
    line-height: 1;
    color: var(--m-color-text-muted);

    &:hover {
      color: var(--m-color-danger);
    }
  }

  &__cf-profiles {
    margin-top: 0.25rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  &__cf-chip {
    cursor: pointer;
    border: none;
    border-radius: 9999px;
    background: var(--m-color-surface);
    padding: 0 0.375rem;
    font-size: 11px;
    color: var(--m-color-primary);
  }

  &__raw-toggle {
    cursor: pointer;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-primary);
  }

  &__raw-pre {
    margin: 0.5rem 0 0;
    max-height: 120px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    border-radius: var(--m-radius-sm);
    background: var(--m-color-surface);
    padding: 0.625rem;
    font-family: var(--m-font-mono, monospace);
    font-size: 0.75rem;
    line-height: 1rem;
  }
}

.result-panel__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  line-height: 1rem;
  color: var(--m-color-text-muted);

  &.is-ok .result-panel__dot { background: var(--m-color-success); }
  &.is-err .result-panel__dot { background: var(--m-color-danger); }
}

.result-panel__status-label {
  font-weight: 600;
  color: var(--m-color-text);
}

.result-panel__dot {
  height: 0.5rem;
  width: 0.5rem;
  border-radius: 9999px;
  background: var(--m-color-text-muted);
}

.result-panel__table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--m-color-split);
    text-align: left;
    vertical-align: top;
    white-space: nowrap;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--m-color-fill-light);
    color: var(--m-color-text-muted);
    font-weight: 600;
  }

  .is-computed {
    background: color-mix(in srgb, var(--m-color-primary) 6%, var(--m-color-surface));
  }

  th.is-computed {
    min-width: 220px;
    background: color-mix(in srgb, var(--m-color-primary) 10%, var(--m-color-fill-light));
  }
}

.result-panel__cf-input {
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  background: var(--m-color-surface);
  color: var(--m-color-text);
  font-size: 12px;

  &--name {
    width: 72px;
    flex: none;
  }

  &--expr {
    width: 120px;
    flex: 1;
  }
}
</style>
