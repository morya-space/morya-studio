<script setup lang="ts">
/**
 * 数据源管理（/datasources）
 * 数据的存储与展示：列出全部数据源，支持测试连通性、编辑、删除、新建。
 * 也可通过连接器（/connectors）从文件 / 数据库导入。
 */

import { computed, onMounted, ref, watch } from 'vue'
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
import { formatMockTemplate } from '../../data/mockgen'
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
const mockTemplateText = ref('')
/** Mock 数据方式：模板生成 / 固定数据（二选一） */
type MockMode = 'template' | 'static'
const mockMode = ref<MockMode>('template')
const MOCK_MODE_OPTIONS = computed(() => [
  { label: t('datasources.mockModeTemplate'), value: 'template' },
  { label: t('datasources.mockModeStatic'), value: 'static' },
])
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
  { label: t('datasources.websocket'), value: 'websocket' },
  { label: t('datasources.sql'), value: 'sql' },
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
  const c: Record<string, number> = { total: sources.value.length, static: 0, api: 0, mock: 0, websocket: 0, sql: 0 }
  for (const ds of sources.value) {
    if (c[ds.type] !== undefined) c[ds.type]++
  }
  return c
})

const statItems = computed(() => [
  { key: 'total', label: t('datasources.statTotal'), desc: t('datasources.statTotalSub'), value: counts.value.total, icon: 'database', cls: 'total' },
  { key: 'static', label: t('datasources.static'), desc: t('datasources.statStaticSub'), value: counts.value.static, icon: 'file', cls: 'static' },
  { key: 'api', label: t('datasources.api'), desc: t('datasources.statApiSub'), value: counts.value.api, icon: 'api', cls: 'api' },
  { key: 'mock', label: t('datasources.mock'), desc: t('datasources.statMockSub'), value: counts.value.mock, icon: 'hive', cls: 'mock' },
  { key: 'websocket', label: t('datasources.websocket'), desc: t('datasources.statWsSub'), value: counts.value.websocket, icon: 'sync', cls: 'websocket' },
  { key: 'sql', label: t('datasources.sql'), desc: t('datasources.statSqlSub'), value: counts.value.sql, icon: 'database', cls: 'sql' },
])

