<script setup lang="ts">
/**
 * 公开只读看板（分享链接消费）
 * 通过 ?token= 读取只读面板，渲染 SchemaRenderer（无编辑入口、无侧栏）。
 * 仅需 /view/:pageId?token=xxx（免登录）。
 */

import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { MButton, MEmpty, MLoading } from 'morya-ui'
import SchemaRenderer from '../../engine/SchemaRenderer.vue'
import { useDataStore } from '../../data/store'
import { getPublicDataSource, getPublicPage } from '../../services/share'
import type { PageSchema } from '../../types/schema'
import SvgIcon from '../../components/common/SvgIcon.vue'

const route = useRoute()
const dataStore = useDataStore()

const page = ref<PageSchema | null>(null)
const title = ref('')
const loading = ref(true)
const error = ref('')

const shareLink = computed(() => window.location.href)

onMounted(async () => {
  const id = route.params.id as string
  const token = route.query.token as string | undefined
  if (!id || !token) {
    error.value = '分享链接缺少参数'
    loading.value = false
    return
  }
  try {
    const { page: p, datasources } = await getPublicPage(id, token)
    const loaded = await Promise.all(datasources.map(async (ds) => {
      const { rows } = await getPublicDataSource(id, ds.id!, token)
      return { ...ds, staticData: rows }
    }))
    for (const ds of loaded) dataStore.registerDataSource(ds)
    page.value = p
    title.value = p.title
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法加载该看板'
  } finally {
    loading.value = false
  }
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareLink.value)
  } catch { /* ignore */ }
}

function goHome() {
  window.location.href = '/'
}
</script>

<template>
  <div class="public-viewer">
    <header class="public-viewer__header">
      <div class="public-viewer__brand">
        <SvgIcon name="grid" :px="18" />
        <span>Morya Studio</span>
      </div>
      <h1 v-if="page" class="public-viewer__title">{{ title }}</h1>
      <div class="public-viewer__spacer" />
      <MButton v-if="page" type="text" size="small" @click="copyLink">复制链接</MButton>
    </header>

    <main class="public-viewer__body">
      <div v-if="loading" class="public-viewer__state">
        <MLoading text="加载中…" />
      </div>
      <div v-else-if="error" class="public-viewer__state">
        <MEmpty :title="error" description="分享链接可能已失效">
          <template #extra>
            <MButton type="primary" @click="goHome">前往首页</MButton>
          </template>
        </MEmpty>
      </div>
      <SchemaRenderer v-else-if="page" :page="page" />
    </main>
  </div>
</template>

<style scoped lang="scss">
.public-viewer {
  min-height: 100%;
  background: var(--m-color-page-bg);

  &__header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid var(--m-color-border);
    background: var(--m-color-surface);
    padding: 0.75rem 1.5rem;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 13px;
    font-weight: 700;
    color: var(--m-color-primary);
  }

  &__title {
    font-size: 1rem;
    line-height: 1.5rem;
    font-weight: 700;
    color: var(--m-color-text);
  }

  &__spacer {
    flex: 1;
  }

  &__body {
    margin-inline: auto;
    max-width: 1400px;
    padding: 1.5rem 2rem;
  }

  &__state {
    display: flex;
    min-height: 60vh;
    align-items: center;
    justify-content: center;
  }
}
</style>
