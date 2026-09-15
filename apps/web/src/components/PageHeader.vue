<script setup lang="ts">
import { MToolbar } from 'morya-ui'

defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <MToolbar class="page-header" aria-label="页面标题">
    <template #start>
      <div class="page-header__copy">
        <h1>{{ title }}</h1>
        <p v-if="description">
          {{ description }}
        </p>
      </div>
    </template>
    <template v-if="$slots.actions" #end>
      <div class="page-header__actions">
        <slot name="actions" />
      </div>
    </template>
  </MToolbar>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--m-space-4);
}

.page-header__copy {
  min-width: 0;
}

.page-header h1 {
  margin: 0;
  font-size: var(--m-font-size-lg);
  font-weight: 600;
  color: var(--m-color-text);
}

.page-header p {
  margin: var(--m-space-1) 0 0;
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-sm);
  line-height: 1.6;
}

.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--m-space-2);
  align-items: center;
}
</style>
