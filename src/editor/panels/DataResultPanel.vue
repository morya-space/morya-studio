<script setup lang="ts">
/**
 * 数据测试结果面板（v0.4）
 * 展示测试的状态 / 耗时 / 行数 / 消息 / 表格预览 / 原始响应。
 */

import { computed } from 'vue'
import type { TestResult } from '../../data/adapters/base'

const props = defineProps<{
  result: TestResult | null
  loading: boolean
}>()

const columns = computed<string[]>(() => {
  const first = props.result?.sample?.[0]
  return first ? Object.keys(first) : []
})

const rawJson = computed(() => {
  try {
    return JSON.stringify(props.result?.raw ?? null, null, 2)
  } catch {
    return String(props.result?.raw ?? '')
  }
})
</script>

<template>
  <div class="result-panel">
    <div v-if="loading" class="result-panel__state">请求中…</div>
    <div v-else-if="!result" class="result-panel__state">点击「测试」查看结果</div>
    <template v-else>
      <div class="result-panel__status" :class="result.ok ? 'is-ok' : 'is-err'">
        <span class="result-panel__dot" />
        <span class="result-panel__badge">{{ result.ok ? '成功' : '失败' }}</span>
        <span v-if="result.status" class="result-panel__meta">状态 {{ result.status }}</span>
        <span v-if="result.durationMs != null" class="result-panel__meta">{{ result.durationMs }} ms</span>
        <span v-if="result.sampleRows != null" class="result-panel__meta">{{ result.sampleRows }} 行</span>
      </div>
      <p class="result-panel__msg">{{ result.message }}</p>

      <div v-if="columns.length" class="result-panel__table-wrap">
        <table class="result-panel__table">
          <thead>
            <tr><th v-for="c in columns" :key="c">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in result.sample" :key="i">
              <td v-for="c in columns" :key="c">{{ row[c] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details v-if="result.raw != null" class="result-panel__raw">
        <summary>原始响应</summary>
        <pre>{{ rawJson }}</pre>
      </details>
    </template>
  </div>
</template>

<style scoped>
.result-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 12px;
  background: var(--m-color-fill-light);
}

.result-panel__state {
  font-size: 12px;
  color: var(--m-color-text-muted);
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
  font-size: 12.5px;
  color: var(--m-color-text);
  word-break: break-word;
}

.result-panel__table-wrap {
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  background: var(--m-color-surface);
}

.result-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.result-panel__table th,
.result-panel__table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--m-color-split);
  white-space: nowrap;
}

.result-panel__table th {
  color: var(--m-color-text-muted);
  font-weight: 600;
  background: var(--m-color-fill-light);
}

.result-panel__raw summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--m-color-primary);
}

.result-panel__raw pre {
  margin: 8px 0 0;
  max-height: 200px;
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
