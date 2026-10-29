<script setup lang="ts">
/**
 * 属性分组（可折叠）
 * 原型对齐：属性面板按「布局/内容/数据/样式/操作」分组，头部可点击折叠。
 */

import { ref } from 'vue'

withDefaults(defineProps<{
  title: string
  defaultOpen?: boolean
}>(), {
  defaultOpen: true,
})

const open = ref(true)
</script>

<template>
  <div class="prop-group" :class="{ collapsed: !open }">
    <button type="button" class="prop-group__head" @click="open = !open">
      <b>{{ title }}</b>
      <i>{{ open ? '▾' : '▸' }}</i>
    </button>
    <div v-show="open" class="prop-group__body">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prop-group {
  border-bottom: 1px solid var(--m-color-split);
  padding: 12px 0 8px;

  &:last-child {
    border-bottom: none;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 4px 0 8px;
    border: none;
    background: transparent;
    cursor: pointer;

    b {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--m-color-text-muted);
    }

    i {
      font-style: normal;
      font-size: 11px;
      color: var(--m-color-text-muted);
      transition: transform 0.15s ease;
    }
  }

  &.collapsed &__head i {
    transform: rotate(-90deg);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 4px;
  }
}

.field-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
