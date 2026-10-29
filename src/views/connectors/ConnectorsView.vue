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
  MTextarea,
  message,
} from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { DataSourceConfig } from '../../types/schema'
import { initDataSources, listDataSources, deleteDataSource } from '../../services/datasource'
import { importRowsAsDataSource, importDatabaseAsDataSource, importSqlDataSource, parseFileText } from '../../services/connector'
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
  if (ds.type === 'static') return '文件'
  if (ds.type === 'api') return 'API'
  if (ds.type === 'mock') return 'Mock'
  if (ds.type === 'websocket') return 'WebSocket'
  if (ds.type === 'sql') return 'SQL 查询'
  return ds.type
}

function detailOf(ds: DataSourceConfig): string {
  if (ds.type === 'api') return ds.url ?? '-'
  if (ds.type === 'websocket') return ds.wsUrl ?? '-'
  if (ds.type === 'sql') return ds.sql?.host ? `${ds.sql.host}:${ds.sql.port ?? 3306}/${ds.sql.database ?? ''}` : '-'
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
  driver: 'mysql' as 'mysql' | 'postgresql' | 'sqlserver' | 'rest',
  host: '',
  port: 3306,
  database: '',
  user: '',
  password: '',
  ssl: false,
  query: '',
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
  // 默认端口与驱动
  if (cat.value === 'db') {
    if (DEFAULT_PORT[id]) dbForm.value.port = DEFAULT_PORT[id]
    dbForm.value.driver = id === 'rest' ? 'rest' : (id as 'mysql' | 'postgresql' | 'sqlserver')
    if (id !== 'rest') {
      dbForm.value.query = 'SELECT * FROM ' + (dbForm.value.database || 'your_table') + ' LIMIT 100'
    }
  }
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

async function onTest() {
  testing.value = true
  testMsg.value = null
  try {
    if (cat.value === 'file') {
      if (!fileRows.value) throw new Error(t('connectors.fileEmpty'))
      testMsg.value = { ok: true, text: t('connectors.fileParsed', { n: fileRows.value.length }) }
    } else if (cat.value === 'api') {
      if (!apiForm.value.url.trim()) throw new Error(t('connectors.dbUrlRequired'))
      const r = await getAdapter('api').test!({
        type: 'api',
        url: apiForm.value.url.trim(),
        method: apiForm.value.method,
        dataPath: apiForm.value.dataPath.trim() || undefined,
      })
      testMsg.value = { ok: r.ok, text: r.message ?? '' }
    } else {
      // db：REST 桥接走本地校验；直连走 SQL 代理真实测试
      if (!dbForm.value.host.trim()) throw new Error(t('connectors.testNeedHost'))
      if (dbForm.value.driver === 'rest') {
        testMsg.value = { ok: true, text: t('connectors.testOk') }
      } else {
        if (!dbForm.value.query.trim()) throw new Error('请填写 SQL 查询语句')
        const r = await getAdapter('sql').test!({
          type: 'sql',
          sql: {
            driver: dbForm.value.driver,
            host: dbForm.value.host.trim(),
            port: dbForm.value.port,
            database: dbForm.value.database.trim(),
            user: dbForm.value.user.trim(),
            password: dbForm.value.password,
            query: dbForm.value.query.trim(),
          },
        })
        testMsg.value = { ok: r.ok, text: r.message ?? '' }
      }
    }
    tested.value = testMsg.value.ok
  } catch (e) {
    tested.value = false
    testMsg.value = { ok: false, text: e instanceof Error ? e.message : String(e) }
  } finally {
    testing.value = false
  }
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
        if (dbForm.value.driver === 'rest') {
          // REST 桥接
          const url = `mysql://${dbForm.value.host}:${dbForm.value.port}/${dbForm.value.database}`
          const ds = await importDatabaseAsDataSource({
            name: connName.value.trim(),
            driver: 'rest',
            url,
            dataPath: '',
          })
          createdDsName.value = ds.name ?? ds.id ?? ''
        } else {
          // 数据库直连：生成 sql 数据源，经后端代理执行只读查询
          if (!dbForm.value.query.trim()) {
            message.warn('请填写 SQL 查询语句')
            return
          }
          const ds = await importSqlDataSource({
            name: connName.value.trim(),
            driver: dbForm.value.driver,
            host: dbForm.value.host.trim(),
            port: dbForm.value.port,
            database: dbForm.value.database.trim(),
            user: dbForm.value.user.trim(),
            password: dbForm.value.password,
            query: dbForm.value.query.trim(),
          })
          createdDsName.value = ds.name ?? ds.id ?? ''
        }
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
      <p class="quick-title">{{ t('connectors.quickEntry') }}</p>
      <div class="entry-grid">
        <MCard class="studio-card entry" shadow="always" :bordered="false" role="button" tabindex="0"
          :aria-label="t('connectors.entryFile')"
          @click="openWizard('file')" @keydown.enter="openWizard('file')">
          <span class="entry__icon">
            <SvgIcon name="upload" :px="20" />
          </span>
          <span class="entry__name">{{ t('connectors.entryFile') }}</span>
          <span class="entry__desc">{{ t('connectors.entryFileDesc') }}</span>
        </MCard>
        <MCard class="studio-card entry" shadow="always" :bordered="false" role="button" tabindex="0"
          :aria-label="t('connectors.entryDb')"
          @click="openWizard('db')" @keydown.enter="openWizard('db')">
          <span class="entry__icon">
            <SvgIcon name="database" :px="20" />
          </span>
          <span class="entry__name">{{ t('connectors.entryDb') }}</span>
          <span class="entry__desc">{{ t('connectors.entryDbDesc') }}</span>
        </MCard>
        <MCard class="studio-card entry" shadow="always" :bordered="false" role="button" tabindex="0"
          :aria-label="t('connectors.entryApi')"
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
    <MCard class="studio-card conn-panel" shadow="always" :bordered="false">
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
              <SvgIcon :name="ds.type === 'static' ? 'file' : ds.type === 'api' ? 'api' : ds.type === 'websocket' ? 'sync' : 'database'" :px="14" />
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
          <span>{{ t('connectors.picked') }}：<b class="picked__name">{{ currentSrc?.name }}</b> · {{ CATEGORY_LABEL[cat] }}</span>
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
              <MFormItem v-if="dbForm.driver !== 'rest'" :label="t('connectors.dbQuery')" required class="form-grid__full"
                :help="t('connectors.dbQueryHelp')">
                <MTextarea v-model="dbForm.query" :rows="3" placeholder="SELECT * FROM orders LIMIT 100" fluid />
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

<style scoped lang="scss">
.quick-title {
  margin: 0 0 0.75rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text-muted);
}

.entry-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.entry {
  display: flex;
  cursor: pointer;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  text-align: left;

  &__icon {
    margin-bottom: 0.25rem;
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: var(--m-radius-md);
    background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
    color: var(--m-color-primary);
  }

  &__name {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 600;
    color: var(--m-color-text);
  }

  &__desc {
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--m-color-text-muted);
  }
}

