<script setup lang="ts">
/**
 * 看板预览页
 * 加载指定 id 的页面 Schema 并用 SchemaRenderer 渲染（最终消费形态）。
 */

import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MButton, MEmpty, MLoading } from 'morya-ui'
import SchemaRenderer from '../../engine/SchemaRenderer.vue'
import { useDataStore } from '../../data/store'
import { initPages, getPage } from '../../services/page'
import { initDataSources, listDataSources } from '../../services/datasource'
import type { PageSchema } from '../../types/schema'

const route = useRoute()
const router = useRouter()
const dataStore = useDataStore()

const page = ref<PageSchema | null>(null)
const notFound = ref(false)
const loading = ref(true)

const title = computed(() => page.value?.title ?? '看板')

onMounted(async () => {
  try {
    // 缓存就绪后再取页面与数据源（init 幂等）
    await Promise.all([initPages(), initDataSources()])

    for (const ds of listDataSources()) dataStore.registerDataSource(ds)

    const id = route.params.id as string
    const found = getPage(id)
    if (found) page.value = found
    else notFound.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="preview-view">
    <header v-if="page" class="preview-header">
      <div>
        <h1 class="preview-title">{{ title }}</h1>
        <p class="preview-subtitle">{{ page.cards.length }} 个卡片</p>
      </div>
      <MButton type="default" @click="router.push(`/editor/${page.id}`)">编辑</MButton>
    </header>

    <div v-if="loading" class="preview-loading">
      <MLoading text="加载中…" />
    </div>

    <div v-else-if="notFound" class="preview-notfound">
      <MEmpty title="看板不存在" description="它可能已被删除">
        <template #extra>
          <MButton type="primary" @click="router.push('/pages')">返回列表</MButton>
        </template>
      </MEmpty>
    </div>

    <div v-else-if="page" class="preview-content">
      <SchemaRenderer :page="page" />
    </div>
  </div>
</template>

<style scoped>
.preview-view {
  background: var(--m-color-page-bg);
  height: 100%;
  overflow-y: auto;
  padding: 24px 32px;
}

.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.preview-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.preview-subtitle {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 4px 0 0;
}

.preview-notfound {
  padding: 80px 0;
}
</style>
