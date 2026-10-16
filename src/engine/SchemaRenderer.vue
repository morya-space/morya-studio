<script setup lang="ts">
/**
 * SchemaRenderer（v0.2 核心）
 * 把 PageSchema 渲染为卡片组件树。
 * - CSS Grid 布局（grid.cols + gap）
 * - 页面级 theme 覆盖（--m-* CSS 变量作用域）
 * - 全局过滤器栏（页面 filters → 数据源 {{var}} 注入）
 * - 单卡片 ErrorBoundary（渲染异常隔离）
 * - 从 DataStore 订阅数据，分发给各卡片
 * 契约见 docs/DESIGN-DEV.md §7.1
 */

import { computed, onBeforeUnmount, onMounted, watch, type CSSProperties } from 'vue'
import type { ActionConfig, PageSchema } from '../types/schema'
import { useDataStore } from '../data/store'
import { getCardComponent } from './registry'
import { sortCards, getCardGridStyle, getCardKey } from './utils'
import ErrorBoundary from './ErrorBoundary.vue'
import GlobalFilterBar from '../components/common/GlobalFilterBar.vue'

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

const isFree = computed(() => props.page.layout === 'free')

const cols = computed(() => props.page.grid?.cols ?? 12)
const gap = computed(() => `${props.page.grid?.gap ?? 24}px`)

const sortedCards = computed(() => sortCards(props.page.cards ?? []))

/** 页面级主题覆盖：作用域到渲染容器 */
const themeVars = computed<Record<string, string>>(() => {
  const t = props.page.theme
  if (!t) return {}
  const out: Record<string, string> = {}
  if (t.primaryColor) out['--m-color-primary'] = t.primaryColor
  if (t.cardRadius) out['--m-radius-lg'] = `${t.cardRadius}px`
  if (t.cardShadow) out['--m-shadow-card'] = t.cardShadow
  return out
})

const containerStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
  gap: gap.value,
  ...themeVars.value,
}))

/** 自由布局：固定画布容器 + 绝对定位卡片；背景/尺寸来自 page.canvas */
const freeCanvasStyle = computed<CSSProperties>(() => {
  const c = props.page.canvas
  return {
    position: 'relative',
    width: '100%',
    minWidth: `${c?.width ?? 1200}px`,
    minHeight: `${c?.height ?? 760}px`,
    background: c?.bgColor ?? 'var(--m-color-surface)',
    ...themeVars.value,
  }
})

function freeCardStyle(card: PageSchema['cards'][number]) {
  return {
    position: 'absolute' as const,
    left: `${card.x ?? 0}px`,
    top: `${card.y ?? 0}px`,
    width: `${card.w ?? 320}px`,
    height: `${card.h ?? 200}px`,
    zIndex: card.order ?? 0,
  }
}

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

async function loadAll(params?: Record<string, unknown>) {
  if (props.editable) return
  if (params) dataStore.setGlobalParams(params)
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

function onFilterChange(params: Record<string, unknown>) {
  void loadAll(params)
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
    <div class="schema-renderer">
      <GlobalFilterBar
        v-if="!editable && page.filters?.length"
        :filters="page.filters"
        @change="onFilterChange"
      />

      <!-- 自由布局：绝对定位 -->
      <div v-if="isFree" class="schema-renderer__free" :style="freeCanvasStyle">
        <template v-for="card in sortedCards" :key="getCardKey(card)">
          <div
            class="schema-renderer__free-cell"
            :style="freeCardStyle(card)"
            @click="onSelect(card.id)"
          >
            <ErrorBoundary>
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
            </ErrorBoundary>
          </div>
        </template>
      </div>

      <!-- 网格布局 -->
      <div v-else class="schema-renderer__grid" :style="containerStyle">
        <template v-for="card in sortedCards" :key="getCardKey(card)">
          <div
            class="schema-renderer__cell"
            :style="{ ...getCardGridStyle(card, cols), ...(card.height ? { height: `${card.height}px` } : {}) }"
            @click="onSelect(card.id)"
          >
            <ErrorBoundary>
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
            </ErrorBoundary>
          </div>
        </template>
      </div>
    </div>
</template>

<style scoped>
.schema-renderer {
  width: 100%;
}

.schema-renderer__grid {
  width: 100%;
}

.schema-renderer__cell {
  min-width: 0;
}

.schema-renderer__free {
  width: 100%;
}

.schema-renderer__free-cell {
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