.panel__head {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.panel__title {
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 600;
  color: var(--m-color-text);
}

.panel__actions {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.panel__search {
  width: 220px;
}

.panel__empty {
  padding: 2.5rem 0;
}

.conn-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.conn-table__row {
  display: grid;
  grid-template-columns: 2fr 100px 100px 1fr 200px;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--m-color-split);
  padding: 0.75rem 1.125rem;
  font-size: 13px;

  &--head {
    background: var(--m-color-fill-light);
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    color: var(--m-color-text-muted);
  }
}

.col-name {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-weight: 500;
}

.col-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--m-color-text-muted);
}

.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
}

.conn-avatar {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  flex: none;
  place-items: center;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-fill-lighter);
  color: var(--m-color-text-muted);
}

.conn-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  margin-right: 0.375rem;
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 9999px;
}

.status-unknown {
  font-size: 0.75rem;
  line-height: 1rem;
  color: var(--m-color-text-muted);
}

.conn-steps {
  margin-bottom: 1.5rem;
}

.wizard-body {
  min-height: 320px;
  padding-top: 0.25rem;
}

.cat-tabs {
  margin-bottom: 1.25rem;
}

.src-grid {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.src-card__icon {
  font-size: 22px;
  color: var(--m-color-primary);
}

.src-card__name {
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 600;
  color: var(--m-color-text);
}

.src-card__desc {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--m-color-text-muted);
}

