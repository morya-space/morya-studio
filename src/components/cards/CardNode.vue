<script setup lang="ts">
/**
 * CardNode（v0.3）
 * 卡片统一渲染节点：把 CardSchema 交给注册表解析出的组件渲染，
 * 并应用 styles（透明度/滤镜/旋转/混合模式）与入场动画。
 * 编辑态（FreeCard / CardWrapper）与运行时（SchemaRenderer）共用，保证一致。
 */

import { computed } from 'vue'
import type { CardSchema } from '../../types/schema'
import { getCardComponent } from '../../engine/registry'
import { cardWrapperStyle } from '../../engine/style'
import { cardAnimationClass } from '../../engine/animations'
import ErrorBoundary from '../../engine/ErrorBoundary.vue'

const props = defineProps<{
  card: CardSchema
  data: Record<string, unknown>[]
  loading: boolean
  error: Error | null
}>()

const emit = defineEmits<{
  (e: 'action', action: unknown): void
  (e: 'retry'): void
}>()

const component = computed(() => getCardComponent(props.card.type))
const wrapperStyle = computed(() => cardWrapperStyle(props.card))
const animClass = computed(() => cardAnimationClass(props.card.styles?.animations))
const contentClass = computed(() => (props.card.preview?.overflowHidden ? 'card-node__inner--clip' : ''))
</script>

<template>
  <div class="card-node" :class="animClass" :style="wrapperStyle">
    <div class="card-node__inner" :class="contentClass">
      <ErrorBoundary>
        <component
          :is="component"
          v-if="component"
          :schema="card"
          :data="data"
          :loading="loading"
          :error="error"
          @action="emit('action', $event)"
          @retry="emit('retry')"
        />
        <div v-else class="card-node__unknown">未知卡片类型：{{ card.type }}</div>
      </ErrorBoundary>
    </div>
  </div>
</template>

<style scoped>
.card-node {
  height: 100%;
}

.card-node__inner {
  height: 100%;
}

.card-node__inner--clip {
  overflow: hidden;
}

.card-node__unknown {
  padding: 24px;
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  color: var(--m-color-text-muted);
  font-size: 13px;
  text-align: center;
}
</style>
