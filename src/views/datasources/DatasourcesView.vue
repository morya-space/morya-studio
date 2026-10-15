<script setup lang="ts">
/**
 * 数据源管理（/datasources）
 * 数据的存储与展示：列出全部数据源，支持测试连通性、编辑、删除、新建。
 * 也可通过连接器（/connectors）从文件 / 数据库导入。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  MButton,
  MCard,
  MDialog,
  MEmpty,
  MFlex,
  MForm,
  MFormItem,
  MInput,
  MInputNumber,
  MSelect,
  MSegmented,
  MSkeleton,
  MTable,
  MTag,
  MTextarea,
  message,
  useConfirm,
  type TableColumnDefinition,
} from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { DataSourceConfig, DataSourceType } from '../../types/schema'
import { initDataSources, listDataSources, saveDataSource, deleteDataSource, genDataSourceId } from '../../services/datasource'
import { getAdapter } from '../../data/adapters'
import { useDataStore } from '../../data/store'

const { t } = useI18n()
const router = useRouter()
const dataStore = useDataStore()
const confirm = useConfirm()

const sources = ref<DataSourceConfig[]>([])
const loading = ref(true)
const testingId = ref<string | null>(null)

const dialogVisible = ref(false)
const editing = ref<DataSourceConfig | null>(null)
/** 类型守卫：确保 editing 非 null 时模板可安全访问 */
const e = computed(() => editing.value!)
const staticDataText = ref('[]')
const dialogTesting = ref(false)

// ---------- 筛选 ----------
type TypeFilter = 'all' | DataSourceType
const typeFilter = ref<TypeFilter>('all')
const searchKeyword = ref('')

const TYPE_FILTER_OPTIONS = computed(() => [
  { label: t('datasources.filterAll'), value: 'all' },
  { label: t('datasources.static'), value: 'static' },
  { label: t('datasources.api'), value: 'api' },
  { label: t('datasources.mock'), value: 'mock' },
])

const filteredSources = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  return sources.value.filter(ds => {
    if (typeFilter.value !== 'all' && ds.type !== typeFilter.value) return false
    if (kw && !(ds.name ?? '').toLowerCase().includes(kw)) return false
    return true
  })
})

// ---------- 统计 ----------
const counts = computed(() => {
  const c = { total: sources.value.length, static: 0, api: 0, mock: 0 }
  for (const ds of sources.value) {
    if (ds.type === 'static') c.static++
    else if (ds.type === 'api') c.api++
    else if (ds.type === 'mock') c.mock++
  }
  return c
})

// ---------- 表单选项 ----------
const TYPE_OPTIONS = computed(() => [
  { label: t('datasources.static'), value: 'static' },
  { label: t('datasources.api'), value: 'api' },
  { label: t('datasources.mock'), value: 'mock' },
])
const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
]

// ---------- 类型 → 图标 ----------
const TYPE_ICON: Record<DataSourceType, string> = {
  static: 'file',
  api: 'api',
  mock: 'hive',
}

