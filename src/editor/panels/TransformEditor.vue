<script setup lang="ts">
/**
 * 数据转换编辑器
 * 编辑选中卡片的 transform（TransformStep[]）：增删改、排序。
 */

import { computed, ref } from 'vue'
import { MButton, MForm, MFormItem, MInput, MInputNumber, MSelect, MTextarea } from 'morya-ui'
import { useEditorStore } from '../store'
import { plain } from '../plain'
import type { TransformStep } from '../../types/schema'

const store = useEditorStore()

const card = computed(() => store.selectedCard)
const steps = computed<TransformStep[]>(() => card.value?.transform ?? [])

function writeSteps(next: TransformStep[]) {
  if (!card.value) return
  store.updateCardField(card.value.id, 'transform', plain(next))
}

// ---------- 新增 ----------
const OP_OPTIONS = [
  { label: '过滤 filter', value: 'filter' },
  { label: '排序 sort', value: 'sort' },
  { label: '截取 limit', value: 'limit' },
  { label: '映射 map', value: 'map' },
  { label: '分组聚合 groupBy', value: 'groupBy' },
  { label: '重命名 rename', value: 'rename' },
]
const newOp = ref<TransformStep['op']>('filter')

function addStep() {
  const next = [...steps.value]
  const base: TransformStep = { op: newOp.value } as TransformStep
  switch (base.op) {
    case 'filter': (base as { expr: string }).expr = ''; break
    case 'sort': Object.assign(base, { field: '', order: 'asc' as const }); break
    case 'limit': Object.assign(base, { count: 10 }); break
    case 'map': (base as { expr: string }).expr = ''; break
    case 'groupBy': Object.assign(base, { field: '', aggs: { value: 'sum' } }); break
    case 'rename': Object.assign(base, { fields: {} }); break
  }
  next.push(base)
  writeSteps(next)
}

// ---------- 编辑 ----------
function updateStep(index: number, patch: Partial<TransformStep>) {
  const next = [...steps.value]
  next[index] = { ...next[index], ...patch } as TransformStep
  writeSteps(next)
}

function removeStep(index: number) {
  writeSteps(steps.value.filter((_, i) => i !== index))
}

function moveStep(index: number, dir: -1 | 1) {
  const next = [...steps.value]
  const j = index + dir
  if (j < 0 || j >= next.length) return
  ;[next[index], next[j]] = [next[j], next[index]]
  writeSteps(next)
}

function aggsText(index: number): string {
  const step = steps.value[index]
  if (step?.op !== 'groupBy') return '{}'
  return JSON.stringify(step.aggs, null, 0)
}

function onAggsChange(index: number, text: string) {
  try {
    const aggs = JSON.parse(text || '{}')
    if (aggs && typeof aggs === 'object') updateStep(index, { aggs })
  } catch { /* 非法 JSON 忽略 */ }
}

function renameText(index: number): string {
  const step = steps.value[index]
  if (step?.op !== 'rename') return '{}'
  return JSON.stringify(step.fields, null, 0)
}

function onRenameChange(index: number, text: string) {
  try {
    const fields = JSON.parse(text || '{}')
    if (fields && typeof fields === 'object') updateStep(index, { fields })
  } catch { /* ignore */ }
}

const OP_LABEL: Record<string, string> = {
  filter: '过滤', sort: '排序', limit: '截取', map: '映射', groupBy: '分组聚合', rename: '重命名',
}
</script>

<template>
  <div class="transform-editor">
    <div v-if="steps.length" class="transform-list">
      <div v-for="(step, i) in steps" :key="i" class="transform-item">
        <div class="transform-item__head">
          <span class="transform-item__op">{{ OP_LABEL[step.op] ?? step.op }}</span>
          <div class="transform-item__btns">
            <MButton type="text" size="small" @click="moveStep(i, -1)">↑</MButton>
            <MButton type="text" size="small" @click="moveStep(i, 1)">↓</MButton>
            <MButton type="text" size="small" danger @click="removeStep(i)">删除</MButton>
          </div>
        </div>

        <div v-if="step.op === 'filter'" class="transform-item__body">
          <MInput :model-value="(step as { expr: string }).expr" placeholder="如 value > 100" fluid
            @update:model-value="updateStep(i, { expr: $event as string })" />
        </div>

        <div v-else-if="step.op === 'sort'" class="transform-item__body transform-row">
          <MInput :model-value="(step as { field: string }).field" placeholder="字段名" fluid
            @update:model-value="updateStep(i, { field: $event as string })" />
          <MSelect :model-value="step.order ?? 'asc'" :options="[{ label: '升序', value: 'asc' }, { label: '降序', value: 'desc' }]" fluid
            @update:model-value="updateStep(i, { order: $event as 'asc' | 'desc' })" />
        </div>

        <div v-else-if="step.op === 'limit'" class="transform-item__body">
          <MInputNumber :model-value="(step as { count: number }).count" :min="0" fluid
            @update:model-value="updateStep(i, { count: Number($event ?? 0) })" />
        </div>

        <div v-else-if="step.op === 'map'" class="transform-item__body">
          <MInput :model-value="(step as { expr: string }).expr" placeholder="如 { x: row.a, y: row.b }" fluid
            @update:model-value="updateStep(i, { expr: $event as string })" />
        </div>

        <div v-else-if="step.op === 'groupBy'" class="transform-item__body transform-col">
          <MInput :model-value="(step as { field: string }).field" placeholder="分组字段" fluid
            @update:model-value="updateStep(i, { field: $event as string })" />
          <MTextarea :model-value="aggsText(i)" :rows="2" placeholder='{"sales":"sum"}' fluid
            @update:model-value="onAggsChange(i, $event as string)" />
        </div>

        <div v-else-if="step.op === 'rename'" class="transform-item__body">
          <MTextarea :model-value="renameText(i)" :rows="2" placeholder='{"oldName":"newName"}' fluid
            @update:model-value="onRenameChange(i, $event as string)" />
        </div>
      </div>
    </div>

    <MForm>
      <MFormItem label="添加步骤">
        <div class="transform-add">
          <MSelect v-model="newOp" :options="OP_OPTIONS" fluid />
          <MButton type="primary" size="small" @click="addStep">添加</MButton>
        </div>
      </MFormItem>
    </MForm>
  </div>
</template>

<style lang="scss" scoped>
.transform-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transform-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transform-item {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__op {
    font-size: 12px;
    font-weight: 600;
    color: var(--m-color-primary);
  }

  &__btns {
    display: flex;
    gap: 2px;
  }

  &__body {
    display: flex;
  }
}

.transform-row {
  flex-direction: row;
  gap: 8px;
}

.transform-col {
  flex-direction: column;
  gap: 8px;
}

.transform-add {
  display: flex;
  gap: 8px;
  width: 100%;
}
</style>
