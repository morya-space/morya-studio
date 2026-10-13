<script setup lang="ts">
/**
 * 数据源管理（/monitor）
 * 列出全部数据源，支持测试连通性、编辑、删除、新建。
 * 复用编辑器的数据源对话框逻辑（独立视图版）。
 */

import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MDialog, MEmpty, MForm, MFormItem, MInput, MInputNumber, MSelect, MTag, MTextarea, message } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import SvgIcon from '../components/common/SvgIcon.vue'
import type { DataSourceConfig, DataSourceType } from '../types/schema'
import { listDataSources, saveDataSource, deleteDataSource, genDataSourceId } from '../services/datasource'
import { getAdapter } from '../data/adapters'
import { useDataStore } from '../data/store'

const { t } = useI18n()
const router = useRouter()
const dataStore = useDataStore()

const sources = ref<DataSourceConfig[]>([])
const testingId = ref<string | null>(null)

const dialogVisible = ref(false)
const editing = ref<DataSourceConfig | null>(null)
const staticDataText = ref('[]')
const dialogTesting = ref(false)

const TYPE_OPTIONS = computed(() => [
  { label: t('monitor.static'), value: 'static' },
  { label: t('monitor.api'), value: 'api' },
  { label: t('monitor.mock'), value: 'mock' },
])
const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
]

function refresh() {
  sources.value = listDataSources()
}

onMounted(refresh)

function typeLabel(type: DataSourceType): string {
  return t(`monitor.${type}`)
}

function detailOf(ds: DataSourceConfig): string {
  if (ds.type === 'api') return ds.url ?? '-'
  return t('monitor.rows', { n: ds.staticData?.length ?? 0 })
}

async function onTest(ds: DataSourceConfig) {
  testingId.value = ds.id ?? null
  try {
    const adapter = getAdapter(ds.type)
    const result = adapter.test ? await adapter.test(ds) : { ok: true, message: 'OK' }
    if (result.ok) message.success(t('monitor.testOk', { msg: result.message ?? '' }))
    else message.error(t('monitor.testFail', { msg: result.message ?? '' }))
  } catch (e) {
    message.error(t('monitor.testFail', { msg: e instanceof Error ? e.message : '' }))
  } finally {
    testingId.value = null
  }
}

function onAdd() {
  editing.value = { id: genDataSourceId(), name: '', type: 'static', staticData: [] }
  staticDataText.value = '[]'
  dialogVisible.value = true
}

function onEdit(ds: DataSourceConfig) {
  editing.value = { ...ds }
  staticDataText.value = JSON.stringify(ds.staticData ?? [], null, 2)
  dialogVisible.value = true
}

function onDelete(ds: DataSourceConfig) {
  if (!ds.id) return
  deleteDataSource(ds.id)
  dataStore.unregisterDataSource(ds.id)
  refresh()
  message.success(t('monitor.deleted'))
}

function onSave() {
  const ds = editing.value
  if (!ds) return
  if (!ds.name?.trim()) { message.warning(t('monitor.name')); return }
  if (ds.type === 'api' && !ds.url?.trim()) { message.warning('URL'); return }
  if (ds.type === 'static' || ds.type === 'mock') {
    try {
      ds.staticData = JSON.parse(staticDataText.value || '[]')
      if (!Array.isArray(ds.staticData)) throw new Error('not array')
    } catch {
      message.warning('JSON')
      return
    }
  }
  saveDataSource(ds)
  dataStore.registerDataSource(ds)
  dialogVisible.value = false
  refresh()
}

async function onDialogTest() {
  const ds = editing.value
  if (!ds) return
  dialogTesting.value = true
  try {
    const adapter = getAdapter(ds.type)
    const result = adapter.test ? await adapter.test(ds) : { ok: true, message: 'OK' }
    if (result.ok) message.success(t('monitor.testOk', { msg: result.message ?? '' }))
    else message.error(t('monitor.testFail', { msg: result.message ?? '' }))
  } finally {
    dialogTesting.value = false
  }
}

function goBoards() {
  router.push('/')
}
</script>

