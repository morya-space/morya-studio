<script setup lang="ts">
/**
 * 分析（/analytics）
 * 用 SchemaRenderer 实时渲染示例分析看板，展示引擎能力。
 * 提供"在编辑器中打开"入口（示例看板会存入本地，可在编辑器修改）。
 */

import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import SchemaRenderer from '../engine/SchemaRenderer.vue'
import { useDataStore } from '../data/store'
import { buildDemoPage, demoDataSources, DEMO_PAGE_ID } from '../data/demoBoard'
import { savePage, getPage } from '../services/page'
import { saveDataSource, getDataSource } from '../services/datasource'
import type { PageSchema } from '../types/schema'

const { t } = useI18n()
const router = useRouter()
const dataStore = useDataStore()

const page = ref<PageSchema>(buildDemoPage())

onMounted(() => {
  // 注册示例数据源（内存态即可渲染）
  for (const ds of demoDataSources) dataStore.registerDataSource(ds)
})

function openInEditor() {
  // 把示例看板 + 数据源持久化，然后在编辑器打开
  if (!getPage(DEMO_PAGE_ID)) savePage(buildDemoPage())
  for (const ds of demoDataSources) {
    if (!getDataSource(ds.id!)) saveDataSource(ds)
  }
  router.push(`/editor/${DEMO_PAGE_ID}`)
}
</script>

<template>
  <WorkspacePage :title="t('pages.analytics.title')" :summary="t('pages.analytics.summary')">
    <div class="analytics">
      <div class="analytics__bar">
        <p class="analytics__tip">{{ t('analytics.tip') }}</p>
        <MButton type="primary" @click="openInEditor">{{ t('analytics.openEditor') }}</MButton>
      </div>
      <SchemaRenderer :page="page" />
    </div>
  </WorkspacePage>
</template>

<style scoped>
.analytics {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.analytics__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.analytics__tip {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}
</style>