// ---------- 表单选项 ----------
const TYPE_OPTIONS = computed(() => [
  { label: t('datasources.static'), value: 'static' },
  { label: t('datasources.api'), value: 'api' },
  { label: t('datasources.mock'), value: 'mock' },
  { label: t('datasources.websocket'), value: 'websocket' },
  { label: t('datasources.sql'), value: 'sql' },
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
  websocket: 'sync',
  sql: 'database',
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
  if (ds.type === 'websocket') return ds.wsUrl ?? '-'
  if (ds.type === 'sql') return ds.sql?.host ? `${ds.sql.host}:${ds.sql.port ?? 3306}/${ds.sql.database ?? ''}` : '-'
  if (ds.type === 'mock') return ds.mockTemplate ? t('datasources.mockTemplate') : '-'
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
  mockTemplateText.value = ''
  mockMode.value = 'template'
  dialogVisible.value = true
}

watch(() => e.value?.type, (type) => {
  if (!editing.value) return
  if (type === 'sql' && !editing.value.sql) {
    editing.value.sql = { driver: 'mysql', host: 'localhost', port: 3306, limit: 1000 }
  }
})

function onEdit(ds: DataSourceConfig) {
  editing.value = { ...ds }
  staticDataText.value = JSON.stringify(ds.staticData ?? [], null, 2)
  mockTemplateText.value = formatMockTemplate(ds.mockTemplate ?? '')
  mockMode.value = ds.mockTemplate ? 'template' : 'static'
  dialogVisible.value = true
}

/** 美化 Mock 模板（保留 {{repeat N}} 前缀） */
function onFormatMockTemplate() {
  mockTemplateText.value = formatMockTemplate(mockTemplateText.value)
  message.success(t('datasources.formatted'))
}

/** 美化 Mock 固定数据 JSON */
function onFormatMockData() {
  try {
    staticDataText.value = JSON.stringify(JSON.parse(staticDataText.value || '[]'), null, 2)
    message.success(t('datasources.formatted'))
  } catch {
    message.warn(t('datasources.mockDataRequired'))
  }
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
  if (ds.type === 'static') {
    try {
      ds.staticData = JSON.parse(staticDataText.value || '[]')
      if (!Array.isArray(ds.staticData)) throw new Error('not array')
    } catch {
      message.warn('JSON')
      return
    }
  }
  if (ds.type === 'mock') {
    if (mockMode.value === 'template') {
      ds.mockTemplate = mockTemplateText.value.trim() || undefined
      if (!ds.mockTemplate) {
        message.warn(t('datasources.mockTemplateRequired'))
        return
      }
      ds.staticData = undefined
    } else {
      try {
        const parsed = JSON.parse(staticDataText.value || '[]')
        if (!Array.isArray(parsed)) throw new Error('not array')
        ds.staticData = parsed
      } catch {
        message.warn(t('datasources.mockDataRequired'))
        return
      }
      ds.mockTemplate = undefined
    }
  }
  if (ds.type === 'sql' && !ds.sql?.query?.trim()) { message.warn('SQL'); return }
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
      <!-- 概览统计（紧凑单条） -->
      <div v-if="!loading" class="datasources__stats">
        <MCard class="stats-bar" shadow="always" :bordered="true">
          <div
            v-for="(s, i) in statItems"
            :key="s.key"
            class="stat-item"
            :class="{ 'stat-item--divider': i > 0 }"
            :title="s.desc"
          >
            <span class="stat-item__icon" :class="`stat-item__icon--${s.cls}`">
              <SvgIcon :name="s.icon" :px="16" />
            </span>
            <span class="stat-item__meta">
              <span class="stat-item__value">{{ s.value }}</span>
              <span class="stat-item__label">{{ s.label }}</span>
            </span>
          </div>
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
          <MSkeleton v-for="i in 6" :key="i" height="68px" border-radius="var(--m-radius-lg)" />
        </div>
        <MSkeleton height="48px" border-radius="var(--m-radius-md)" />
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
            <span class="ds-detail ds-mono" :title="detailOf(row as DataSourceConfig)">{{ detailOf(row as DataSourceConfig) }}</span>
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

        <template v-else-if="e.type === 'static'">
          <MFormItem label="Data (JSON)" required>
            <MTextarea v-model="staticDataText" :rows="8" fluid placeholder='[{"x":"1月","y":100}]' />
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'mock'">
          <MFormItem :label="t('datasources.mockMode')">
            <MSegmented v-model="mockMode" :options="MOCK_MODE_OPTIONS" />
          </MFormItem>

          <MFormItem
            v-if="mockMode === 'template'"
            :label="t('datasources.mockTemplate')"
            required
            :help="t('datasources.mockTemplateHelp')"
          >
            <MTextarea v-model="mockTemplateText" :rows="8" fluid placeholder='{"name":"{{name}}","amount":"{{int 10 999}}","date":"{{date 2024-01-01 2024-12-31}}"}' />
            <div class="ds-form-actions">
              <MButton type="default" size="small" :disabled="!mockTemplateText.trim()" @click="onFormatMockTemplate">
                {{ t('datasources.format') }}
              </MButton>
            </div>
          </MFormItem>

          <MFormItem
            v-else
            :label="t('datasources.mockData')"
            required
            :help="t('datasources.mockDataHelp')"
          >
            <MTextarea v-model="staticDataText" :rows="8" fluid placeholder='[{"x":"1月","y":100}]' />
            <div class="ds-form-actions">
              <MButton type="default" size="small" :disabled="!staticDataText.trim()" @click="onFormatMockData">
                {{ t('datasources.format') }}
              </MButton>
            </div>
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'websocket'">
          <MFormItem label="WS URL" required>
            <MInput v-model="e.wsUrl" placeholder="wss://example.com/live" fluid />
          </MFormItem>
          <MFormItem label="pollInterval(ms)">
            <MInputNumber v-model="e.pollInterval" :min="0" fluid />
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'sql' && e.sql">
          <MFormItem label="Driver">
            <MSelect v-model="e.sql!.driver" :options="[{ label: 'MySQL', value: 'mysql' }, { label: 'PostgreSQL', value: 'postgresql' }, { label: 'SQL Server', value: 'sqlserver' }]" fluid />
          </MFormItem>
          <MFormItem label="Host" required>
            <MInput v-model="e.sql!.host" placeholder="localhost" fluid />
          </MFormItem>
          <MFormItem label="Port">
            <MInputNumber v-model="e.sql!.port" :min="1" :max="65535" fluid />
          </MFormItem>
          <MFormItem label="Database">
            <MInput v-model="e.sql!.database" fluid />
          </MFormItem>
          <MFormItem label="User">
            <MInput v-model="e.sql!.user" fluid />
          </MFormItem>
          <MFormItem label="Password">
            <MInput type="password" v-model="e.sql!.password" fluid />
          </MFormItem>
          <MFormItem label="SQL (read-only)" required help="仅 SELECT / WITH">
            <MTextarea v-model="e.sql!.query" :rows="5" fluid placeholder="SELECT * FROM orders LIMIT 100" />
          </MFormItem>
          <MFormItem label="Row limit">
            <MInputNumber v-model="e.sql!.limit" :min="1" :max="5000" fluid />
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

<style scoped lang="scss">
.datasources {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 1rem;

  &__stats {
    flex: none;
  }

  &__toolbar {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem;
  }

  &__search {
    width: 15rem;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__skeleton {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__skeleton-stats {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.75rem;
  }

  &__empty {
    display: flex;
    min-height: 320px;
    flex: 1;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--m-color-border);
    border-radius: var(--m-radius-lg);
    background: var(--m-color-surface);
  }
}

.stats-bar {
  padding: 0.75rem 0.5rem;

  :deep(.m-card__body) {
    display: flex;
    align-items: stretch;
    padding: 0;
  }
}

.stat-item {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.625rem;
  padding: 0.125rem 1rem;

  &__icon {
    display: grid;
    width: 34px;
    height: 34px;
    flex: none;
    place-items: center;
    border-radius: var(--m-radius-md);
    background: var(--m-color-fill-light);
    color: var(--m-color-text-muted);
  }

  &__meta {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  &__value {
    font-size: 1.25rem;
    line-height: 1.15;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--m-color-text);
  }

  &__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text-muted);
  }
}

.stat-item--divider {
  border-left: 1px solid var(--m-color-split);
}

.stat-item__icon--total {
  background: color-mix(in srgb, var(--m-color-text) 8%, transparent);
  color: var(--m-color-text);
}

.stat-item__icon--static,
.ds-type-icon--static {
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}

.stat-item__icon--api,
.stat-item__icon--websocket,
.ds-type-icon--api,
.ds-type-icon--websocket {
  background: color-mix(in srgb, var(--m-color-info) 12%, transparent);
  color: var(--m-color-info);
}

.stat-item__icon--mock,
.ds-type-icon--mock {
  background: color-mix(in srgb, var(--m-color-warning) 12%, transparent);
  color: var(--m-color-warning);
}

.stat-item__icon--sql,
.ds-type-icon--sql {
  background: color-mix(in srgb, var(--m-color-success) 12%, transparent);
  color: var(--m-color-success);
}

/* 卡片内表格贴边铺满，body 撑满剩余高度供 MTable fill 使用 */
.datasources__table {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;

  :deep(.m-card__body) {
    flex: 1 1 auto;
    min-height: 0;
  }
}

.ds-name-cell {
  display: flex;
  flex-direction: column;
}

.ds-type-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.ds-type-icon {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  place-items: center;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-fill-light);
  color: var(--m-color-text-muted);
}

.ds-type-label {
  font-size: 13px;
  color: var(--m-color-text);
}

.ds-detail {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  vertical-align: middle;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.ds-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.125rem;
}

.ds-form-actions {
  display: flex;
  justify-content: flex-end;
}

.ds-mono {
  font-family: var(--m-font-mono, monospace);
}

@media (max-width: 1200px) {
  .stats-bar {
    :deep(.m-card__body) {
      flex-wrap: wrap;
    }
  }

  .stat-item {
    flex: 1 1 30%;
  }

  .stat-item--divider {
    border-left: none;
  }
}

@media (max-width: 900px) {
  .datasources__skeleton-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .datasources__search {
    width: 180px;
  }
}
</style>
