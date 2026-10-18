<script setup lang="ts">
/**
 * 面板列表（/panels）
 * 可视化面板的增删改查：新建 / 导入 / 编辑 / 预览 / 导出 / 删除 / 存为模板。
 * 具体内容编辑进入面板编辑器（/editor/:id）。
 */

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MCard, MDialog, MEmpty, MInput, MSkeleton, message, useConfirm } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { PageSchema } from '../../types/schema'
import { initPages, listPages, deletePage, exportPage, importPage, genPageId, listVersions, restoreVersion, type PageVersion } from '../../services/page'
import { initTemplates, saveTemplate, pageToTemplate } from '../../services/template'

const router = useRouter()
const { t } = useI18n()
const confirm = useConfirm()

const pages = ref<PageSchema[]>([])
const loading = ref(true)

const importVisible = ref(false)
const importJson = ref('')

const tplVisible = ref(false)
const tplName = ref('')
const tplDesc = ref('')
const tplSource = ref<PageSchema | null>(null)

// 版本历史
const versionsVisible = ref(false)
const versionsFor = ref<PageSchema | null>(null)
const versions = ref<PageVersion[]>([])
const versionsLoading = ref(false)
const restoring = ref(false)

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

async function onVersions(page: PageSchema) {
  versionsFor.value = page
  versionsVisible.value = true
  versionsLoading.value = true
  versions.value = []
  try {
    versions.value = await listVersions(page.id)
  } finally {
    versionsLoading.value = false
  }
}

async function onRestore(version: PageVersion) {
  if (!versionsFor.value) return
  const ok = await confirm.require({
    header: '回滚版本',
    message: `确定回滚到「V${version.version}」？当前内容将被覆盖（当前版本会保留为一条新历史）。`,
    acceptLabel: '回滚',
    rejectLabel: '取消',
    acceptColor: 'danger',
  })
  if (!ok) return
  restoring.value = true
  try {
    const restored = await restoreVersion(versionsFor.value.id, version.id)
    if (restored) {
      versionsVisible.value = false
      refresh()
      message.success(`已回滚到 V${version.version}`)
    } else {
      message.error('回滚失败')
    }
  } finally {
    restoring.value = false
  }
}

function versionTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
            <MButton type="text" size="small" @click="onVersions(page)">历史</MButton>
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

    <!-- 版本历史对话框 -->
    <MDialog v-model="versionsVisible" :title="versionsFor ? `版本历史 · ${versionsFor.title}` : '版本历史'" class="versions-dialog-host" width="560px">
      <div v-if="versionsLoading" class="versions-loading">加载中…</div>
      <div v-else-if="versions.length === 0" class="versions-empty">
        <MEmpty title="暂无历史版本" description="每次保存面板都会生成一个快照" />
      </div>
      <ul v-else class="versions-list">
        <li v-for="v in versions" :key="v.id" class="version-item">
          <div class="version-item__info">
            <span class="version-item__no">V{{ v.version }}</span>
            <span class="version-item__time">{{ versionTime(v.createdAt) }}</span>
            <span class="version-item__meta">{{ v.schema?.cards?.length ?? 0 }} 个卡片</span>
          </div>
          <MButton type="text" size="small" :loading="restoring" @click="onRestore(v)">回滚</MButton>
        </li>
      </ul>
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

.versions-loading {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.versions-empty {
  padding: 12px 0;
}

.versions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow: auto;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
}

.version-item__info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.version-item__no {
  font-size: 13px;
  font-weight: 700;
  color: var(--m-color-primary);
}

.version-item__time {
  font-size: 13px;
  color: var(--m-color-text);
}

.version-item__meta {
  font-size: 12px;
  color: var(--m-color-text-muted);
}
</style>

<style>
/* 版本历史 560px 被 MDialog 默认 --m-dialog-width(32rem=512px) 截断，列表被挤压；用类限定覆盖变量。 */
.versions-dialog-host .m-dialog {
  --m-dialog-width: min(560px, 94vw);
}
</style>
