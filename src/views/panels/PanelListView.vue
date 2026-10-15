<script setup lang="ts">
/**
 * 面板列表（/panels）
 * 可视化面板的增删改查：新建 / 导入 / 编辑 / 预览 / 导出 / 删除 / 存为模板。
 * 具体内容编辑进入面板编辑器（/editor/:id）。
 */

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MCard, MDialog, MEmpty, MInput, MSkeleton, message } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { PageSchema } from '../../types/schema'
import { initPages, listPages, deletePage, exportPage, importPage, genPageId } from '../../services/page'
import { initTemplates, saveTemplate, pageToTemplate } from '../../services/template'

const router = useRouter()
const { t } = useI18n()

const pages = ref<PageSchema[]>([])
const loading = ref(true)

const importVisible = ref(false)
const importJson = ref('')

const tplVisible = ref(false)
const tplName = ref('')
const tplDesc = ref('')
const tplSource = ref<PageSchema | null>(null)

function refresh() {
  pages.value = listPages()
}

onMounted(async () => {
  try {
    // 读面板列表；「存为模板」会写 template 缓存，先确保两者就绪（init 幂等）
    await Promise.all([initPages(), initTemplates()])
    refresh()
  } finally {
    loading.value = false
  }
})

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
  message.success(t('panels.deleted', { title: page.title }))
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
  message.success(t('panels.exported'))
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
    message.success(t('panels.importSuccess', { title: page.title }))
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('panels.importFailed'))
  }
}

function onSaveAsTemplate(page: PageSchema) {
  tplSource.value = page
  tplName.value = page.title
  tplDesc.value = ''
  tplVisible.value = true
}
function confirmSaveTemplate() {
  const page = tplSource.value
  if (!page) return
  const tpl = pageToTemplate(page, tplName.value.trim() || page.title, tplDesc.value.trim() || undefined)
  saveTemplate(tpl)
  tplVisible.value = false
  message.success(t('panels.savedAsTemplate', { title: tpl.title }))
}

function formatTime(iso?: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <WorkspacePage :title="t('pages.panels.title')" :summary="t('pages.panels.summary')">
    <div class="panels">
      <div class="panels__actions">
        <MButton type="default" @click="onImportClick">{{ t('panels.import') }}</MButton>
        <MButton type="primary" @click="onCreate">
          <SvgIcon name="plus" :px="14" /> {{ t('panels.newPanel') }}
        </MButton>
      </div>

      <div v-if="loading" class="panels__grid">
        <MSkeleton v-for="i in 6" :key="i" height="190px" border-radius="var(--m-radius-lg)" />
      </div>

      <div v-else-if="pages.length === 0" class="panels__empty">
        <MEmpty :title="t('panels.emptyTitle')" :description="t('panels.emptyDesc')">
          <template #extra>
            <MButton type="primary" @click="onCreate">{{ t('panels.createNow') }}</MButton>
          </template>
        </MEmpty>
      </div>

      <div v-else class="panels__grid">
        <MCard v-for="page in pages" :key="page.id" class="panel-card" shadow="hover">
          <div class="panel-card__body" @click="onEdit(page.id)">
            <div class="panel-card__thumb">
              <SvgIcon name="layout" :px="26" />
            </div>
            <h4 class="panel-card__title">{{ page.title }}</h4>
            <p class="panel-card__meta">
              {{ t('panels.cardCount', { n: page.cards.length }) }} · {{ formatTime(page.meta?.updatedAt) }}
            </p>
          </div>
          <div class="panel-card__actions">
            <MButton type="text" size="small" @click="onEdit(page.id)">{{ t('panels.edit') }}</MButton>
            <MButton type="text" size="small" @click="onPreview(page.id)">{{ t('panels.preview') }}</MButton>
            <MButton type="text" size="small" @click="onSaveAsTemplate(page)">{{ t('panels.saveAsTemplate') }}</MButton>
            <MButton type="text" size="small" @click="onExport(page)">{{ t('panels.export') }}</MButton>
            <MButton type="text" size="small" danger @click="onDelete(page)">{{ t('panels.delete') }}</MButton>
          </div>
        </MCard>
      </div>
    </div>

    <!-- 导入对话框 -->
    <MDialog v-model="importVisible" :title="t('panels.import')" width="520px">
      <p class="dialog-tip">{{ t('panels.importTip') }}</p>
      <MInput v-model="importJson" type="text" placeholder='{"id":"...","cards":[...]}' fluid />
      <template #footer>
        <MButton type="default" @click="importVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" @click="onImport">{{ t('panels.confirmImport') }}</MButton>
      </template>
    </MDialog>

    <!-- 存为模板对话框 -->
    <MDialog v-model="tplVisible" :title="t('panels.saveAsTemplate')" width="480px">
      <div class="tpl-form">
        <label class="tpl-label">{{ t('panels.templateName') }}</label>
        <MInput v-model="tplName" fluid />
        <label class="tpl-label">{{ t('panels.templateDesc') }}</label>
        <MInput v-model="tplDesc" fluid />
      </div>
      <template #footer>
        <MButton type="default" @click="tplVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" @click="confirmSaveTemplate">{{ t('common.save') }}</MButton>
      </template>
    </MDialog>
  </WorkspacePage>
</template>

<style scoped>
.panels {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panels__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.panels__empty {
  padding: 40px 0;
}

.panels__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.panel-card {
  display: flex;
  flex-direction: column;
}

.panel-card__body {
  cursor: pointer;
}

.panel-card__thumb {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-md);
  background: linear-gradient(135deg, color-mix(in srgb, var(--m-color-primary) 12%, transparent), color-mix(in srgb, var(--m-color-accent-blue) 12%, transparent));
  color: var(--m-color-primary);
  margin-bottom: 14px;
}

.panel-card__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 4px;
}

.panel-card__meta {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.panel-card__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--m-color-split);
}

.dialog-tip {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0 0 12px;
}

.tpl-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tpl-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
  margin-top: 4px;
}
</style>
