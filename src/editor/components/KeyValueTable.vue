<script setup lang="ts">
/**
 * 键值对编辑表（对齐 go-view RequestHeaderTable）
 * 用于请求参数 / 请求头。
 */

import { ref, watch } from 'vue'
import { MButton, MInput } from 'morya-ui'

const props = withDefaults(defineProps<{
  modelValue: Record<string, string>
  keyPlaceholder?: string
  valuePlaceholder?: string
}>(), {
  keyPlaceholder: 'Key',
  valuePlaceholder: 'Value',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string>): void
}>()

interface Row { key: string; value: string }

const rows = ref<Row[]>([{ key: '', value: '' }])

watch(() => props.modelValue, (v) => {
  const list = Object.entries(v ?? {}).map(([key, value]) => ({ key, value: String(value) }))
  rows.value = list.length ? list : [{ key: '', value: '' }]
}, { immediate: true, deep: true })

function commit() {
  const out: Record<string, string> = {}
  for (const r of rows.value) {
    if (r.key) out[r.key] = r.value
  }
  emit('update:modelValue', out)
}

function add(index: number) {
  rows.value.splice(index + 1, 0, { key: '', value: '' })
}
function remove(index: number) {
  if (rows.value.length === 1) {
    rows.value[0] = { key: '', value: '' }
  } else {
    rows.value.splice(index, 1)
  }
  commit()
}
</script>

<template>
  <div class="kv-table">
    <div class="kv-table__head">
      <span>Key</span>
      <span>Value</span>
      <span />
    </div>
    <div v-for="(row, i) in rows" :key="i" class="kv-table__row">
      <MInput v-model="row.key" :placeholder="keyPlaceholder" fluid @blur="commit" />
      <MInput v-model="row.value" :placeholder="valuePlaceholder" fluid @blur="commit" />
      <div class="kv-table__ops">
        <MButton type="text" size="small" aria-label="新增" @click="add(i)">+</MButton>
        <MButton type="text" size="small" danger aria-label="删除" @click="remove(i)">−</MButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kv-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kv-table__head,
.kv-table__row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  align-items: center;
}

.kv-table__head {
  font-size: 11px;
  color: var(--m-color-text-muted);
  text-transform: uppercase;
}

.kv-table__ops {
  display: flex;
  gap: 2px;
}
</style>
