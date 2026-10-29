<script setup lang="ts">
/**
 * 自定义卡（custom）—— 逃生舱
 * - 提供 custom.html 时直接渲染（作者自担风险，仅用于受信任内容）
 * - 否则展示 custom.props 的 JSON
 */

import { computed } from 'vue'
import CardShell from './CardShell.vue'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const hasHtml = computed(() => Boolean(props.schema.custom?.html))
const propsJson = computed(() =>
  props.schema.custom?.props ? JSON.stringify(props.schema.custom.props, null, 2) : '',
)
</script>

<template>
  <CardShell
    :title="schema.title"
    :subtitle="schema.subtitle"
    :loading="loading"
    :error="error"
    :empty="!hasHtml && !propsJson"
    :state-text="schema.stateText"
    :actions="schema.actions"
    @retry="emit('retry')"
    @action="emit('action', $event)"
  >
    <div v-if="hasHtml" class="custom-card" v-html="schema.custom?.html" />
    <pre v-else-if="propsJson" class="custom-card__json">{{ propsJson }}</pre>
  </CardShell>
</template>

<style lang="scss" scoped>
.custom-card {
  font-size: 14px;
  line-height: 1.6;
  color: var(--m-color-text);
  word-break: break-word;

  &__json {
    margin: 0;
    padding: 12px;
    border-radius: var(--m-radius-sm);
    background: var(--m-color-fill-light);
    font-family: var(--m-font-mono, monospace);
    font-size: 12px;
    color: var(--m-color-text);
    overflow: auto;
  }
}
</style>