<template>
  <WorkspacePage :title="t('pages.monitor.title')" :summary="t('pages.monitor.summary')">
    <div class="monitor">
      <div class="monitor__head">
        <MButton type="primary" @click="onAdd">
          <SvgIcon name="plus" :px="14" /> {{ t('monitor.newDs') }}
        </MButton>
      </div>

      <div v-if="sources.length === 0" class="monitor__empty">
        <MEmpty :title="t('monitor.empty')">
          <template #extra>
            <MButton type="primary" @click="onAdd">{{ t('monitor.newDs') }}</MButton>
          </template>
        </MEmpty>
      </div>

      <div v-else class="monitor__table">
        <div class="monitor__row monitor__row--head">
          <span class="col-name">{{ t('monitor.name') }}</span>
          <span class="col-type">{{ t('monitor.type') }}</span>
          <span class="col-detail">{{ t('monitor.detail') }}</span>
          <span class="col-actions" />
        </div>
        <div v-for="ds in sources" :key="ds.id" class="monitor__row">
          <span class="col-name">
            <span class="ds-name">{{ ds.name }}</span>
            <span class="ds-id">{{ ds.id }}</span>
          </span>
          <span class="col-type"><MTag>{{ typeLabel(ds.type) }}</MTag></span>
          <span class="col-detail">{{ detailOf(ds) }}</span>
          <span class="col-actions">
            <MButton type="text" size="small" :loading="testingId === ds.id" @click="onTest(ds)">{{ t('monitor.test') }}</MButton>
            <MButton type="text" size="small" @click="onEdit(ds)">{{ t('monitor.edit') }}</MButton>
            <MButton type="text" size="small" danger @click="onDelete(ds)">{{ t('monitor.delete') }}</MButton>
          </span>
        </div>
      </div>
    </div>

    <!-- 新建/编辑对话框 -->
    <MDialog v-model="dialogVisible" :title="t('monitor.newDs')" width="480px">
      <MForm v-if="editing" :model="editing">
        <MFormItem :label="t('monitor.name')" required>
          <MInput v-model="editing.name" fluid />
        </MFormItem>
        <MFormItem :label="t('monitor.type')" required>
          <MSelect v-model="editing.type" :options="TYPE_OPTIONS" fluid />
        </MFormItem>

        <template v-if="editing.type === 'api'">
          <MFormItem label="URL" required>
            <MInput v-model="editing.url" placeholder="https://api.example.com/data" fluid />
          </MFormItem>
          <MFormItem label="Method">
            <MSelect v-model="editing.method" :options="METHOD_OPTIONS" fluid />
          </MFormItem>
          <MFormItem label="dataPath">
            <MInput v-model="editing.dataPath" placeholder="data.list" fluid />
          </MFormItem>
          <MFormItem label="pollInterval(ms)">
            <MInputNumber v-model="editing.pollInterval" :min="0" fluid />
          </MFormItem>
        </template>

        <template v-else-if="editing.type === 'static' || editing.type === 'mock'">
          <MFormItem label="Data (JSON)" required>
            <MTextarea v-model="staticDataText" :rows="8" fluid placeholder='[{"x":"1月","y":100}]' />
          </MFormItem>
        </template>
      </MForm>
      <template #footer>
        <MButton type="default" :loading="dialogTesting" @click="onDialogTest">{{ t('monitor.test') }}</MButton>
        <MButton type="default" @click="dialogVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" @click="onSave">{{ t('common.save') }}</MButton>
      </template>
    </MDialog>
  </WorkspacePage>
</template>

<style scoped>
.monitor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.monitor__head {
  display: flex;
  justify-content: flex-end;
}

.monitor__empty {
  padding: 40px 0;
}

.monitor__table {
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  overflow: hidden;
}

.monitor__row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr 1.6fr;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--m-color-split);
}

.monitor__row:last-child {
  border-bottom: none;
}

.monitor__row--head {
  background: var(--m-color-page-bg);
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.col-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ds-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
}

.ds-id {
  font-size: 11px;
  color: var(--m-color-text-muted);
  font-family: var(--m-font-mono, monospace);
}

.col-detail {
  font-size: 13px;
  color: var(--m-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}
</style>
