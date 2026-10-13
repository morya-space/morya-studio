<script setup lang="ts">
/**
 * 卡片通用外壳（v0.2）
 * 统一渲染卡片头（title/subtitle/actions）+ 三态（loading / empty / error）。
 * 内容区用默认插槽，由各卡片组件填充。
 * 视觉规范：docs/DESIGN-DEV.md §12.6（白底、20px 圆角、极轻阴影）。
 */

import { computed } from 'vue'
import { MCard, MEmpty, MButton } from 'morya-ui'
import type { ActionConfig, CardStateText } from '../../types/schema'

const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  loading?: boolean
  error?: Error | null
  /** 是否空数据（数据已加载但为空） */
  empty?: boolean
  stateText?: CardStateText
  actions?: ActionConfig[]
  /** 是否显示卡片头（默认有标题/副标题/操作时才显示） */
  showHeader?: boolean
}>(), {
  loading: false,
  empty: false,
})

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'action', action: ActionConfig): void
}>()

const hasHeader = computed(() =>
  props.showHeader ?? Boolean(props.title || props.subtitle || (props.actions && props.actions.length > 0)),
)

const loadingText = computed(() => props.stateText?.loading ?? '加载中…')
const emptyText = computed(() => props.stateText?.empty ?? '暂无数据')
const errorText = computed(() => props.stateText?.error ?? props.error?.message ?? '加载失败')

function onAction(action: ActionConfig) {
  emit('action', action)
}
</script>

<template>
  <MCard
    class="card-shell"
    :bordered="false"
    shadow="always"
    :title="undefined"
  >
    <template v-if="hasHeader" #header>
      <div class="card-shell__header">
        <div class="card-shell__heading">
          <h3 v-if="title" class="card-shell__title">{{ title }}</h3>
          <p v-if="subtitle" class="card-shell__subtitle">{{ subtitle }}</p>
        </div>
        <div v-if="actions && actions.length" class="card-shell__actions">
          <MButton
            v-for="(act, i) in actions"
            :key="i"
            :type="act.type === 'primary' ? 'primary' : 'default'"
            size="small"
            @click="onAction(act)"
          >
            {{ act.label }}
          </MButton>
        </div>
      </div>
    </template>

    <!-- loading -->
    <div v-if="loading" class="card-shell__state" role="status" aria-live="polite">
      <div class="card-shell__skeleton">
        <div class="skeleton-line w-60" />
        <div class="skeleton-line w-40" />
        <div class="skeleton-block" />
      </div>
      <span class="card-shell__state-text">{{ loadingText }}</span>
    </div>

    <!-- error -->
    <div v-else-if="error" class="card-shell__state" role="alert">
      <MEmpty :title="errorText" :show-icon="true">
        <template #extra>
          <MButton type="primary" size="small" @click="emit('retry')">重试</MButton>
        </template>
      </MEmpty>
    </div>

    <!-- empty -->
    <div v-else-if="empty" class="card-shell__state">
      <MEmpty :title="emptyText" />
    </div>

    <!-- content -->
    <div v-else class="card-shell__body">
      <slot />
    </div>
  </MCard>
</template>

<style scoped>
.card-shell {
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  background: var(--m-color-surface);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-shell :deep(.m-card__header) {
  padding: 20px 24px 0;
  border-bottom: none;
}

.card-shell :deep(.m-card__body) {
  padding: 16px 24px 24px;
  flex: 1;
  min-height: 0;
}

.card-shell__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.card-shell__heading {
  min-width: 0;
}

.card-shell__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.card-shell__subtitle {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 4px 0 0;
}

.card-shell__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.card-shell__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 0;
  min-height: 120px;
}

.card-shell__state-text {
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.card-shell__body {
  min-width: 0;
}

/* 骨架屏 */
.card-shell__skeleton {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line,
.skeleton-block {
  border-radius: var(--m-radius-sm);
  background: var(--m-color-split);
  animation: card-shell-pulse 1.4s ease-in-out infinite;
}

.skeleton-line {
  height: 14px;
}

.skeleton-line.w-60 { width: 60%; }
.skeleton-line.w-40 { width: 40%; }

.skeleton-block {
  height: 64px;
  width: 100%;
}

@keyframes card-shell-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
