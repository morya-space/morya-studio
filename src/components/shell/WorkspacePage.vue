<script setup lang="ts">
defineProps<{
  title: string
  summary?: string
}>()
</script>

<template>
  <div class="workspace-page">
    <header class="workspace-page__header">
      <div>
        <h1>{{ title }}</h1>
        <p v-if="summary">{{ summary }}</p>
      </div>
    </header>
    <slot />
  </div>
</template>

<style scoped>
.workspace-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 32px;
  background: var(--m-color-page-bg);
  min-height: 100%;
}

.workspace-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.workspace-page__header h1 {
  margin: 0 0 4px;
  font-size: 26px;
  font-weight: 700;
  color: var(--m-color-text);
}

.workspace-page__header p {
  margin: 0;
  max-width: 36rem;
  color: var(--m-color-text-muted);
  font-size: 14px;
  line-height: 1.5;
}
</style>
