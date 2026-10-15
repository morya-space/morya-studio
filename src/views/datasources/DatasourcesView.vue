<script setup lang="ts">
/**
 * 数据源管理（/datasources）
 * 数据的存储与展示：列出全部数据源，支持测试连通性、编辑、删除、新建。
 * 也可通过连接器（/connectors）从文件 / 数据库导入。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MDialog, MEmpty, MForm, MFormItem, MInput, MInputNumber, MSelect, MSkeleton, MTable, MTag, MTextarea, message, type TableColumnDefinition } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { DataSourceConfig, DataSourceType } from '../../types/schema'
import { initDataSources, listDataSources, saveDataSource, deleteDataSource, genDataSourceId } from '../../services/datasource'
import { getAdapter } from '../../data/adapters'
import { useDataStore } from '../../data/store'

const { t } = useI18n()
const router = useRouter()
const dataStore = useDataStore()

const sources = ref<DataSourceConfig[]>([])
const loading = ref(true)
const testingId = ref<string | null>(null)

const dialogVisible = ref(false)
const editing = ref<DataSourceConfig | null>(null)
/** 类型守卫：确保 editing 非 null 时模板可安全访问 */
const e = computed(() => editing.value!)
const staticDataText = ref('[]')
const dialogTesting = ref(false)

const TYPE_OPTIONS = computed(() => [
  { label: t('datasources.static'), value: 'static' },
  { label: t('datasources.api'), value: 'api' },
  { label: t('datasources.mock'), value: 'mock' },
])
const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
]

const columns = computed<TableColumnDefinition[]>(() => [
  { key: 'name', label: t('datasources.name'), minWidth: 200 },
  { key: 'type', label: t('datasources.type'), width: 120 },
  { key: 'detail', label: t('datasources.detail'), minWidth: 220, render: (row) => detailOf(row as DataSourceConfig) },
  { key: 'actions', label: '', width: 280 },
])

function refresh() {
  sources.value = listDataSources()
}

onMounted(async () => {
  try {
    await initDataSources()
    refresh()
  } finally {
    loading.value = false
  }
})

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

      <div v-if="loading" class="datasources__skeleton">
        <MSkeleton v-for="i in 4" :key="i" height="52px" border-radius="var(--m-radius-md)" />
      </div>

      <div v-else-if="sources.length === 0" class="datasources__empty">
        <MEmpty :title="t('datasources.empty')">
          <template #extra>
            <MButton type="primary" @click="onAdd">{{ t('datasources.newDs') }}</MButton>
          </template>
        </MEmpty>
      </div>

      <div v-else class="datasources__table">
        <MTable
          :columns="columns"
          :rows="sources"
          row-key="id"
          :paginator="true"
          :rows-per-page="8"
          :page-sizes="[8, 16, 32]"
          show-rows-per-page
          :empty-text="t('datasources.empty')"
          striped
        >
          <template #cell-name="{ row }">
            <div class="ds-name-cell">
              <span class="ds-name">{{ row.name }}</span>
              <span class="ds-id">{{ row.id }}</span>
            </div>
          </template>
          <template #cell-type="{ row }">
            <MTag>{{ typeLabel(row.type) }}</MTag>
          </template>
          <template #cell-actions="{ row }">
            <div class="ds-actions">
              <MButton type="text" size="small" @click="router.push(`/datasources/${row.id}`)">{{ t('datasources.viewData') }}</MButton>
              <MButton type="text" size="small" :loading="testingId === row.id" @click="onTest(row as DataSourceConfig)">{{ t('datasources.test') }}</MButton>
              <MButton type="text" size="small" @click="onEdit(row as DataSourceConfig)">{{ t('datasources.edit') }}</MButton>
              <MButton type="text" size="small" danger @click="onDelete(row as DataSourceConfig)">{{ t('datasources.delete') }}</MButton>
            </div>
          </template>
        </MTable>
      </div>
    </div>

    <!-- 新建/编辑对话框 -->
    <MDialog v-model="dialogVisible" :title="t('datasources.newDs')" width="480px">
      <MForm v-if="editing" :model="editing">
        <MFormItem :label="t('datasources.name')" required>
          <MInput v-model="e.name" fluid />
        </MFormItem>
        <MFormItem :label="t('datasources.type')" required>
          <MSelect v-model="e.type" :options="TYPE_OPTIONS" fluid />
        </MFormItem>

        <template v-if="e.type === 'api'">
          <MFormItem label="URL" required>
            <MInput v-model="e.url" placeholder="https://api.example.com/data" fluid />
          </MFormItem>
          <MFormItem label="Method">
            <MSelect v-model="e.method" :options="METHOD_OPTIONS" fluid />
          </MFormItem>
          <MFormItem label="dataPath">
            <MInput v-model="e.dataPath" placeholder="data.list" fluid />
          </MFormItem>
          <MFormItem label="pollInterval(ms)">
            <MInputNumber v-model="e.pollInterval" :min="0" fluid />
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'static' || e.type === 'mock'">
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
  height: 100%;
}

.datasources__head {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.datasources__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.ds-name-cell {
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

.ds-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
