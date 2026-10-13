<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import WorkspacePage from '../components/shell/WorkspacePage.vue'

const route = useRoute()
const { t } = useI18n()

const pageKey = computed(() => String(route.name ?? ''))
const title = computed(() => t(`pages.${pageKey.value}.title`))
const summary = computed(() => t(`pages.${pageKey.value}.summary`))
</script>

<template>
  <WorkspacePage :title="title" :summary="summary">
    <section class="placeholder-card">
      <p>{{ t('pages.placeholder') }}</p>
    </section>
  </WorkspacePage>
</template>

<style scoped>
.placeholder-card {
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  padding: 28px;
  box-shadow: var(--m-shadow-card);
}

.placeholder-card p {
  margin: 0;
  color: var(--m-color-text-muted);
  font-size: 14px;
}
</style>
