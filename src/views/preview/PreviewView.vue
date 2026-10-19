<script setup lang="ts">
/**
 * 看板全屏预览页（新标签打开）
 * - 优先读取编辑器写入的 draft（?draft=1，未保存也可预览）
 * - 全屏渲染 SchemaRenderer；自由布局按 canvas.scaleType 适配
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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
const isDraft = ref(false)

const title = computed(() => page.value?.title ?? '看板')

// ==================== 大屏预览缩放（canvas.scaleType） ====================
const contentEl = ref<HTMLElement | null>(null)
const fitScale = ref(1)
let ro: ResizeObserver | null = null

const scaleType = computed(() => page.value?.canvas?.scaleType ?? 'fit')
const isFree = computed(() => page.value?.layout === 'free')

function computeFit() {
  const p = page.value
  if (!p || p.layout !== 'free' || scaleType.value !== 'fit') { fitScale.value = 1; return }
  const el = contentEl.value
  if (!el) return
  const cw = p.canvas?.width ?? 1200
  const ch = p.canvas?.height ?? 760
  const availW = el.clientWidth
  const availH = el.clientHeight
  const scale = Math.min(availW / cw, availH / ch)
  fitScale.value = scale > 0 && Number.isFinite(scale) ? Math.min(1, scale) : 1
}

const scaleWrapStyle = computed(() => {
  if (!isFree.value || scaleType.value !== 'fit' || fitScale.value === 1) return {}
  const c = page.value?.canvas
  return {
    transform: `scale(${fitScale.value})`,
    transformOrigin: 'top left',
    width: `${c?.width ?? 1200}px`,
    height: `${c?.height ?? 760}px`,
  }
})

const scaleOuterStyle = computed(() => {
  if (!isFree.value || scaleType.value !== 'fit' || fitScale.value === 1) return {}
  const c = page.value?.canvas
  return {
    width: `${(c?.width ?? 1200) * fitScale.value}px`,
    height: `${(c?.height ?? 760) * fitScale.value}px`,
  }
})

async function loadDraftIfAny(): Promise<PageSchema | null> {
  if (route.query.draft !== '1') return null
  const id = route.params.id as string
  try {
    const raw = localStorage.getItem(`morya:preview:${id}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PageSchema
    isDraft.value = true
    return parsed
  } catch {
    return null
  }
}

async function bootstrap() {
  loading.value = true
  notFound.value = false
  try {
    await Promise.all([initPages(), initDataSources()])
    for (const ds of listDataSources()) dataStore.registerDataSource(ds)

    const id = route.params.id as string
    const draft = await loadDraftIfAny()
    const found = draft ?? getPage(id)
    if (found) page.value = found
    else notFound.value = true

    await nextTick()
    computeFit()
    if (contentEl.value && typeof ResizeObserver !== 'undefined') {
      ro?.disconnect()
      ro = new ResizeObserver(() => computeFit())
      ro.observe(contentEl.value)
    }
  } finally {
    loading.value = false
  }
}

function onEdit() {
  if (!page.value) return
  router.push(`/editor/${page.value.id}`)
}

function onClose() {
  window.close()
  window.setTimeout(() => router.push('/panels'), 120)
}

onMounted(() => { void bootstrap() })

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <div class="preview-view">
    <header v-if="page" class="preview-bar">
      <div class="preview-bar__main">
        <h1 class="preview-bar__title">{{ title }}</h1>
        <span class="preview-bar__meta">
          {{ isDraft ? '草稿（未保存）' : '已保存' }} · {{ page.cards.length }} 个卡片
        </span>
      </div>
      <div class="preview-bar__actions">
        <MButton type="default" size="small" @click="bootstrap">刷新</MButton>
        <MButton v-if="!isDraft" type="default" size="small" @click="onEdit">编辑</MButton>
        <MButton type="primary" size="small" @click="onClose">关闭</MButton>
      </div>
    </header>

    <div v-if="loading" class="preview-center">
      <MLoading text="加载中…" />
    </div>

    <div v-else-if="notFound" class="preview-center">
      <MEmpty title="看板不存在" description="它可能已被删除">
        <template #extra>
          <MButton type="primary" @click="router.push('/panels')">返回列表</MButton>
        </template>
      </MEmpty>
    </div>

    <div v-else-if="page" ref="contentEl" class="preview-stage">
      <div class="preview-inner">
        <div class="preview-fit" :style="scaleOuterStyle">
          <div :style="scaleWrapStyle">
            <SchemaRenderer :page="page" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--m-color-page-bg);
}

.preview-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  background: var(--m-color-surface);
  border-bottom: 1px solid var(--m-color-border);
}

.preview-bar__main {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.preview-bar__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-bar__meta {
  font-size: 12px;
  color: var(--m-color-text-muted);
  white-space: nowrap;
}

.preview-bar__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.preview-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.preview-inner {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.preview-fit {
  flex: none;
}

/* 居中态（无缩放时也水平居中） */
.preview-stage :deep(.schema-renderer) {
  margin: 0 auto;
}
</style>
