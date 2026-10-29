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
import type { ActionConfig, BaseEventName, CardSchema, PageSchema } from '../types/schema'
import { useDataStore } from '../data/store'
import { cardUsesData, sortCards, getCardGridStyle, getCardKey } from './utils'
import { parseAction } from './events'
import { resolveInteractionParams, type InteractionPayload } from './interactions'
import CardNode from '../components/cards/CardNode.vue'
import GlobalFilterBar from '../components/common/GlobalFilterBar.vue'
import CanvasWatermark from '../components/common/CanvasWatermark.vue'

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

const sortedCards = computed<CardSchema[]>(() => sortCards(props.page.cards ?? []))

/** 运行时隐藏 status.hide 的卡片（编辑态由编辑器自行处理） */
const visibleCards = computed<CardSchema[]>(() =>
  props.editable ? sortedCards.value : sortedCards.value.filter(c => !c.status?.hide),
)

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
  const style: CSSProperties = {
    position: 'relative',
    width: '100%',
    minWidth: `${c?.width ?? 1200}px`,
    minHeight: `${c?.height ?? 760}px`,
    background: c?.bgColor ?? 'var(--m-color-surface)',
    ...themeVars.value,
  }
  if (c?.backgroundImage) {
    style.backgroundImage = `url(${c.backgroundImage})`
    style.backgroundRepeat = 'no-repeat'
    style.backgroundSize = 'cover'
  }
  const cf = c?.filter
  if (cf) {
    const filters: string[] = []
    if (cf.brightness !== undefined && cf.brightness !== 1) filters.push(`brightness(${cf.brightness})`)
    if (cf.contrast !== undefined && cf.contrast !== 1) filters.push(`contrast(${cf.contrast})`)
    if (cf.saturate !== undefined && cf.saturate !== 1) filters.push(`saturate(${cf.saturate})`)
    if (cf.hueRotate) filters.push(`hue-rotate(${cf.hueRotate}deg)`)
    if (filters.length) style.filter = filters.join(' ')
    if (cf.opacity !== undefined && cf.opacity !== 1) style.opacity = cf.opacity
    if (cf.blendMode && cf.blendMode !== 'normal') style.mixBlendMode = cf.blendMode
  }
  return style
})

const watermarkShow = computed(() => Boolean(props.page.canvas?.watermark?.show))
const watermarkText = computed(() => props.page.canvas?.watermark?.text ?? '')

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
  await dataStore.refreshPage((props.page.cards ?? []).filter(cardUsesData))
}

function onCardAction(cardId: string, action: ActionConfig) {
  runAction(cardId, action)
  emit('card-action', cardId, action)
}

function runAction(cardId: string, action: ActionConfig) {
  const parsed = parseAction(action.action)
  if (!parsed) return
  if (parsed.type === 'refresh') {
    onCardRetry(cardId)
    return
  }
  if (typeof window !== 'undefined') window.location.assign(parsed.url)
}

function onBaseEvent(card: CardSchema, eventName: BaseEventName) {
  if (props.editable) return

  const payload: InteractionPayload = {
    card: { id: card.id, type: card.type },
    data: cardData(card.id)[0] ?? {},
    event: { type: eventName },
  }

  for (const action of card.events?.base?.[eventName] ?? []) runAction(card.id, action)
  for (const interaction of card.events?.interactions ?? []) {
    if (interaction.enabled === false || interaction.on !== eventName) continue
    const target = (props.page.cards ?? []).find(candidate => candidate.id === interaction.targetCardId)
    if (!target) continue
    const params = resolveInteractionParams(interaction.bindings, payload)
    // DataStore supports optional per-refresh params; this does not mutate page filters.
    void dataStore.refreshCard(target, params)
  }
}
function onCardRetry(cardId: string) {
  const card = (props.page.cards ?? []).find(c => c.id === cardId)
  if (card) void dataStore.refreshCard(card)
}
function onSelect(id: string) {
  if (props.editable) emit('select-card', id)
}

function onCardClick(card: CardSchema, event: MouseEvent) {
  onSelect(card.id)
  if ((event.target as Element | null)?.closest('button, a, input, select, textarea, [role="button"]')) return
  onBaseEvent(card, 'click')
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
    <div class="schema-renderer" :data-theme="page.canvas?.theme === 'dark' ? 'dark' : undefined">
      <GlobalFilterBar
        v-if="!editable && page.filters?.length"
        :filters="page.filters"
        @change="onFilterChange"
      />

      <!-- 自由布局：绝对定位 -->
      <div v-if="isFree" class="schema-renderer__free" :style="freeCanvasStyle">
        <template v-for="card in visibleCards" :key="getCardKey(card)">
          <div
            class="schema-renderer__free-cell"
            :style="freeCardStyle(card)"
            @click="onCardClick(card, $event)"
            @dblclick="onBaseEvent(card, 'dblclick')"
            @mouseenter="onBaseEvent(card, 'mouseenter')"
            @mouseleave="onBaseEvent(card, 'mouseleave')"
          >
            <CardNode
              :card="card"
              :data="cardData(card.id)"
              :loading="cardLoading(card.id)"
              :error="cardError(card.id)"
              @action="onCardAction(card.id, $event as ActionConfig)"
              @retry="onCardRetry(card.id)"
            />
          </div>
        </template>

        <!-- 水印 -->
        <CanvasWatermark v-if="watermarkShow" :text="watermarkText" />
      </div>

      <!-- 网格布局 -->
      <div v-else class="schema-renderer__grid" :style="containerStyle">
        <template v-for="card in visibleCards" :key="getCardKey(card)">
          <div
            class="schema-renderer__cell"
            :style="{ ...getCardGridStyle(card, cols), ...(card.height ? { height: `${card.height}px` } : {}) }"
            @click="onCardClick(card, $event)"
            @dblclick="onBaseEvent(card, 'dblclick')"
            @mouseenter="onBaseEvent(card, 'mouseenter')"
            @mouseleave="onBaseEvent(card, 'mouseleave')"
          >
            <CardNode
              :card="card"
              :data="cardData(card.id)"
              :loading="cardLoading(card.id)"
              :error="cardError(card.id)"
              @action="onCardAction(card.id, $event as ActionConfig)"
              @retry="onCardRetry(card.id)"
            />
          </div>
        </template>
      </div>
    </div>
</template>

<style lang="scss" scoped>
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
  overflow: hidden;
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
