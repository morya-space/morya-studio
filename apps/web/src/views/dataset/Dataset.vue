<script setup lang="ts">
import { MCard, MIcon } from 'morya-ui'
import PageHeader from '../../components/PageHeader.vue'
</script>

<template>
  <section class="page-section">
    <PageHeader title="数据集" description="该页面由你自定义实现，当前仅保留入口与权限校验。" />
    <MCard>
      <div class="placeholder">
        <MIcon name="database" size="lg" />
        <h2>数据集待扩展</h2>
        <p>这里预留数据集入口。数据源、查询和建模可以在后续独立开发。</p>
      </div>
    </MCard>
  </section>
</template>

<style scoped>
.page-section {
  display: grid;
  gap: var(--m-space-4);
  align-content: start;
}

.placeholder {
  display: grid;
  justify-items: start;
  gap: var(--m-space-3);
  padding: var(--m-space-2) 0;
}

.placeholder h2 {
  margin: 0;
  font-size: var(--m-font-size-md);
  font-weight: 600;
  color: var(--m-color-text);
}

.placeholder p {
  margin: 0;
  max-width: 42rem;
  color: var(--m-color-text-muted);
  line-height: 1.7;
  font-size: var(--m-font-size-sm);
}
</style>
