<script setup lang="ts">
/**
 * 页面列表视图
 * 展示已保存的看板，支持新建/编辑/预览/删除/导出/导入。
 */

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MButton, MCard, MDialog, MEmpty, MInput, message } from 'morya-ui'
import type { PageSchema } from '../types/schema'
import { listPages, deletePage, exportPage, importPage, genPageId } from '../services/page'
import SvgIcon from '../components/common/SvgIcon.vue'

const router = useRouter()
const pages = ref<PageSchema[]>([])

const importVisible = ref(false)
const importJson = ref('')

function refresh() {
  pages.value = listPages()
}

onMounted(refresh)

function onCreate() {
  router.push(`/editor/${genPageId()}`)
}

function onEdit(id: string) {
  router.push(`/editor/${id}`)
}

function onPreview(id: string) {
  router.push(`/preview/${id}`)
}

function onDelete(page: PageSchema) {
  deletePage(page.id)
  refresh()
  message.success(`已删除「${page.title}」`)
}

function onExport(page: PageSchema) {
  const json = exportPage(page.id)
  if (!json) return
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${page.title || page.id}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('已导出')
}

function onImportClick() {
  importJson.value = ''
  importVisible.value = true
}

function onImport() {
  try {
    const page = importPage(importJson.value)
    refresh()
    importVisible.value = false
    message.success(`已导入「${page.title}」`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导入失败')
  }
}

function formatTime(iso?: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="page-list">
    <div class="page-list__header">
      <div>
        <h2 class="page-list__title">我的看板</h2>
        <p class="page-list__subtitle">数据驱动的可视化看板</p>
      </div>
      <div class="page-list__actions">
        <MButton type="default" @click="onImportClick">导入</MButton>
        <MButton type="primary" @click="onCreate">
          <SvgIcon name="plus" :px="14" /> 新建看板
        </MButton>
      </div>
    </div>

    <div v-if="pages.length === 0" class="page-list__empty">
      <MEmpty title="还没有看板" description="点击右上角新建，用拖拽搭建你的第一个数据看板">
        <template #extra>
          <MButton type="primary" @click="onCreate">立即创建</MButton>
        </template>
      </MEmpty>
    </div>

    <div v-else class="page-grid">
      <MCard v-for="page in pages" :key="page.id" class="page-card">
        <div class="page-card__body">
          <h3 class="page-card__title">{{ page.title }}</h3>
          <p class="page-card__meta">
            {{ page.cards.length }} 个卡片 · 更新于 {{ formatTime(page.meta?.updatedAt) }}
          </p>
        </div>
        <div class="page-card__actions">
          <MButton type="primary" size="small" @click="onEdit(page.id)">编辑</MButton>
          <MButton type="default" size="small" @click="onPreview(page.id)">预览</MButton>
          <MButton type="text" size="small" @click="onExport(page)">导出</MButton>
          <MButton type="text" size="small" danger @click="onDelete(page)">删除</MButton>
        </div>
      </MCard>
    </div>

    <MDialog v-model="importVisible" title="导入看板" width="520px">
      <p class="import-tip">粘贴导出的看板 JSON：</p>
      <MInput
        v-model="importJson"
        type="text"
        placeholder='{"id":"...","cards":[...]}'
        fluid
      />
      <template #footer>
        <MButton type="default" @click="importVisible = false">取消</MButton>
        <MButton type="primary" @click="onImport">导入</MButton>
      </template>
    </MDialog>
  </div>
</template>

<style scoped>
.page-list {
  padding: 24px 32px;
  background: var(--m-color-page-bg);
  min-height: 100%;
}

.page-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-list__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.page-list__subtitle {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 4px 0 0;
}

.page-list__actions {
  display: flex;
  gap: 8px;
}

.page-list__empty {
  padding: 60px 0;
}

.page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.page-card__body {
  margin-bottom: 16px;
}

.page-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 6px;
}

.page-card__meta {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.page-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.import-tip {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0 0 12px;
}
</style>
