<script setup lang="ts">
/**
 * 连接器（/connectors）
 * 参考 demos/connector.html 原型实现：
 * - 快速接入卡片：文件 / 数据库 / API / 云应用四类入口
 * - 我的连接：已创建数据源列表（含状态与搜索）
 * - 新建连接三步向导：选择类型 → 配置连接 → 完成
 * - 文件：解析 CSV / JSON → static 数据源；数据库 / API：生成 api 数据源
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  MButton,
  MCard,
  MCheckbox,
  MDialog,
  MEmpty,
  MFileUpload,
  MForm,
  MFormItem,
  MInput,
  MInputNumber,
  MInputPassword,
  MSegmented,
  MSelect,
  MSkeleton,
  MStepper,
  MTag,
  message,
} from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { DataSourceConfig } from '../../types/schema'
import { initDataSources, listDataSources, deleteDataSource } from '../../services/datasource'
import { importRowsAsDataSource, importDatabaseAsDataSource, parseFileText } from '../../services/connector'
import { getAdapter } from '../../data/adapters'

const router = useRouter()
const { t } = useI18n()

// ==================== 数据源类型目录 ====================

type Category = 'db' | 'file' | 'api'

interface SourceDef {
  id: string
  name: string
  desc: string
  icon: string
}

const SOURCES: Record<Category, SourceDef[]> = {
  db: [
    { id: 'mysql', name: 'MySQL', desc: '5.7 / 8.0', icon: 'database' },
    { id: 'postgresql', name: 'PostgreSQL', desc: '12+', icon: 'database' },
    { id: 'sqlserver', name: 'SQL Server', desc: '2012+', icon: 'database' },
    { id: 'rest', name: 'REST 桥接', desc: 'HTTP 查询接口', icon: 'api' },
  ],
  file: [
    { id: 'excel', name: 'Excel / CSV', desc: '上传本地文件', icon: 'file' },
    { id: 'json', name: 'JSON', desc: '结构化文本文件', icon: 'doc' },
  ],
  api: [{ id: 'rest', name: 'REST API', desc: 'HTTP 接口', icon: 'api' }],
}

const DEFAULT_PORT: Record<string, number> = {
  mysql: 3306,
  postgresql: 5432,
  sqlserver: 1433,
}

const CATEGORY_LABEL: Record<Category, string> = {
  db: '数据库',
  file: '文件',
  api: 'API',
}

// ==================== 我的连接列表 ====================

const sources = ref<DataSourceConfig[]>([])
const loading = ref(true)
const searchKeyword = ref('')
const testingId = ref<string | null>(null)
const testResult = ref<Record<string, { ok: boolean; message: string }>>({})

function refreshSources() {
  sources.value = listDataSources()
}

onMounted(async () => {
  try {
    await initDataSources()
    refreshSources()
  } finally {
    loading.value = false
  }
})

const filteredSources = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return sources.value
  return sources.value.filter(ds => (ds.name ?? '').toLowerCase().includes(kw))
})

function typeLabel(ds: DataSourceConfig): string {
  return ds.type === 'static' ? '文件' : ds.type === 'api' ? 'API' : ds.type === 'mock' ? 'Mock' : ds.type
}

function detailOf(ds: DataSourceConfig): string {
  if (ds.type === 'api') return ds.url ?? '-'
  if (ds.type === 'static') return t('connectors.rows', { n: ds.staticData?.length ?? 0 })
  if (ds.type === 'mock') return 'Mock.js'
  return '-'
}

async function onTestConn(ds: DataSourceConfig) {
  testingId.value = ds.id ?? null
  try {
    const adapter = getAdapter(ds.type)
    const res = await adapter.fetch(ds)
    testResult.value = { ...testResult.value, [ds.id!]: { ok: true, message: `OK (${res.length} rows)` } }
  } catch (e) {
    testResult.value = { ...testResult.value, [ds.id!]: { ok: false, message: e instanceof Error ? e.message : String(e) } }
  } finally {
    testingId.value = null
  }
}

function onDeleteConn(ds: DataSourceConfig) {
  deleteDataSource(ds.id!)
  delete testResult.value[ds.id!]
  refreshSources()
  message.success(t('connectors.connDeleted', { title: ds.name }))
}

// ==================== 新建连接向导 ====================

const dialogVisible = ref(false)
const step = ref(0) // MStepper 从 0 开始：0=选择类型 1=配置连接 2=完成
const cat = ref<Category>('db')
const srcId = ref<string | null>(null)
const connName = ref('')
const tested = ref(false)
const testing = ref(false)
const testMsg = ref<{ ok: boolean; text: string } | null>(null)
const createdDsName = ref('')

// 数据库表单
const dbForm = ref({
  host: '',
  port: 3306,
  database: '',
  user: '',
  password: '',
  ssl: false,
})

// 文件表单
const fileName = ref('')
const fileRows = ref<Record<string, unknown>[] | null>(null)
const fileHeader = ref(true)

// API 表单
const apiForm = ref({
  url: '',
  method: 'GET' as 'GET' | 'POST',
  dataPath: '',
  poll: 0,
})

const steps = computed(() => [
  { label: t('connectors.stepType') },
  { label: t('connectors.stepConfig') },
  { label: t('connectors.stepDone') },
])

const catOptions = computed(() =>
  (Object.keys(CATEGORY_LABEL) as Category[]).map(k => ({ label: CATEGORY_LABEL[k], value: k }))
)

const currentSrc = computed(() => (SOURCES[cat.value] || []).find(s => s.id === srcId.value) ?? null)

const previewRows = computed(() => (fileRows.value ?? []).slice(0, 5))
const previewCols = computed(() => {
  const first = previewRows.value[0]
  return first ? Object.keys(first).slice(0, 6) : []
})

function openWizard(c?: Category, s?: string) {
  step.value = 0
  tested.value = false
  testMsg.value = null
  if (c) cat.value = c
  srcId.value = s ?? null
  connName.value = ''
  dialogVisible.value = true
}

function closeWizard() {
  dialogVisible.value = false
  step.value = 0
  srcId.value = null
  tested.value = false
  testMsg.value = null
  fileName.value = ''
  fileRows.value = null
}

function onPickSrc(id: string) {
  srcId.value = id
  tested.value = false
  testMsg.value = null
  // 默认端口
  if (cat.value === 'db' && DEFAULT_PORT[id]) dbForm.value.port = DEFAULT_PORT[id]
  // 默认连接名
  const s = SOURCES[cat.value].find(x => x.id === id)
  if (s && !connName.value) connName.value = `${s.name} 连接`
}

async function onSelectFile(files: File[]) {
  const file = files[0]
  if (!file) return
  fileName.value = file.name
  if (!connName.value) connName.value = file.name.replace(/\.[^.]+$/, '')
  try {
    const text = await file.text()
    const rows = parseFileText(file.name, text)
    if (rows.length === 0) {
      message.warn(t('connectors.fileParseFail'))
      fileRows.value = null
      return
    }
    fileRows.value = rows
    message.success(t('connectors.fileParsed', { n: rows.length }))
  } catch {
    fileRows.value = null
    message.error(t('connectors.fileParseFail'))
  }
}

function onTest() {
  testing.value = true
  testMsg.value = null
  // MVP：本地校验必填项 + 模拟测试
  setTimeout(() => {
    testing.value = false
    if (cat.value === 'db' && !dbForm.value.host.trim()) {
      testMsg.value = { ok: false, text: t('connectors.testNeedHost') }
      return
    }
    if (cat.value === 'api' && !apiForm.value.url.trim()) {
      testMsg.value = { ok: false, text: t('connectors.dbUrlRequired') }
      return
    }
    tested.value = true
    testMsg.value = { ok: true, text: t('connectors.testOk') }
  }, 600)
}

async function onNext() {
  if (step.value === 0) {
    if (!srcId.value) {
      message.warn(t('connectors.pickSource'))
      return
    }
    step.value = 1
    return
  }
  if (step.value === 1) {
    // 创建数据源
    try {
      if (cat.value === 'file') {
        if (!fileRows.value || !fileName.value) {
          message.warn(t('connectors.fileEmpty'))
          return
        }
        const ds = await importRowsAsDataSource(connName.value.trim() || fileName.value.replace(/\.[^.]+$/, ''), fileRows.value)
        createdDsName.value = ds.name ?? ds.id ?? ''
      } else if (cat.value === 'db') {
        if (!dbForm.value.host.trim()) {
          message.warn(t('connectors.testNeedHost'))
          return
        }
        // 生成 REST 桥接 api 数据源（直连需后端代理，预留）
        const url = `mysql://${dbForm.value.host}:${dbForm.value.port}/${dbForm.value.database}`
        const ds = await importDatabaseAsDataSource({
          name: connName.value.trim(),
          driver: srcId.value === 'rest' ? 'rest' : 'mysql',
          url,
          dataPath: '',
        })
        createdDsName.value = ds.name ?? ds.id ?? ''
      } else {
        if (!apiForm.value.url.trim()) {
          message.warn(t('connectors.dbUrlRequired'))
          return
        }
        const ds = await importDatabaseAsDataSource({
          name: connName.value.trim(),
          driver: 'rest',
          url: apiForm.value.url,
          method: apiForm.value.method,
          dataPath: apiForm.value.dataPath || undefined,
        })
        createdDsName.value = ds.name ?? ds.id ?? ''
      }
      refreshSources()
      step.value = 2
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
    return
  }
  // step 2 → 完成
  closeWizard()
  message.success(t('connectors.connCreated', { title: createdDsName.value }))
  router.push('/datasources')
}

function onBack() {
  if (step.value > 0) step.value -= 1
}

const nextLabel = computed(() =>
  step.value === 0 ? t('common.next') : step.value === 1 ? t('connectors.saveAndContinue') : t('common.done')
)
</script>

<template>
  <WorkspacePage :title="t('pages.connectors.title')" :summary="t('pages.connectors.summary')">
    <!-- 快速接入 -->
    <section class="section">
      <p class="section__title">{{ t('connectors.quickEntry') }}</p>
      <div class="entry-grid">
        <MCard class="entry" shadow="always" :bordered="false" role="button" tabindex="0"
          @click="openWizard('file')" @keydown.enter="openWizard('file')">
          <span class="entry__icon">
            <SvgIcon name="upload" :px="20" />
          </span>
          <span class="entry__name">{{ t('connectors.entryFile') }}</span>
          <span class="entry__desc">{{ t('connectors.entryFileDesc') }}</span>
        </MCard>
        <MCard class="entry" shadow="always" :bordered="false" role="button" tabindex="0"
          @click="openWizard('db')" @keydown.enter="openWizard('db')">
          <span class="entry__icon">
            <SvgIcon name="database" :px="20" />
          </span>
          <span class="entry__name">{{ t('connectors.entryDb') }}</span>
          <span class="entry__desc">{{ t('connectors.entryDbDesc') }}</span>
        </MCard>
        <MCard class="entry" shadow="always" :bordered="false" role="button" tabindex="0"
          @click="openWizard('api')" @keydown.enter="openWizard('api')">
          <span class="entry__icon">
            <SvgIcon name="api" :px="20" />
          </span>
          <span class="entry__name">{{ t('connectors.entryApi') }}</span>
          <span class="entry__desc">{{ t('connectors.entryApiDesc') }}</span>
        </MCard>
      </div>
    </section>

    <!-- 我的连接 -->
    <MCard class="conn-panel" shadow="always" :bordered="false">
      <template #header>
        <div class="panel__head">
          <h2 class="panel__title">{{ t('connectors.myConns') }}</h2>
          <div class="panel__actions">
            <MInput v-model="searchKeyword" :placeholder="t('connectors.searchPlaceholder')" fluid
              class="panel__search" />
            <MButton type="primary" @click="openWizard()">
              <SvgIcon name="plus" :px="14" /> {{ t('connectors.newConn') }}
            </MButton>
          </div>
        </div>
      </template>

      <div v-if="loading" class="conn-skeleton">
        <MSkeleton v-for="i in 4" :key="i" height="48px" border-radius="var(--m-radius-md)" />
      </div>

      <div v-else-if="filteredSources.length === 0" class="panel__empty">
        <MEmpty :title="t('connectors.emptyConns')">
          <template #extra>
            <MButton type="primary" @click="openWizard()">{{ t('connectors.newConn') }}</MButton>
          </template>
        </MEmpty>
      </div>

      <div v-else class="conn-table">
        <div class="conn-table__row conn-table__row--head">
          <span class="col-name">{{ t('common.name') }}</span>
          <span class="col-type">{{ t('common.type') }}</span>
          <span class="col-status">{{ t('connectors.status') }}</span>
          <span class="col-detail">{{ t('connectors.detail') }}</span>
          <span class="col-actions" />
        </div>
        <div v-for="ds in filteredSources" :key="ds.id" class="conn-table__row">
          <span class="col-name">
            <span class="conn-avatar">
              <SvgIcon :name="ds.type === 'static' ? 'file' : ds.type === 'api' ? 'api' : 'database'" :px="14" />
            </span>
            <span class="conn-name">{{ ds.name }}</span>
          </span>
          <span class="col-type">
            <MTag>{{ typeLabel(ds) }}</MTag>
          </span>
          <span class="col-status">
            <template v-if="testResult[ds.id!]">
              <span class="status-dot" :class="testResult[ds.id!].ok ? 'status-dot--ok' : 'status-dot--err'" />
              <span :class="testResult[ds.id!].ok ? 'status-ok' : 'status-err'">
                {{ testResult[ds.id!].ok ? t('connectors.statusOk') : t('connectors.statusErr') }}
              </span>
            </template>
            <span v-else class="status-unknown">{{ t('connectors.statusUnknown') }}</span>
          </span>
          <span class="col-detail">{{ detailOf(ds) }}</span>
          <span class="col-actions">
            <MButton type="text" size="small" :loading="testingId === ds.id" @click="onTestConn(ds)">
              {{ t('connectors.test') }}
            </MButton>
            <MButton type="text" size="small" @click="router.push(`/datasources/${ds.id}`)">
              {{ t('common.edit') }}
            </MButton>
            <MButton type="text" size="small" danger @click="onDeleteConn(ds)">
              {{ t('common.delete') }}
            </MButton>
          </span>
        </div>
      </div>
    </MCard>

    <!-- 新建连接向导 -->
    <MDialog v-model="dialogVisible" :title="t('connectors.newConn')" width="860px" class="conn-dialog">
      <MStepper v-model="step" :steps="steps" linear class="conn-steps" />

      <!-- 步骤 1：选择类型 -->
      <div v-if="step === 0" class="wizard-body">
        <MSegmented v-model="cat" :options="catOptions" block class="cat-tabs" />
        <div class="src-grid">
          <button v-for="s in SOURCES[cat]" :key="s.id" type="button" class="src-card"
            :class="{ 'src-card--selected': srcId === s.id }" @click="onPickSrc(s.id)">
            <span class="src-card__icon">
              <SvgIcon :name="s.icon" :px="20" />
            </span>
            <span class="src-card__name">{{ s.name }}</span>
            <span class="src-card__desc">{{ s.desc }}</span>
          </button>
        </div>
      </div>

      <!-- 步骤 2：配置连接 -->
      <div v-else-if="step === 1" class="wizard-body">
        <div class="picked">
          <SvgIcon :name="currentSrc?.icon ?? 'plug'" :px="18" />
          <span>{{ t('connectors.picked') }}：<b>{{ currentSrc?.name }}</b> · {{ CATEGORY_LABEL[cat] }}</span>
        </div>

        <!-- 数据库 -->
        <template v-if="cat === 'db'">
          <MForm>
            <MFormItem :label="t('connectors.connName')" required>
              <MInput v-model="connName" :placeholder="t('connectors.connNamePlaceholder')" fluid />
            </MFormItem>
            <div class="form-grid">
              <MFormItem :label="t('connectors.dbHost')" required>
                <MInput v-model="dbForm.host" placeholder="127.0.0.1 或 db.internal.com" fluid />
              </MFormItem>
              <MFormItem :label="t('connectors.dbPort')" required>
                <MInputNumber v-model="dbForm.port" :min="1" :max="65535" fluid />
              </MFormItem>
              <MFormItem :label="t('connectors.dbDatabase')" required>
                <MInput v-model="dbForm.database" placeholder="analytics" fluid />
              </MFormItem>
              <MFormItem :label="t('connectors.dbUser')" required>
                <MInput v-model="dbForm.user" placeholder="readonly_user" fluid />
              </MFormItem>
              <MFormItem :label="t('connectors.dbPassword')" required class="form-grid__full">
                <MInputPassword v-model="dbForm.password" placeholder="••••••••" fluid />
              </MFormItem>
            </div>
            <MCheckbox v-model="dbForm.ssl" :label="t('connectors.dbSsl')" />
          </MForm>
          <div class="test-row">
            <MButton type="default" :loading="testing" @click="onTest">{{ t('connectors.dbTest') }}</MButton>
            <span v-if="testMsg" class="test-msg" :class="testMsg.ok ? 'test-msg--ok' : 'test-msg--err'">
              {{ testMsg.text }}
            </span>
          </div>
        </template>

        <!-- 文件 -->
        <template v-else-if="cat === 'file'">
          <MForm>
            <MFormItem :label="t('connectors.connName')" required>
              <MInput v-model="connName" :placeholder="t('connectors.fileNamePlaceholder')" fluid />
            </MFormItem>
            <MFormItem required>
              <MFileUpload drag accept=".csv,.json,.tsv,.txt" :max-size="5 * 1024 * 1024" :auto-upload="false"
                :show-file-list="false" @select="onSelectFile">
                <div class="dropzone">
                  <SvgIcon name="upload" :px="28" class="dropzone__icon" />
                  <p class="dropzone__text">{{ t('connectors.fileDrop') }}</p>
                  <p class="dropzone__tip">{{ t('connectors.fileTip') }}</p>
                </div>
              </MFileUpload>
            </MFormItem>
          </MForm>

          <MCheckbox v-model="fileHeader" :label="t('connectors.fileHeader')" class="file-header-check" />

          <div v-if="fileRows" class="preview">
            <p class="preview__title">{{ t('connectors.previewTitle') }}</p>
            <div class="preview__table">
              <div class="preview__row preview__row--head"
                :style="{ gridTemplateColumns: `repeat(${previewCols.length}, 1fr)` }">
                <span v-for="col in previewCols" :key="col" class="preview__cell">{{ col }}</span>
              </div>
              <div v-for="(row, i) in previewRows" :key="i" class="preview__row"
                :style="{ gridTemplateColumns: `repeat(${previewCols.length}, 1fr)` }">
                <span v-for="col in previewCols" :key="col" class="preview__cell">{{ row[col] }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- API -->
        <template v-else>
          <MForm>
            <MFormItem :label="t('connectors.connName')" required>
              <MInput v-model="connName" :placeholder="t('connectors.connNamePlaceholder')" fluid />
            </MFormItem>
            <MFormItem :label="t('connectors.apiUrl')" required>
              <MInput v-model="apiForm.url" placeholder="https://api.example.com/v1/orders" fluid />
            </MFormItem>
            <div class="form-grid">
              <MFormItem :label="t('connectors.apiMethod')">
                <MSelect v-model="apiForm.method"
                  :options="[{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }]" fluid />
              </MFormItem>
              <MFormItem :label="t('connectors.apiDataPath')">
                <MInput v-model="apiForm.dataPath" placeholder="data.list" fluid />
              </MFormItem>
            </div>
          </MForm>
          <div class="test-row">
            <MButton type="default" :loading="testing" @click="onTest">{{ t('connectors.dbTest') }}</MButton>
            <span v-if="testMsg" class="test-msg" :class="testMsg.ok ? 'test-msg--ok' : 'test-msg--err'">
              {{ testMsg.text }}
            </span>
          </div>
        </template>
      </div>

      <!-- 步骤 3：完成 -->
      <div v-else class="wizard-body done-wrap">
        <div class="done-icon">✓</div>
        <h4 class="done-title">{{ t('connectors.doneTitle') }}</h4>
        <p class="done-desc">{{ t('connectors.doneDesc') }}</p>
        <div class="summary">
          <div class="summary__row">
            <span>{{ t('connectors.connName') }}</span>
            <span>{{ connName }}</span>
          </div>
          <div class="summary__row">
            <span>{{ t('connectors.srcType') }}</span>
            <span>{{ currentSrc?.name ?? '-' }}</span>
          </div>
          <div class="summary__row">
            <span>{{ t('connectors.category') }}</span>
            <span>{{ CATEGORY_LABEL[cat] }}</span>
          </div>
          <div class="summary__row">
            <span>{{ t('connectors.status') }}</span>
            <span class="status-ok">● {{ t('connectors.statusOk') }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <MButton v-if="step > 0" type="default" @click="onBack">{{ t('common.back') }}</MButton>
        <span v-else />
        <div class="footer-right">
          <MButton type="default" @click="closeWizard">{{ t('common.cancel') }}</MButton>
          <MButton type="primary" @click="onNext">{{ nextLabel }}</MButton>
        </div>
      </template>
    </MDialog>
  </WorkspacePage>
</template>

<style scoped>
.section__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  margin: 0 0 12px;
}

/* 快速接入卡片 — 外观由 MCard + 全局 .m-card 承载，这里只留内部布局 */
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.entry__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--m-radius-md);
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
  margin-bottom: 4px;
}

