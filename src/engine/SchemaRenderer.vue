<script setup lang="ts">
/**
 * SchemaRenderer（v0.2 核心）
 * 把 PageSchema 渲染为卡片组件树。
 * - CSS Grid 布局（grid.cols + gap）
 * - 从 DataStore 订阅数据，分发给各卡片
 * - 统一处理卡片三态（由 CardShell 内部处理）
 * 契约见 docs/DESIGN-DEV.md §7.1
 */

import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { ActionConfig, PageSchema } from '../types/schema'
import { useDataStore } from '../data/store'
import { getCardComponent } from './registry'
import { sortCards, getCardGridStyle, getCardKey } from './utils'

const props = withDefaults(defineProps<{
  page: PageSchema
  /** 编辑态：不自动加载数据（由编辑器控制），且暴露选中事件 */
  editable?: boolean
}>(), {
  editable: false,
})

const emit = defineEmits<{
  (e: 'select-card', id: string): void
  (e: 'card-action', cardId: string, action: ActionConfig): void
  (e: 'ready'): void
}>()

const dataStore = useDataStore()

const cols = computed(() => props.page.grid?.cols ?? 12)
const gap = computed(() => `${props.page.grid?.gap ?? 24}px`)

const sortedCards = computed(() => sortCards(props.page.cards ?? []))

const containerStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
  gap: gap.value,
}))

function resolveComponent(type: string) {
  return getCardComponent(type as never)
}

function cardData(id: string) {
  return dataStore.cardData.get(id) ?? []
}
function cardLoading(id: string) {
  return dataStore.cardLoading.get(id) ?? false
}
function cardError(id: string) {
  return dataStore.cardError.get(id) ?? null
}

async function loadAll() {
  if (props.editable) return
  await dataStore.refreshPage(props.page.cards ?? [])
}

function onCardAction(cardId: string, action: ActionConfig) {
  emit('card-action', cardId, action)
}
function onCardRetry(cardId: string) {
  const card = (props.page.cards ?? []).find(c => c.id === cardId)
  if (card) void dataStore.refreshCard(card)
}
function onSelect(id: string) {
  if (props.editable) emit('select-card', id)
}

onMounted(() => {
  void loadAll().then(() => emit('ready'))
})

// page 变化时重新加载（非编辑态）
watch(() => props.page.id, () => {
  void loadAll()
})

onBeforeUnmount(() => {
  if (!props.editable) dataStore.disposeAll()
})
</script>

<template>
  <div class="schema-renderer" :style="containerStyle">
    <template v-for="card in sortedCards" :key="getCardKey(card)">
      <div
        class="schema-renderer__cell"
        :style="{ ...getCardGridStyle(card, cols), ...(card.height ? { height: `${card.height}px` } : {}) }"
        @click="onSelect(card.id)"
      >
        <component
          :is="resolveComponent(card.type)"
          v-if="resolveComponent(card.type)"
          :schema="card"
          :data="cardData(card.id)"
          :loading="cardLoading(card.id)"
          :error="cardError(card.id)"
          @action="onCardAction(card.id, $event)"
          @retry="onCardRetry(card.id)"
        />
        <div v-else class="schema-renderer__unknown">
          未知卡片类型：{{ card.type }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.schema-renderer {
  width: 100%;
}

.schema-renderer__cell {
  min-width: 0;
}

/* 响应式：窄屏时所有卡片整行 */
@media (max-width: 768px) {
  .schema-renderer__cell {
    grid-column: span 12 !important;
  }
}

.schema-renderer__unknown {
  padding: 24px;
  border-radius: var(--m-radius-lg);
  background: var(--m-color-surface);
  color: var(--m-color-text-muted);
  font-size: 13px;
  text-align: center;
}
</style>