.picked {
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  border: 1px solid color-mix(in srgb, var(--m-color-primary) 20%, transparent);
  border-radius: var(--m-radius-md);
  background: linear-gradient(135deg, color-mix(in srgb, var(--m-color-primary) 8%, transparent), color-mix(in srgb, var(--m-color-primary) 4%, transparent));
  padding: 0.875rem 1.125rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--m-color-text-muted);

  &__name {
    font-weight: 600;
    color: var(--m-color-text);
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 0.875rem;

  &__full {
    grid-column: 1 / -1;
  }
}

.test-row {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.test-msg {
  font-size: 0.75rem;
  line-height: 1rem;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.25rem 1.25rem;
  text-align: center;

  &__icon {
    color: var(--m-color-primary);
  }

  &__text {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 600;
    color: var(--m-color-text);
  }

  &__tip {
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text-muted);
  }
}

.file-header-check {
  margin-top: 0.75rem;
}

.preview__title {
  margin: 1rem 0 0.5rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
}

.preview__table {
  overflow: hidden;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
}

.preview__row {
  display: grid;
  border-bottom: 1px solid var(--m-color-split);

  &--head {
    background: var(--m-color-fill-light);
    font-weight: 600;
  }
}

.preview__cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1rem;
  color: var(--m-color-text);
}

.done-wrap {
  padding: 2rem 0 1rem;
  text-align: center;
}

.done-icon {
  margin: 0 auto 1.25rem;
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--m-color-success) 15%, transparent);
  font-size: 30px;
  color: var(--m-color-success);
}

.done-title {
  margin: 0 0 0.625rem;
  font-size: 1.125rem;
  line-height: 1.75rem;
  font-weight: 700;
  color: var(--m-color-text);
}

.done-desc {
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--m-color-text-muted);
}

.summary {
  margin: 1.75rem auto 0;
  max-width: 420px;
  overflow: hidden;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  text-align: left;
}

.summary__row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--m-color-split);
  padding: 0.75rem 1.125rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.footer-right {
  display: flex;
  gap: 0.625rem;
}

.conn-table__row,
.preview__row,
.summary__row {
  &:last-child {
    border-bottom: none;
  }
}

.summary__row {
  span:first-child {
    color: var(--m-color-text-muted);
  }
}

.status-dot {
  &--ok {
    background: var(--m-color-success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--m-color-success) 15%, transparent);
  }

  &--err {
    background: var(--m-color-danger);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--m-color-danger) 15%, transparent);
  }
}

.status-ok,
.test-msg--ok {
  color: var(--m-color-success);
  font-size: 12px;
}

.status-err,
.test-msg--err {
  color: var(--m-color-danger);
  font-size: 12px;
}

.src-card {
  display: flex;
  cursor: pointer;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  border: 1.5px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
  padding: 1.125rem 1rem;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;

  &:hover {
    border-color: var(--m-color-primary);
    background: color-mix(in srgb, var(--m-color-primary) 5%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  }

  &--selected {
    border-color: var(--m-color-primary);
    background: color-mix(in srgb, var(--m-color-primary) 8%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--m-color-primary) 15%, transparent);
  }
}
</style>