.entry__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
}

.entry__desc {
  font-size: 12px;
  color: var(--m-color-text-muted);
  line-height: 1.5;
}

/* 连接列表面板 — 卡片外观由 MCard 承载，这里只留头部布局 */
.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.panel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 0;
}

.panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel__search {
  width: 220px;
}

.conn-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel__empty {
  padding: 40px 0;
}

/* 连接表格 */
.conn-table__row {
  display: grid;
  grid-template-columns: 2fr 100px 100px 1fr 200px;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--m-color-split);
  font-size: 13px;
}

.conn-table__row:last-child {
  border-bottom: none;
}

.conn-table__row--head {
  background: var(--m-color-fill-light);
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
}

.col-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.conn-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-fill-lighter);
  color: var(--m-color-text-muted);
  flex: none;
}

.conn-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-detail {
  color: var(--m-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot--ok {
  background: var(--m-color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--m-color-success) 15%, transparent);
}

.status-dot--err {
  background: var(--m-color-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--m-color-danger) 15%, transparent);
}

.status-ok {
  color: var(--m-color-success);
  font-size: 12px;
}

.status-err {
  color: var(--m-color-danger);
  font-size: 12px;
}

.status-unknown {
  color: var(--m-color-text-muted);
  font-size: 12px;
}

