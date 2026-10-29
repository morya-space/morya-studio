<script setup lang="ts">
/**
 * 事件面板（基础事件 + 组件联动）
 * 声明式配置，随 Schema 序列化；运行期执行见 docs/GO-VIEW-CANVAS-MIGRATION-PLAN.md。
 */

import { computed } from 'vue'
import { MButton, MForm, MFormItem, MInput, MSelect } from 'morya-ui'
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

const ACTION_OPTIONS = [
  { label: '刷新当前卡片', value: 'refresh' },
  { label: '导航到安全链接', value: 'navigate:' },
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
  const list = [...baseActions(key), { label: '刷新', action: 'refresh', type: 'secondary' as const }]
  next.base![key] = list
  writeEvents(next)
}

function actionKind(action: string): string {
  return action.startsWith('navigate:') ? 'navigate:' : 'refresh'
}

function setActionKind(key: BaseEventName, index: number, value: string) {
  const action = value === 'navigate:' ? 'navigate:' : 'refresh'
  setBaseAction(key, index, { action, label: value === 'navigate:' ? '打开链接' : '刷新' })
}

function setActionUrl(key: BaseEventName, index: number, url: string) {
  setBaseAction(key, index, { action: `navigate:${url.trim()}` })
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
    <MForm>
    <div v-for="be in BASE_EVENTS" :key="be.key" class="event-block">
      <div class="event-block__head">
        <span>{{ be.label }}</span>
        <MButton type="text" size="small" @click="addBaseAction(be.key)">+ 动作</MButton>
      </div>
      <div v-for="(act, i) in baseActions(be.key)" :key="i" class="event-action">
        <div class="event-action__head">
          <span>动作 {{ i + 1 }}</span>
          <MButton type="text" size="small" danger aria-label="删除此动作" @click="removeBaseAction(be.key, i)">删除</MButton>
        </div>
        <MFormItem label="动作名称">
          <MInput :model-value="act.label" placeholder="例如：刷新数据" fluid
          @update:model-value="setBaseAction(be.key, i, { label: $event as string })" />
        </MFormItem>
        <div class="event-grid">
          <MFormItem label="按钮样式">
            <MSelect :model-value="act.type ?? 'secondary'" :options="ACTION_TYPES" fluid
           @update:model-value="setBaseAction(be.key, i, { type: $event as ActionConfig['type'] })" />
          </MFormItem>
          <MFormItem label="执行行为">
            <MSelect :model-value="actionKind(act.action)" :options="ACTION_OPTIONS" fluid
           @update:model-value="setActionKind(be.key, i, $event as string)" />
          </MFormItem>
        </div>
        <MFormItem v-if="actionKind(act.action) === 'navigate:'" label="目标地址" help="仅允许 HTTPS、站内路径或锚点">
          <MInput :model-value="act.action.slice('navigate:'.length)" type="url" placeholder="https://…、/path 或 #anchor" fluid
          @update:model-value="setActionUrl(be.key, i, $event as string)" />
        </MFormItem>
      </div>
    </div>
    </MForm>

    <p class="event-panel__section">组件联动</p>
    <p class="event-panel__hint">事件仅支持点击、双击、移入和移出；源字段从当前卡片首行数据读取。</p>
    <MForm>
    <div v-for="(it, i) in interactions" :key="it.id" class="event-block">
      <div class="event-block__head">
        <span>联动 {{ i + 1 }}</span>
        <MButton type="text" size="small" danger aria-label="删除此联动" @click="removeInteraction(i)">删除</MButton>
      </div>
      <MFormItem label="触发事件">
        <MSelect :model-value="it.on" :options="BASE_EVENTS.map(event => ({ label: event.label, value: event.key }))" fluid
          @update:model-value="patchInteraction(i, { on: $event as string })" />
      </MFormItem>
      <MFormItem label="目标组件">
        <MSelect :model-value="it.targetCardId" :options="targetOptions" placeholder="目标组件" fluid
          @update:model-value="patchInteraction(i, { targetCardId: $event as string })" />
      </MFormItem>
      <div class="event-binding">
        <p>参数绑定</p>
        <MInput :model-value="it.bindings[0]?.source ?? ''" placeholder="源字段，如 data.name" fluid
          @update:model-value="patchInteraction(i, { bindings: [{ target: it.bindings[0]?.target ?? '', source: $event as string }] })" />
        <span class="event-row__arrow">→</span>
        <MInput :model-value="it.bindings[0]?.target ?? ''" placeholder="目标参数名" fluid
          @update:model-value="patchInteraction(i, { bindings: [{ target: $event as string, source: it.bindings[0]?.source ?? '' }] })" />
      </div>
    </div>
    </MForm>
    <MButton type="text" size="small" block @click="addInteraction">+ 添加联动</MButton>
  </div>
</template>

<style lang="scss" scoped>
.event-panel {
  display: flex;
  flex-direction: column;

  :deep(.m-form) {
    display: flex;
    flex-direction: column;
    gap: var(--m-space-3, 12px);
  }

  &__section {
    font-size: 12px;
    font-weight: 600;
    color: var(--m-color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 12px 0 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--m-color-split);
  }

  &__hint {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--m-color-text-muted);
  }
}

.event-block {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--m-color-text-muted);

    :deep(.m-button) {
      margin-left: auto;
    }
  }
}

.event-action,
.event-binding {
  display: flex;
  flex-direction: column;
  gap: var(--m-space-2, 8px);
}

.event-action {
  &__head {
    display: flex;
    align-items: center;
    margin: 0;
    color: var(--m-color-text-muted);
    font-size: 12px;

    :deep(.m-button) {
      margin-left: auto;
    }
  }
}

.event-binding {
  > p {
    margin: 0;
    color: var(--m-color-text-muted);
    font-size: 12px;
  }
}

.event-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--m-space-3, 12px);
}

.event-row__arrow {
  color: var(--m-color-text-muted);
}
</style>
