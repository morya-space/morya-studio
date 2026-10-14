<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  summary?: string
  /** 撑满视口高度，配合内部 fill 区块（如全视口表格）使用 */
  fill?: boolean
}>(), {
  fill: false,
})
</script>

<template>
  <div class="workspace-page" :class="{ 'workspace-page--fill': fill }">
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

.workspace-page--fill {
  min-height: 0;
  overflow: hidden;
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