/* 向导弹窗 — 更宽松的布局 */
.conn-steps {
  margin-bottom: 24px;
}

.wizard-body {
  padding-top: 4px;
  min-height: 320px;
}

.cat-tabs {
  margin-bottom: 20px;
}

/* 数据源卡片 — 更大更舒适 */
.src-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.src-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 18px 16px;
  border: 1.5px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
}

.src-card:hover {
  border-color: var(--m-color-primary);
  background: color-mix(in srgb, var(--m-color-primary) 5%, transparent);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--m-color-primary) 10%, transparent);
}

.src-card--selected {
  border-color: var(--m-color-primary);
  background: color-mix(in srgb, var(--m-color-primary) 8%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--m-color-primary) 15%, transparent);
}

.src-card__icon {
  font-size: 22px;
  color: var(--m-color-primary);
}

.src-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
}

.src-card__desc {
  font-size: 12px;
  color: var(--m-color-text-muted);
  line-height: 1.4;
}

/* 已选择类型条 — 更显眼 */
.picked {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--m-color-primary) 8%, transparent), color-mix(in srgb, var(--m-color-primary) 4%, transparent));
  border: 1px solid color-mix(in srgb, var(--m-color-primary) 20%, transparent);
  border-radius: var(--m-radius-md);
  margin-bottom: 20px;
  font-size: 14px;
  color: var(--m-color-text-muted);
}

