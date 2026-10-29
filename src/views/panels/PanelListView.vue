<script setup lang="ts">
/**
 * 面板列表（/panels）
 * 可视化面板的增删改查：新建 / 导入 / 编辑 / 预览 / 导出 / 删除 / 存为模板。
 * 具体内容编辑进入面板编辑器（/editor/:id）。
 */

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MCard, MConfirmDialog, MDialog, MDropdown, MEmpty, MInput, MSkeleton, message } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { PageSchema } from '../../types/schema'
import { initPages, listPages, deletePage, exportPage, importPage, genPageId, listVersions, restoreVersion, type PageVersion } from '../../services/page'
import { initTemplates, saveTemplate, pageToTemplate } from '../../services/template'

const router = useRouter()
const { t } = useI18n()
const pages = ref<PageSchema[]>([])
const loading = ref(true)
const loadError = ref('')

const importVisible = ref(false)
const importJson = ref('')
const importing = ref(false)

const tplVisible = ref(false)
const tplName = ref('')
const tplDesc = ref('')
const tplSource = ref<PageSchema | null>(null)
const savingTemplate = ref(false)

const deleteVisible = ref(false)
const deleteTarget = ref<PageSchema | null>(null)
const deleting = ref(false)

// 版本历史
const versionsVisible = ref(false)
const versionsFor = ref<PageSchema | null>(null)
const versions = ref<PageVersion[]>([])
const versionsLoading = ref(false)
const versionsError = ref('')
const restoring = ref(false)

function refresh() {
  pages.value = listPages()
}

async function loadPages(force = false) {
  loading.value = true
  loadError.value = ''
  try {
    // 读面板列表；「存为模板」会写 template 缓存，先确保两者就绪（init 幂等）。
    await Promise.all([initPages(force), initTemplates()])
    refresh()
  } catch (error) {
    loadError.value = errorMessage(error, '加载面板失败，请重试。')
  } finally {
    loading.value = false
  }
}

onMounted(() => loadPages())

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
  deleteTarget.value = page
  deleteVisible.value = true
}

async function confirmDelete(): Promise<boolean> {
  const page = deleteTarget.value
  if (!page) return false
  deleting.value = true
  try {
    await deletePage(page.id)
    refresh()
    deleteVisible.value = false
    deleteTarget.value = null
    message.success(t('panels.deleted', { title: page.title }))
    return true
  } catch (error) {
    message.error(errorMessage(error, '删除面板失败，请重试。'))
    return false
  } finally {
    deleting.value = false
  }
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
async function onImport() {
  importing.value = true
  try {
    const sourceId = getImportedId(importJson.value)
    const page = await importPage(importJson.value)
    refresh()
    importVisible.value = false
    message.success(t('panels.importSuccess', { title: page.title }))
    if (sourceId && sourceId !== page.id) message.info('检测到同名 ID，已作为新面板导入。')
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('panels.importFailed'))
  } finally {
    importing.value = false
  }
}

function onSaveAsTemplate(page: PageSchema) {
  tplSource.value = page
  tplName.value = page.title
  tplDesc.value = ''
  tplVisible.value = true
}
async function confirmSaveTemplate() {
  const page = tplSource.value
  if (!page) return
  savingTemplate.value = true
  try {
    const tpl = pageToTemplate(page, tplName.value.trim() || page.title, tplDesc.value.trim() || undefined)
    await saveTemplate(tpl)
    tplVisible.value = false
    message.success(t('panels.savedAsTemplate', { title: tpl.title }))
  } catch (error) {
    message.error(errorMessage(error, '保存模板失败，请重试。'))
  } finally {
    savingTemplate.value = false
  }
}

async function onVersions(page: PageSchema) {
  versionsFor.value = page
  versionsVisible.value = true
  versionsLoading.value = true
  versionsError.value = ''
  versions.value = []
  try {
    versions.value = await listVersions(page.id)
  } catch (error) {
    versionsError.value = errorMessage(error, '加载版本历史失败，请重试。')
  } finally {
    versionsLoading.value = false
  }
}

async function onRestore(version: PageVersion) {
  if (!versionsFor.value) return
  restoring.value = true
  try {
    await restoreVersion(versionsFor.value.id, version.id)
    versionsVisible.value = false
    refresh()
    message.success(`已回滚到 V${version.version}`)
  } catch (error) {
    message.error(errorMessage(error, '回滚失败，请重试。'))
  } finally {
    restoring.value = false
  }
}

function retryVersions() {
  if (versionsFor.value) onVersions(versionsFor.value)
}

function onCardKeydown(event: KeyboardEvent, page: PageSchema) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onEdit(page.id)
  }
}

