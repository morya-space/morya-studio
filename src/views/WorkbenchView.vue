<script setup lang="ts">
/**
 * 工作台（/）
 * 数据可视化平台的主入口：问候 + 统计 + 新建 + 最近看板。
 * 复用 page/datasource 服务，卡片式看板管理。
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MCard, MDialog, MEmpty, MInput, message } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import SvgIcon from '../components/common/SvgIcon.vue'
import type { PageSchema } from '../types/schema'
import { listPages, deletePage, exportPage, importPage, genPageId } from '../services/page'
import { listDataSources } from '../services/datasource'
import { getAllCardTypes } from '../engine/registry'

const router = useRouter()
const { t } = useI18n()

const pages = ref<PageSchema[]>([])
const dsCount = ref(0)
const cardTypeCount = getAllCardTypes().length

const importVisible = ref(false)
const importJson = ref('')

const stats = computed(() => [
  { label: t('workbench.boardCount'), value: pages.value.length, icon: 'grid' },
  { label: t('workbench.dsCount'), value: dsCount.value, icon: 'wallet' },
  { label: t('workbench.cardTypes'), value: cardTypeCount, icon: 'layers' },
])

function refresh() {
  pages.value = listPages()
  dsCount.value = listDataSources().length
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
  message.success(t('workbench.deleted', { title: page.title }))
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
  message.success(t('workbench.exported'))
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
    message.success(t('workbench.importSuccess', { title: page.title }))
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('workbench.importFailed'))
  }
}

function formatTime(iso?: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <WorkspacePage :title="t('workbench.greeting')" :summary="t('workbench.summary')">
    <div class="workbench">
      <!-- 顶部操作 -->
      <div class="workbench-actions">
        <MButton type="default" @click="onImportClick">{{ t('workbench.import') }}</MButton>
        <MButton type="primary" @click="onCreate">
          <SvgIcon name="plus" :px="14" /> {{ t('workbench.newBoard') }}
        </MButton>
      </div>

      <!-- 统计条 -->
      <div class="stat-row">
        <div v-for="s in stats" :key="s.label" class="stat-chip">
          <span class="stat-chip__icon"><SvgIcon :name="s.icon" :px="18" /></span>
          <div class="stat-chip__meta">
            <span class="stat-chip__value">{{ s.value }}</span>
            <span class="stat-chip__label">{{ s.label }}</span>
          </div>
        </div>
      </div>

      <!-- 最近看板 -->
      <section class="boards">
        <div class="boards__head">
          <h3 class="boards__title">{{ t('workbench.recentBoards') }}</h3>
        </div>

        <div v-if="pages.length === 0" class="boards__empty">
          <MEmpty :title="t('workbench.emptyTitle')" :description="t('workbench.emptyDesc')">
            <template #extra>
              <MButton type="primary" @click="onCreate">{{ t('workbench.createNow') }}</MButton>
            </template>
          </MEmpty>
        </div>

        <div v-else class="boards__grid">
          <MCard v-for="page in pages" :key="page.id" class="board-card" shadow="hover">
            <div class="board-card__body" @click="onEdit(page.id)">
              <div class="board-card__thumb">
                <SvgIcon name="layout" :px="26" />
              </div>
              <h4 class="board-card__title">{{ page.title }}</h4>
              <p class="board-card__meta">
                {{ t('workbench.cardCount', { n: page.cards.length }) }} · {{ formatTime(page.meta?.updatedAt) }}
              </p>
            </div>
            <div class="board-card__actions">
              <MButton type="text" size="small" @click="onEdit(page.id)">{{ t('workbench.edit') }}</MButton>
              <MButton type="text" size="small" @click="onPreview(page.id)">{{ t('workbench.preview') }}</MButton>
              <MButton type="text" size="small" @click="onExport(page)">{{ t('workbench.export') }}</MButton>
              <MButton type="text" size="small" danger @click="onDelete(page)">{{ t('workbench.delete') }}</MButton>
            </div>
          </MCard>
        </div>
      </section>
    </div>

    <!-- 导入对话框 -->
    <MDialog v-model="importVisible" :title="t('workbench.import')" width="520px">
      <p class="import-tip">{{ t('workbench.importTip') }}</p>
      <MInput v-model="importJson" type="text" placeholder='{"id":"...","cards":[...]}' fluid />
      <template #footer>
        <MButton type="default" @click="importVisible = false">{{ t('workbench.cancel') }}</MButton>
        <MButton type="primary" @click="onImport">{{ t('workbench.confirmImport') }}</MButton>
      </template>
    </MDialog>
  </WorkspacePage>
</template>

<style scoped>
.workbench {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.workbench-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 统计条 */
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
}

.stat-chip__icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-md);
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
  flex-shrink: 0;
}

.stat-chip__value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--m-color-text);
  line-height: 1.2;
}

.stat-chip__label {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

/* 看板网格 */
.boards__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.boards__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.boards__empty {
  padding: 40px 0;
}

.boards__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.board-card {
  display: flex;
  flex-direction: column;
}

.board-card__body {
  cursor: pointer;
}

.board-card__thumb {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-md);
  background: linear-gradient(135deg, color-mix(in srgb, var(--m-color-primary) 12%, transparent), color-mix(in srgb, var(--m-color-accent-blue) 12%, transparent));
  color: var(--m-color-primary);
  margin-bottom: 14px;
}

.board-card__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 4px;
}

.board-card__meta {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.board-card__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--m-color-split);
}

.import-tip {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0 0 12px;
}

@media (max-width: 900px) {
  .stat-row {
    grid-template-columns: 1fr;
  }
}
</style>
