<script setup lang="ts">
/**
 * 事件面板（基础事件 + 组件联动）
 * 声明式配置，随 Schema 序列化；运行期执行见 docs/GO-VIEW-CANVAS-MIGRATION-PLAN.md。
 */

import { computed } from 'vue'
import { MButton, MFormItem, MInput, MSelect } from 'morya-ui'
import { useEditorStore } from '../store'
import { plain } from '../plain'
import type { ActionConfig, BaseEventName, CardEvents, InteractEvent } from '../../types/schema'

const store = useEditorStore()
const card = computed(() => store.selectedCard)
const events = computed<CardEvents>(() => card.value?.events ?? {})

const BASE_EVENTS: { key: BaseEventName; label: string }[] = [
  { key: 'click', label: '点击' },
  { key: 'dblclick', label: '双击' },
  { key: 'mouseenter', label: '移入' },
  { key: 'mouseleave', label: '移出' },
]

const ACTION_TYPES = [
  { label: '默认', value: 'secondary' },
  { label: '主要', value: 'primary' },
  { label: '危险', value: 'danger' },
]

const targetOptions = computed(() => {
  const self = card.value?.id
  return store.page.cards
    .filter(c => c.id !== self)
    .map(c => ({ label: `${c.title ?? c.type} (${c.id.slice(0, 6)})`, value: c.id }))
})

function writeEvents(next: CardEvents) {
  if (!card.value) return
  store.updateCardField(card.value.id, 'events', plain(next))
}

function baseActions(key: BaseEventName): ActionConfig[] {
  return events.value.base?.[key] ?? []
}

function addBaseAction(key: BaseEventName) {
  const next: CardEvents = { ...events.value, base: { ...events.value.base } }
  const list = [...baseActions(key), { label: '操作', action: '', type: 'secondary' as const }]
  next.base![key] = list
  writeEvents(next)
}

function setBaseAction(key: BaseEventName, index: number, patch: Partial<ActionConfig>) {
  const list = baseActions(key).map((a, i) => (i === index ? { ...a, ...patch } : a))
  const next: CardEvents = { ...events.value, base: { ...events.value.base, [key]: list } }
  writeEvents(next)
}

function removeBaseAction(key: BaseEventName, index: number) {
  const list = baseActions(key).filter((_, i) => i !== index)
  const next: CardEvents = { ...events.value, base: { ...events.value.base, [key]: list } }
  if (next.base && next.base[key] && next.base[key]!.length === 0) delete next.base[key]
  writeEvents(next)
}

// ---- 联动 ----
const interactions = computed<InteractEvent[]>(() => events.value.interactions ?? [])

function addInteraction() {
  const next: CardEvents = {
    ...events.value,
    interactions: [
      ...interactions.value,
      { id: `i-${Date.now().toString(36)}`, on: 'click', targetCardId: '', bindings: [{ target: '', source: '' }], enabled: true },
    ],
  }
  writeEvents(next)
}
function patchInteraction(index: number, patch: Partial<InteractEvent>) {
  const list = interactions.value.map((it, i) => (i === index ? { ...it, ...patch } : it))
  writeEvents({ ...events.value, interactions: list })
}
function removeInteraction(index: number) {
  writeEvents({ ...events.value, interactions: interactions.value.filter((_, i) => i !== index) })
}
</script>

<template>
  <div v-if="card" class="event-panel">
    <p class="event-panel__section">基础事件</p>
    <div v-for="be in BASE_EVENTS" :key="be.key" class="event-block">
      <div class="event-block__head">
        <span>{{ be.label }}</span>
        <MButton type="text" size="small" @click="addBaseAction(be.key)">+ 动作</MButton>
      </div>
      <div v-for="(act, i) in baseActions(be.key)" :key="i" class="event-row">
        <MInput :model-value="act.label" placeholder="按钮文案" fluid
          @update:model-value="setBaseAction(be.key, i, { label: $event as string })" />
        <MSelect :model-value="act.type ?? 'secondary'" :options="ACTION_TYPES" fluid
          @update:model-value="setBaseAction(be.key, i, { type: $event as ActionConfig['type'] })" />
        <MInput :model-value="act.action" placeholder="动作/URL" fluid
          @update:model-value="setBaseAction(be.key, i, { action: $event as string })" />
        <MButton type="text" size="small" danger @click="removeBaseAction(be.key, i)">×</MButton>
      </div>
    </div>

    <p class="event-panel__section">组件联动</p>
    <div v-for="(it, i) in interactions" :key="it.id" class="event-block">
      <div class="event-block__head">
        <span>当</span>
        <MInput :model-value="it.on" placeholder="事件名，如 click" style="width: 90px"
          @update:model-value="patchInteraction(i, { on: $event as string })" />
        <MSelect :model-value="it.targetCardId" :options="targetOptions" placeholder="目标组件" fluid
          @update:model-value="patchInteraction(i, { targetCardId: $event as string })" />
        <MButton type="text" size="small" danger @click="removeInteraction(i)">×</MButton>
      </div>
      <div class="event-row">
        <MInput :model-value="it.bindings[0]?.source ?? ''" placeholder="源字段，如 data.name" fluid
          @update:model-value="patchInteraction(i, { bindings: [{ target: it.bindings[0]?.target ?? '', source: $event as string }] })" />
        <span class="event-row__arrow">→</span>
        <MInput :model-value="it.bindings[0]?.target ?? ''" placeholder="目标参数名" fluid
          @update:model-value="patchInteraction(i, { bindings: [{ target: $event as string, source: it.bindings[0]?.source ?? '' }] })" />
      </div>
    </div>
    <MButton type="text" size="small" block @click="addInteraction">+ 添加联动</MButton>
  </div>
</template>

<style scoped>
.event-panel {
  display: flex;
  flex-direction: column;
}

.event-panel__section {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 12px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--m-color-split);
}

.event-block {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.event-block__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.event-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.event-row__arrow {
  color: var(--m-color-text-muted);
}
</style>
