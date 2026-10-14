<script setup lang="ts">
/**
 * 数据源管理（/datasources）
 * 数据的存储与展示：列出全部数据源，支持测试连通性、编辑、删除、新建。
 * 也可通过连接器（/connectors）从文件 / 数据库导入。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MDialog, MEmpty, MForm, MFormItem, MInput, MInputNumber, MSelect, MTable, MTag, MTextarea, message } from 'morya-ui'
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

// 数据详情（表格预览）
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailSource = ref<DataSourceConfig | null>(null)
const detailRows = ref<Record<string, unknown>[]>([])
const detailError = ref('')

const detailColumns = computed(() => {
  const keys: string[] = []
  for (const row of detailRows.value.slice(0, 50)) {
    for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k)
  }
  return keys.map(k => ({ key: k, label: k, minWidth: 100 }))
})

const TYPE_OPTIONS = computed(() => [
  { label: t('datasources.static'), value: 'static' },
  { label: t('datasources.api'), value: 'api' },
  { label: t('datasources.mock'), value: 'mock' },
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
  return t(`datasources.${type}`)
}

function detailOf(ds: DataSourceConfig): string {
  if (ds.type === 'api') return ds.url ?? '-'
  return t('datasources.rows', { n: ds.staticData?.length ?? 0 })
}

async function onTest(ds: DataSourceConfig) {
  testingId.value = ds.id ?? null
  try {
    const adapter = getAdapter(ds.type)
    const result = adapter.test ? await adapter.test(ds) : { ok: true, message: 'OK' }
    if (result.ok) message.success(t('datasources.testOk', { msg: result.message ?? '' }))
    else message.error(t('datasources.testFail', { msg: result.message ?? '' }))
  } catch (e) {
    message.error(t('datasources.testFail', { msg: e instanceof Error ? e.message : '' }))
  } finally {
    testingId.value = null
  }
}

async function onViewDetail(ds: DataSourceConfig) {
  detailSource.value = ds
  detailRows.value = []
  detailError.value = ''
  detailVisible.value = true
  detailLoading.value = true
  try {
    const adapter = getAdapter(ds.type)
    detailRows.value = await adapter.fetch(ds)
  } catch (e) {
    detailError.value = e instanceof Error ? e.message : String(e)
  } finally {
    detailLoading.value = false
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
  message.success(t('datasources.deleted'))
}

function onSave() {
  const ds = editing.value
  if (!ds) return
  if (!ds.name?.trim()) { message.warn(t('datasources.name')); return }
  if (ds.type === 'api' && !ds.url?.trim()) { message.warn('URL'); return }
  if (ds.type === 'static' || ds.type === 'mock') {
    try {
      ds.staticData = JSON.parse(staticDataText.value || '[]')
      if (!Array.isArray(ds.staticData)) throw new Error('not array')
    } catch {
      message.warn('JSON')
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
    if (result.ok) message.success(t('datasources.testOk', { msg: result.message ?? '' }))
    else message.error(t('datasources.testFail', { msg: result.message ?? '' }))
  } finally {
    dialogTesting.value = false
  }
}
</script>

<template>
  <WorkspacePage :title="t('pages.datasources.title')" :summary="t('pages.datasources.summary')">
    <div class="datasources">
      <div class="datasources__head">
        <MButton type="default" @click="router.push('/connectors')">
          <SvgIcon name="plug" :px="14" /> {{ t('datasources.importViaConnector') }}
        </MButton>
        <MButton type="primary" @click="onAdd">
          <SvgIcon name="plus" :px="14" /> {{ t('datasources.newDs') }}
        </MButton>
      </div>

      <div v-if="sources.length === 0" class="datasources__empty">
        <MEmpty :title="t('datasources.empty')">
          <template #extra>
            <MButton type="primary" @click="onAdd">{{ t('datasources.newDs') }}</MButton>
          </template>
        </MEmpty>
      </div>

      <div v-else class="datasources__table">
        <div class="datasources__row datasources__row--head">
          <span class="col-name">{{ t('datasources.name') }}</span>
          <span class="col-type">{{ t('datasources.type') }}</span>
          <span class="col-detail">{{ t('datasources.detail') }}</span>
          <span class="col-actions" />
        </div>
        <div v-for="ds in sources" :key="ds.id" class="datasources__row">
          <span class="col-name">
            <span class="ds-name">{{ ds.name }}</span>
            <span class="ds-id">{{ ds.id }}</span>
          </span>
          <span class="col-type"><MTag>{{ typeLabel(ds.type) }}</MTag></span>
          <span class="col-detail">{{ detailOf(ds) }}</span>
          <span class="col-actions">
            <MButton type="text" size="small" @click="onViewDetail(ds)">{{ t('datasources.viewData') }}</MButton>
            <MButton type="text" size="small" :loading="testingId === ds.id" @click="onTest(ds)">{{ t('datasources.test') }}</MButton>
            <MButton type="text" size="small" @click="onEdit(ds)">{{ t('datasources.edit') }}</MButton>
            <MButton type="text" size="small" danger @click="onDelete(ds)">{{ t('datasources.delete') }}</MButton>
          </span>
        </div>
      </div>
    </div>

    <!-- 数据详情对话框 -->
    <MDialog v-model="detailVisible" :title="detailSource?.name ?? t('datasources.viewData')" width="720px">
      <div class="ds-detail">
        <div class="ds-detail__meta">
          <MTag>{{ detailSource ? typeLabel(detailSource.type) : '' }}</MTag>
          <span class="ds-detail__count">{{ t('datasources.rows', { n: detailRows.length }) }}</span>
        </div>
        <div v-if="detailError" class="ds-detail__error" role="alert">{{ detailError }}</div>
        <MTable
          v-else
          :columns="detailColumns"
          :rows="detailRows"
          :loading="detailLoading"
          :paginator="true"
          :rows-per-page="10"
          :page-sizes="[10, 25, 50]"
          :max-height="420"
          bordered
          striped
          :empty-text="t('datasources.noData')"
        />
      </div>
    </MDialog>

    <!-- 新建/编辑对话框 -->
    <MDialog v-model="dialogVisible" :title="t('datasources.newDs')" width="480px">
      <MForm v-if="editing" :model="editing">
        <MFormItem :label="t('datasources.name')" required>
          <MInput v-model="editing.name" fluid />
        </MFormItem>
        <MFormItem :label="t('datasources.type')" required>
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
        <MButton type="default" :loading="dialogTesting" @click="onDialogTest">{{ t('datasources.test') }}</MButton>
        <MButton type="default" @click="dialogVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" @click="onSave">{{ t('common.save') }}</MButton>
      </template>
    </MDialog>
  </WorkspacePage>
</template>

<style scoped>
.datasources {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.datasources__head {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.datasources__empty {
  padding: 40px 0;
}

.datasources__table {
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  overflow: hidden;
}

.datasources__row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr 1.6fr;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--m-color-split);
}

.datasources__row:last-child {
  border-bottom: none;
}

.datasources__row--head {
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

.ds-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ds-detail__meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ds-detail__count {
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.ds-detail__error {
  padding: 10px 12px;
  border-radius: var(--m-radius-md);
  background: var(--m-color-danger-soft, var(--m-color-split));
  color: var(--m-color-danger, #d03050);
  font-size: 13px;
}
</style>