.picked b {
  color: var(--m-color-text);
  font-weight: 600;
}

/* 表单 */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}

.form-grid__full {
  grid-column: 1 / -1;
}

.file-header-check {
  margin-top: 12px;
}

/* 测试连接 */
.test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.test-msg {
  font-size: 12px;
}

.test-msg--ok {
  color: var(--m-color-success);
}

.test-msg--err {
  color: var(--m-color-danger);
}

/* 文件上传 */
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 20px;
  text-align: center;
}

.dropzone__icon {
  color: var(--m-color-primary);
}

.dropzone__text {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 0;
}

.dropzone__tip {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

/* 数据预览 */
.preview__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 16px 0 8px;
}

.preview__table {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  overflow: hidden;
}

.preview__row {
  display: grid;
  border-bottom: 1px solid var(--m-color-split);
}

.preview__row:last-child {
  border-bottom: none;
}

.preview__row--head {
  background: var(--m-color-fill-light);
  font-weight: 600;
}

.preview__cell {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 完成页 — 更宽敞 */
.done-wrap {
  text-align: center;
  padding: 32px 0 16px;
}

.done-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-color-success) 15%, transparent);
  color: var(--m-color-success);
  display: grid;
  place-items: center;
  font-size: 30px;
  margin: 0 auto 20px;
}

.done-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 10px;
}

.done-desc {
  color: var(--m-color-text-muted);
  font-size: 14px;
  margin: 0;
}

.summary {
  margin: 28px auto 0;
  max-width: 420px;
  text-align: left;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  overflow: hidden;
}

.summary__row {
  display: flex;
  justify-content: space-between;
  padding: 12px 18px;
  font-size: 14px;
  border-bottom: 1px solid var(--m-color-split);
}

.summary__row:last-child {
  border-bottom: none;
}

.summary__row span:first-child {
  color: var(--m-color-text-muted);
}

.footer-right {
  display: flex;
  gap: 10px;
}
</style>
