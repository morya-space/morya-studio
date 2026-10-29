<script setup lang="ts">
/**
 * 渲染错误边界
 * 捕获子组件渲染/生命周期错误，单卡片异常不影响整页（DESIGN-DEV §16 稳定性）。
 */

import { onErrorCaptured, ref } from 'vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  // 阻止错误继续向上传播
  return false
})

function onRetry() {
  error.value = null
}
</script>

<template>
  <div v-if="error" class="error-boundary" role="alert">
    <p class="error-boundary__title">渲染出错</p>
    <code class="error-boundary__msg">{{ error.message }}</code>
    <button class="error-boundary__retry" type="button" @click="onRetry">重试</button>
  </div>
  <slot v-else />
</template>

<style lang="scss" scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border-radius: var(--m-radius-lg);
  background: var(--m-color-surface);
  border: 1px solid var(--m-color-border);
  min-height: 120px;
  text-align: center;
}

.error-boundary__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 0;
}

.error-boundary__msg {
  font-size: 12px;
  color: var(--m-color-text-muted);
  font-family: var(--m-font-mono, monospace);
  word-break: break-all;
  max-width: 100%;
}

.error-boundary__retry {
  margin-top: 4px;
  padding: 4px 16px;
  border: none;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-primary);
  color: var(--m-color-surface);
  font-size: 12px;
  cursor: pointer;
}
</style>