const columns = computed<TableColumnDefinition[]>(() => [
  { key: 'name', label: t('datasources.name'), minWidth: 240 },
  { key: 'type', label: t('datasources.type'), width: 140 },
  { key: 'detail', label: t('datasources.detail'), minWidth: 260 },
  { key: 'actions', label: t('datasources.actions'), width: 260, align: 'end' },
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

async function onDelete(ds: DataSourceConfig) {
  if (!ds.id) return
  const ok = await confirm.require({
    header: t('datasources.deleteConfirmTitle'),
    message: t('datasources.deleteConfirmMsg', { name: ds.name || ds.id }),
    acceptLabel: t('datasources.delete'),
    rejectLabel: t('common.cancel'),
    acceptColor: 'danger',
  })
  if (!ok) return
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
  <WorkspacePage :title="t('pages.datasources.title')" :summary="t('pages.datasources.summary')" fill>
    <div class="datasources">
      <!-- 概览统计 -->
      <div v-if="!loading" class="datasources__stats">
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--total">
              <SvgIcon name="database" :px="16" />
            </span>
            <span class="stat-card__label">{{ t('datasources.statTotal') }}</span>
          </div>
          <div class="stat-card__value">{{ counts.total }}</div>
          <div class="stat-card__sub">{{ t('datasources.statTotalSub') }}</div>
        </MCard>
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--static">
              <SvgIcon name="file" :px="16" />
            </span>
            <span class="stat-card__label">{{ t('datasources.static') }}</span>
          </div>
          <div class="stat-card__value">{{ counts.static }}</div>
          <div class="stat-card__sub">{{ t('datasources.statStaticSub') }}</div>
        </MCard>
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--api">
              <SvgIcon name="api" :px="16" />
            </span>
            <span class="stat-card__label">{{ t('datasources.api') }}</span>
          </div>
          <div class="stat-card__value">{{ counts.api }}</div>
          <div class="stat-card__sub">{{ t('datasources.statApiSub') }}</div>
        </MCard>
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--mock">
              <SvgIcon name="hive" :px="16" />
            </span>
            <span class="stat-card__label">{{ t('datasources.mock') }}</span>
          </div>
          <div class="stat-card__value">{{ counts.mock }}</div>
          <div class="stat-card__sub">{{ t('datasources.statMockSub') }}</div>
        </MCard>
      </div>

      <!-- 工具栏：筛选 + 搜索 + 操作 -->
      <div v-if="!loading" class="datasources__toolbar">
        <div class="datasources__filters">
          <MSegmented
            v-model="typeFilter"
            :options="TYPE_FILTER_OPTIONS"
          />
          <MInput
            v-model="searchKeyword"
            :placeholder="t('datasources.searchPlaceholder')"
            class="datasources__search"
            clearable
          >
            <template #prefix>
              <SvgIcon name="search" :px="14" />
            </template>
          </MInput>
        </div>
        <div class="datasources__actions">
          <MButton type="default" @click="router.push('/connectors')">
            <SvgIcon name="plug" :px="14" /> {{ t('datasources.importViaConnector') }}
          </MButton>
          <MButton type="primary" @click="onAdd">
            <SvgIcon name="plus" :px="14" /> {{ t('datasources.newDs') }}
          </MButton>
        </div>
      </div>

      <!-- 加载骨架 -->
      <div v-if="loading" class="datasources__skeleton">
        <div class="datasources__skeleton-stats">
          <MSkeleton v-for="i in 4" :key="i" height="92px" border-radius="var(--m-radius-lg)" />
        </div>
        <MSkeleton height="56px" border-radius="var(--m-radius-md)" />
        <MSkeleton height="400px" border-radius="var(--m-radius-lg)" />
      </div>

      <!-- 空状态：完全没有数据源 -->
      <div v-else-if="sources.length === 0" class="datasources__empty">
        <MEmpty :title="t('datasources.empty')">
          <template #extra>
            <MFlex gap="8px" justify="center">
              <MButton @click="router.push('/connectors')">
                <SvgIcon name="plug" :px="14" /> {{ t('datasources.importViaConnector') }}
              </MButton>
              <MButton type="primary" @click="onAdd">
                <SvgIcon name="plus" :px="14" /> {{ t('datasources.newDs') }}
              </MButton>
            </MFlex>
          </template>
        </MEmpty>
      </div>

      <!-- 筛选后无结果 -->
      <div v-else-if="filteredSources.length === 0" class="datasources__empty">
        <MEmpty :title="t('datasources.noMatchTitle')" :description="t('datasources.noMatchDesc')">
          <template #extra>
            <MButton @click="() => { typeFilter = 'all'; searchKeyword = '' }">
              {{ t('datasources.resetFilter') }}
            </MButton>
          </template>
        </MEmpty>
      </div>

      <!-- 表格 -->
      <MCard v-else class="datasources__table" shadow="always" :bordered="true">
        <MTable
          :columns="columns"
          :rows="filteredSources"
          row-key="id"
          :paginator="true"
          :rows-per-page="10"
          :page-sizes="[10, 20, 50]"
          show-rows-per-page
          :empty-text="t('datasources.empty')"
          striped
          fill
        >
          <template #cell-name="{ row }">
            <div class="ds-name-cell">
              <span class="ds-name">{{ row.name }}</span>
              <!-- <span class="ds-id">{{ row.id }}</span> -->
            </div>
          </template>
          <template #cell-type="{ row }">
            <div class="ds-type-cell">
              <span class="ds-type-icon" :class="`ds-type-icon--${row.type}`">
                <SvgIcon :name="TYPE_ICON[row.type as DataSourceType]" :px="14" />
              </span>
              <span class="ds-type-label">{{ typeLabel(row.type as DataSourceType) }}</span>
            </div>
          </template>
          <template #cell-detail="{ row }">
            <span class="ds-detail" :title="detailOf(row as DataSourceConfig)">{{ detailOf(row as DataSourceConfig) }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="ds-actions">
              <MButton type="text" size="small" @click="router.push(`/datasources/${row.id}`)">
                {{ t('datasources.viewData') }}
              </MButton>
              <MButton type="text" size="small" :loading="testingId === row.id" @click="onTest(row as DataSourceConfig)">
                {{ t('datasources.test') }}
              </MButton>
              <MButton type="text" size="small" @click="onEdit(row as DataSourceConfig)">
                {{ t('datasources.edit') }}
              </MButton>
              <MButton type="text" size="small" danger @click="onDelete(row as DataSourceConfig)">
                {{ t('datasources.delete') }}
              </MButton>
            </div>
          </template>
        </MTable>
      </MCard>
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
  gap: 16px;
  height: 100%;
  min-height: 0;
}

/* ========== 概览统计 ========== */
.datasources__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  flex-shrink: 0;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
}

.stat-card :deep(.m-card__body) {
  padding: 0;
}

.stat-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--m-color-text-muted);
}