function getImportedId(json: string): string | null {
  try {
    const source = JSON.parse(json) as { id?: unknown }
    return typeof source.id === 'string' ? source.id : null
  } catch {
    return null
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function actionItems(page: PageSchema) {
  return [
    { value: 'preview', label: t('panels.preview') },
    { value: 'history', label: '版本历史' },
    { value: 'template', label: t('panels.saveAsTemplate') },
    { value: 'export', label: t('panels.export') },
    { type: 'divider' as const },
    { value: 'delete', label: t('panels.delete') },
  ]
}

function onActionSelect(page: PageSchema, item: { value?: string }) {
  switch (item.value) {
    case 'preview': onPreview(page.id); break
    case 'history': onVersions(page); break
    case 'template': onSaveAsTemplate(page); break
    case 'export': onExport(page); break
    case 'delete': onDelete(page); break
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

      <MEmpty v-else-if="loadError" title="面板加载失败" :description="loadError" class="panels__empty">
        <template #extra>
          <MButton type="default" @click="loadPages(true)">重试</MButton>
        </template>
      </MEmpty>

      <div v-else-if="pages.length === 0" class="panels__empty">
        <MEmpty :title="t('panels.emptyTitle')" :description="t('panels.emptyDesc')">
          <template #extra>
            <MButton type="primary" @click="onCreate">{{ t('panels.createNow') }}</MButton>
          </template>
        </MEmpty>
      </div>

      <div v-else class="panels__grid">
        <MCard v-for="page in pages" :key="page.id" class="panel-card" shadow="hover">
          <div
            class="panel-card__body"
            role="button"
            tabindex="0"
            :aria-label="`编辑面板 ${page.title}`"
            @click="onEdit(page.id)"
            @keydown="onCardKeydown($event, page)"
          >
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
            <MDropdown :items="actionItems(page)" placement="bottom-end" @select="onActionSelect(page, $event)">
              <template #trigger>
                <MButton type="text" size="small" aria-label="更多面板操作">更多</MButton>
              </template>
            </MDropdown>
          </div>
        </MCard>
      </div>
    </div>

    <!-- 导入对话框 -->
    <MDialog v-model="importVisible" :title="t('panels.import')" width="520px">
      <p class="dialog-tip">{{ t('panels.importTip') }}</p>
      <MInput v-model="importJson" type="text" placeholder='{"id":"...","cards":[...]}' fluid />
      <template #footer>
        <MButton type="default" :disabled="importing" @click="importVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" :loading="importing" @click="onImport">{{ t('panels.confirmImport') }}</MButton>
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
        <MButton type="default" :disabled="savingTemplate" @click="tplVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" :loading="savingTemplate" @click="confirmSaveTemplate">{{ t('common.save') }}</MButton>
      </template>
    </MDialog>

    <!-- 版本历史对话框 -->
    <MDialog v-model="versionsVisible" :title="versionsFor ? `版本历史 · ${versionsFor.title}` : '版本历史'" width="560px">
      <div v-if="versionsLoading" class="versions-loading">加载中…</div>
      <MEmpty v-else-if="versionsError" title="版本历史加载失败" :description="versionsError" class="versions-empty">
        <template #extra>
          <MButton type="default" @click="retryVersions">重试</MButton>
        </template>
      </MEmpty>
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

    <MConfirmDialog
      v-model="deleteVisible"
      header="删除面板"
      :message="deleteTarget ? `确定删除「${deleteTarget.title}」吗？该操作不可撤销。` : ''"
      accept-label="删除"
      reject-label="取消"
      accept-color="danger"
      type="warning"
      :loading="deleting"
      :before-accept="confirmDelete"
    />
  </WorkspacePage>
</template>

<style lang="scss" scoped>
.panels {
  display: flex;
  flex-direction: column;
  gap: var(--m-space-6);

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--m-space-2);
  }

  &__empty {
    padding: var(--m-space-6) 0;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--m-space-5);
  }
}

.panel-card {
  display: flex;
  flex-direction: column;

  &__body {
    cursor: pointer;
    border-radius: var(--m-radius-md);
    outline: none;

    &:focus-visible {
      outline: 2px solid var(--m-color-primary);
      outline-offset: 2px;
    }
  }

  &__thumb {
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--m-radius-md);
    background: color-mix(in srgb, var(--m-color-primary) 10%, var(--m-color-surface));
    color: var(--m-color-primary);
    margin-bottom: var(--m-space-3);
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: var(--m-color-text);
    margin: 0 0 var(--m-space-1);
  }

  &__meta {
    font-size: 12px;
    color: var(--m-color-text-muted);
    margin: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--m-space-1);
    margin-top: var(--m-space-3);
    padding-top: var(--m-space-3);
    border-top: 1px solid var(--m-color-split);
  }
}

.dialog-tip {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0 0 var(--m-space-3);
}

.tpl-form {
  display: flex;
  flex-direction: column;
  gap: var(--m-space-2);
}

.tpl-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
  margin-top: var(--m-space-1);
}

.versions-loading {
  padding: var(--m-space-6);
  text-align: center;
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.versions-empty {
  padding: var(--m-space-3) 0;
}

.versions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--m-space-2);
  max-height: 420px;
  overflow: auto;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--m-space-3);
  padding: var(--m-space-2) var(--m-space-3);
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);

  &__info {
    display: flex;
    align-items: center;
    gap: var(--m-space-3);
  }

  &__no {
    font-size: 13px;
    font-weight: 700;
    color: var(--m-color-primary);
  }

  &__time {
    font-size: 13px;
    color: var(--m-color-text);
  }

  &__meta {
    font-size: 12px;
    color: var(--m-color-text-muted);
  }
}
</style>