.stat-card__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-fill-light);
  color: var(--m-color-text-muted);
  flex: none;
}

.stat-card__icon--total {
  background: color-mix(in srgb, var(--m-color-text) 8%, transparent);
  color: var(--m-color-text);
}
.stat-card__icon--static {
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}
.stat-card__icon--api {
  background: color-mix(in srgb, var(--m-color-info) 12%, transparent);
  color: var(--m-color-info);
}
.stat-card__icon--mock {
  background: color-mix(in srgb, var(--m-color-warning) 12%, transparent);
  color: var(--m-color-warning);
}

.stat-card__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--m-color-text-muted);
}

.stat-card__value {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--m-color-text);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}

.stat-card__sub {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

/* ========== 工具栏 ========== */
.datasources__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.datasources__filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.datasources__search {
  width: 240px;
}

.datasources__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ========== 加载 / 空状态 ========== */
.datasources__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.datasources__skeleton-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.datasources__empty {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  border: 1px solid var(--m-color-border);
}

/* ========== 表格容器 ========== */
.datasources__table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 卡片内表格贴边铺满，body 撑满剩余高度供 MTable fill 使用 */
.datasources__table :deep(.m-card__body) {
  flex: 1 1 auto;
  min-height: 0;
}

/* ========== 表格单元格 ========== */
.ds-name-cell {
  display: flex;
  flex-direction: column;
}

.ds-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-id {
  font-size: 11px;
  color: var(--m-color-text-muted);
  font-family: var(--m-font-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-type-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ds-type-icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-fill-light);
  color: var(--m-color-text-muted);
  flex: none;
}

.ds-type-icon--static {
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}
.ds-type-icon--api {
  background: color-mix(in srgb, var(--m-color-info) 12%, transparent);
  color: var(--m-color-info);
}
.ds-type-icon--mock {
  background: color-mix(in srgb, var(--m-color-warning) 12%, transparent);
  color: var(--m-color-warning);
}

.ds-type-label {
  font-size: 13px;
  color: var(--m-color-text);
}

.ds-detail {
  display: inline-block;
  max-width: 100%;
  font-size: 13px;
  color: var(--m-color-text-muted);
  font-family: var(--m-font-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.ds-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
}

/* ========== 响应式 ========== */
@media (max-width: 900px) {
  .datasources__stats,
  .datasources__skeleton-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .datasources__search {
    width: 180px;
  }
}
</style>
