<script setup lang="ts">
/**
 * 数据配置弹窗（v0.4）
 * 六类来源：静态数据 / 动态请求 / Mock / WebSocket / SQL / 引用数据源
 * 结构：来源切换 → 来源专属配置（分区卡片）→ 测试结果 → 过滤器/转换 → 数据映射 → 数据内容
 */

import { computed, ref } from 'vue'
import { MButton, MFormItem, MInput, MInputNumber, MSelect, MTag, MTextarea, message } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { listDataSources } from '../../services/datasource'
import { getAdapter } from '../../data/adapters'
import type { TestResult } from '../../data/adapters/base'
import type { DataSourceConfig, DataSourceType, HttpMethod, RequestBodyType } from '../../types/schema'
import PanelTabs from '../components/PanelTabs.vue'
import KeyValueTable from '../components/KeyValueTable.vue'
import TransformEditor from './TransformEditor.vue'
import DataResultPanel from './DataResultPanel.vue'
import { plain } from '../plain'
import { defaultMockFor } from '../../components/cards/mocks'

const store = useEditorStore()
const dataStore = useDataStore()

const card = computed(() => store.selectedCard)

type SourceMode = 'api' | 'mock' | 'websocket' | 'sql' | 'reference'

const SOURCE_TABS = [
  { label: '请求', value: 'api' },
  { label: 'Mock', value: 'mock' },
  { label: 'WebSocket', value: 'websocket' },
  { label: 'SQL', value: 'sql' },
  { label: '引用', value: 'reference' },
]

const MODE_TYPE: Record<Exclude<SourceMode, 'reference'>, DataSourceType> = {
  api: 'api',
  mock: 'mock',
  websocket: 'websocket',
  sql: 'sql',
}

const mode = computed<SourceMode>(() => {
  const c = card.value
  if (!c) return 'mock'
  if (c.dataSourceId) return 'reference'
  const t = c.dataSource?.type
  // 旧的 static 类型统一归入 Mock（mock 适配器会回退 staticData）
  return (t && t in MODE_TYPE ? t : 'mock') as SourceMode
})

const inlineDs = computed<DataSourceConfig>(() => card.value?.dataSource ?? { type: 'static', staticData: [] })

function patchDs(patch: Partial<DataSourceConfig>): void {
  if (!card.value) return
  const base = plain(inlineDs.value)
  store.updateCardField(card.value.id, 'dataSource', { ...base, ...plain(patch) })
}

function setMode(next: SourceMode): void {
  const c = card.value
  if (!c) return
  if (next === 'reference') {
    const saved = listDataSources().filter(d => d.id)
    if (!saved.length) {
      message.warn('还没有数据源，请先在「数据源」页面创建')
      return
    }
    store.updateCardField(c.id, 'dataSourceId', c.dataSourceId ?? saved[0].id)
    return
  }
  store.updateCardField(c.id, 'dataSourceId', undefined)
  const type = MODE_TYPE[next]
  // 保留已填字段，只切换类型；为新类型补齐必要默认值
  const patch: Partial<DataSourceConfig> = { type }
  if (type === 'mock' && !inlineDs.value.staticData && !inlineDs.value.mockTemplate) {
    patch.staticData = defaultMockFor(c.type)
  }
  if (type === 'api' && inlineDs.value.method === undefined) patch.method = 'GET'
  if (type === 'websocket' && !inlineDs.value.ws) patch.ws = { aggregate: 'first' }
  if (type === 'sql' && !inlineDs.value.sql) {
    patch.sql = { driver: 'mysql', host: '', port: 3306, query: '', limit: 1000 }
  }
  patchDs(patch)
}

/** 来源页签（PanelTabs 需要 string） */
const modeTab = computed({
  get: () => mode.value as string,
  set: (v: string) => setMode(v as SourceMode),
})

function str(key: 'url' | 'dataPath' | 'body' | 'mockTemplate' | 'wsUrl') {
  return computed<string>({
    get: () => (inlineDs.value[key] as string | undefined) ?? '',
    set: v => patchDs({ [key]: v } as Partial<DataSourceConfig>),
  })
}

// ==================== 静态 / Mock 数据 ====================
const staticText = computed({
  get: () => JSON.stringify(inlineDs.value.staticData ?? [], null, 2),
  set: (v: string) => {
    try {
      const parsed = JSON.parse(v || '[]')
      patchDs({ staticData: Array.isArray(parsed) ? parsed : [parsed] })
    } catch { /* 输入中不合法，忽略 */ }
  },
})
const mockTemplate = str('mockTemplate')

const importInput = ref<HTMLInputElement | null>(null)

function formatStatic() {
  staticText.value = JSON.stringify(inlineDs.value.staticData ?? [], null, 2)
  message.success('已格式化')
}
function triggerImport() {
  importInput.value?.click()
}
function importStatic(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  void file.text().then(text => { staticText.value = text; message.success('已导入') })
    .catch(() => message.error('导入失败'))
}

// ==================== 动态请求 ====================
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(v => ({ label: v, value: v }))
const BODY_TYPE_OPTIONS = [
  { label: '无', value: 'none' },
  { label: 'JSON', value: 'json' },
  { label: 'form', value: 'form' },
]
const REQUEST_TABS = [
  { label: 'Params', value: 'params' },
  { label: 'Headers', value: 'headers' },
  { label: 'Body', value: 'body' },
]
const requestTab = ref<string>('params')

const method = computed<string>({
  get: () => inlineDs.value.method ?? 'GET',
  set: v => patchDs({ method: v as HttpMethod }),
})
const url = str('url')
const dataPath = str('dataPath')
const params = computed<Record<string, string>>({
  get: () => (inlineDs.value.params ?? {}) as Record<string, string>,
  set: v => patchDs({ params: v }),
})
const headers = computed<Record<string, string>>({
  get: () => inlineDs.value.headers ?? {},
  set: v => patchDs({ headers: v }),
})
const bodyType = computed<string>({
  get: () => inlineDs.value.bodyType ?? 'none',
  set: v => patchDs({ bodyType: v as RequestBodyType }),
})
const body = str('body')
const timeoutMs = computed<number>({
  get: () => inlineDs.value.timeoutMs ?? 0,
  set: v => patchDs({ timeoutMs: Math.max(0, Number(v) || 0) }),
})

const retryCount = computed({
  get: () => inlineDs.value.retry?.count ?? 0,
  set: (v: number) => patchDs({ retry: { count: Math.max(0, Number(v) || 0), delayMs: inlineDs.value.retry?.delayMs ?? 500 } }),
})
const retryDelay = computed({
  get: () => inlineDs.value.retry?.delayMs ?? 500,
  set: (v: number) => patchDs({ retry: { count: inlineDs.value.retry?.count ?? 0, delayMs: Math.max(0, Number(v) || 0) } }),
})

// 认证
const authType = computed({
  get: () => inlineDs.value.auth?.type ?? 'none',
  set: (v: string) => patchDs({ auth: { ...(inlineDs.value.auth ?? { type: 'none' }), type: v as 'none' | 'bearer' | 'apikey' | 'basic' } }),
})
function patchAuth(patch: Partial<NonNullable<DataSourceConfig['auth']>>) {
  patchDs({ auth: { ...(inlineDs.value.auth ?? { type: 'none' }), ...plain(patch) } })
}

// 轮询间隔（存 ms）+ 单位
type IntervalUnit = 'second' | 'minute' | 'hour'
const INTERVAL_OPTIONS = [
  { label: '秒', value: 'second' },
  { label: '分', value: 'minute' },
  { label: '时', value: 'hour' },
]
const INTERVAL_FACTOR: Record<IntervalUnit, number> = { second: 1000, minute: 60000, hour: 3600000 }
const intervalUnit = ref<IntervalUnit>('second')
const pollInterval = computed<number>({
  get: () => Math.round((inlineDs.value.pollInterval ?? 0) / INTERVAL_FACTOR[intervalUnit.value]),
  set: (v: number) => patchDs({ pollInterval: Math.max(0, Number(v) || 0) * INTERVAL_FACTOR[intervalUnit.value] }),
})

// ==================== WebSocket ====================
const wsUrl = str('wsUrl')
const wsMessagePath = computed({
  get: () => inlineDs.value.ws?.messagePath ?? '',
  set: (v: string) => patchDs({ ws: { ...(inlineDs.value.ws ?? { aggregate: 'first' }), messagePath: v || undefined } }),
})
const wsAggregate = computed({
  get: () => inlineDs.value.ws?.aggregate ?? 'first',
  set: (v: string) => patchDs({ ws: { ...(inlineDs.value.ws ?? {}), aggregate: v as 'first' | 'append' | 'replace' } }),
})

// ==================== SQL ====================
const sql = computed(() => inlineDs.value.sql ?? { driver: 'mysql' as const, host: '', port: 3306, query: '', limit: 1000 })
function patchSql(patch: Record<string, unknown>) {
  patchDs({ sql: { ...plain(sql.value), ...plain(patch) } as DataSourceConfig['sql'] })
}

// ==================== 引用数据源 ====================
const dataSourceId = computed({
  get: () => card.value?.dataSourceId ?? '',
  set: (v: string) => { if (card.value) store.updateCardField(card.value.id, 'dataSourceId', v || undefined) },
})
const savedDataSourceOptions = computed(() => [
  { label: '（未选择）', value: '' },
  ...listDataSources().map(ds => ({ label: `${ds.name ?? ds.id} · ${ds.type}`, value: ds.id ?? '' })),
])
const referenced = computed(() => listDataSources().find(d => d.id === card.value?.dataSourceId) ?? null)
function openDataSources() {
  window.open('/datasources', '_blank')
}

// ==================== 测试 ====================
const testing = ref(false)
const result = ref<TestResult | null>(null)

const testConfig = computed<DataSourceConfig | null>(() => {
  if (mode.value === 'reference') return referenced.value
  return { ...plain(inlineDs.value), type: MODE_TYPE[mode.value] }
})

async function runTest() {
  const cfg = testConfig.value
  if (!cfg || !card.value) return
  const adapter = getAdapter(cfg.type)
  testing.value = true
  result.value = null
  try {
    result.value = adapter.test
      ? await adapter.test(plain(cfg))
      : { ok: true, message: '该类型暂不支持测试' }
  } catch (e) {
    result.value = { ok: false, message: e instanceof Error ? e.message : String(e) }
  } finally {
    testing.value = false
  }
  // 测试后同步刷新卡片数据（画布/预览即时生效）
  if (result.value?.ok) {
    try { await dataStore.refreshCard(card.value) } catch { /* ignore */ }
  }
}

// ==================== 数据映射 / 内容 ====================
const rows = computed(() => (card.value ? dataStore.cardData.get(card.value.id) ?? [] : []))
const fields = computed(() => (rows.value[0] ? Object.keys(rows.value[0]) : []))
const chartCfg = computed(() => card.value?.chart ?? null)

const contentView = ref<string>('table')

const contentJson = computed(() => JSON.stringify(rows.value, null, 2))
const previewRows = computed(() => rows.value.slice(0, 50))

function fieldRole(f: string): string | null {
  const c = chartCfg.value
  if (!c) return null
  if (c.xField === f) return '维度'
  if (c.yField === f) return '数值'
  if (c.seriesField === f) return '系列'
  if (c.subField === f) return '折线'
  return null
}
function bindRole(f: string, role: 'xField' | 'yField' | 'seriesField') {
  if (!card.value) return
  store.updateCardField(card.value.id, `chart.${role}`, f)
  message.success('已绑定')
}

function downloadJson() {
  const blob = new Blob([contentJson.value], { type: 'application/json' })
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = `${card.value?.type ?? 'data'}-data.json`
  a.click()
  URL.revokeObjectURL(u)
}
</script>

<template>
  <div v-if="card" class="data-panel">
    <PanelTabs v-model="modeTab" :options="SOURCE_TABS" />

    <!-- 动态请求 -->
    <section v-if="mode === 'api'" class="dsec">
      <p class="dsec__title">请求配置</p>
      <MFormItem label="请求地址">
        <div class="drow">
          <MSelect v-model="method" :options="METHOD_OPTIONS" class="drow__method" />
          <MInput v-model="url" placeholder="https://api.example.com/data" fluid />
        </div>
      </MFormItem>
      <div class="dgrid">
        <MFormItem label="更新间隔" help="0 = 仅初始化">
          <MInputNumber v-model="pollInterval" :min="0" fluid />
        </MFormItem>
        <MFormItem label="单位"><MSelect v-model="intervalUnit" :options="INTERVAL_OPTIONS" fluid /></MFormItem>
        <MFormItem label="超时(ms)" help="0 = 默认 15000"><MInputNumber v-model="timeoutMs" :min="0" fluid /></MFormItem>
        <MFormItem label="取数路径" help="如 data.list"><MInput v-model="dataPath" placeholder="留空取整个响应" fluid /></MFormItem>
        <MFormItem label="失败重试次数"><MInputNumber v-model="retryCount" :min="0" :max="5" fluid /></MFormItem>
        <MFormItem label="重试间隔(ms)"><MInputNumber v-model="retryDelay" :min="0" fluid /></MFormItem>
      </div>

      <MFormItem label="请求参数">
        <PanelTabs v-model="requestTab" :options="REQUEST_TABS" />
      </MFormItem>
      <KeyValueTable v-if="requestTab === 'params'" v-model="params" key-placeholder="参数名" value-placeholder="值（支持 {{var}}）" />
      <KeyValueTable v-else-if="requestTab === 'headers'" v-model="headers" key-placeholder="Header" value-placeholder="值" />
      <template v-else>
        <MFormItem label="Body 类型"><MSelect v-model="bodyType" :options="BODY_TYPE_OPTIONS" fluid /></MFormItem>
        <MFormItem v-if="bodyType === 'json' || bodyType === 'form'" label="Body 内容" help="留空则用请求参数生成">
          <MTextarea v-model="body" :rows="4" fluid />
        </MFormItem>
      </template>

      <p class="dsec__title">认证</p>
      <div class="dgrid">
        <MFormItem label="认证方式">
          <MSelect v-model="authType" :options="[
            { label: '无', value: 'none' },
            { label: 'Bearer Token', value: 'bearer' },
            { label: 'API Key', value: 'apikey' },
            { label: 'Basic', value: 'basic' },
          ]" fluid />
        </MFormItem>
      </div>
      <template v-if="authType === 'bearer'">
        <MFormItem label="Token"><MInput :model-value="inlineDs.auth?.token ?? ''" @update:model-value="patchAuth({ token: $event as string })" fluid /></MFormItem>
      </template>
      <div v-else-if="authType === 'apikey'" class="dgrid">
        <MFormItem label="Header 名"><MInput :model-value="inlineDs.auth?.apiKeyName ?? ''" placeholder="X-API-Key" @update:model-value="patchAuth({ apiKeyName: $event as string })" fluid /></MFormItem>
        <MFormItem label="值"><MInput :model-value="inlineDs.auth?.apiKeyValue ?? ''" @update:model-value="patchAuth({ apiKeyValue: $event as string })" fluid /></MFormItem>
      </div>
      <div v-else-if="authType === 'basic'" class="dgrid">
        <MFormItem label="用户名"><MInput :model-value="inlineDs.auth?.username ?? ''" @update:model-value="patchAuth({ username: $event as string })" fluid /></MFormItem>
        <MFormItem label="密码"><MInput type="password" :model-value="inlineDs.auth?.password ?? ''" @update:model-value="patchAuth({ password: $event as string })" fluid /></MFormItem>
      </div>

      <div class="dsec__actions">
        <MButton type="primary" size="small" :loading="testing" @click="runTest">测试发送</MButton>
      </div>
    </section>

    <!-- Mock -->
    <section v-else-if="mode === 'mock'" class="dsec">
      <p class="dsec__title">Mock 配置</p>
      <MFormItem label="Mock 模板" help='JSON 模板 + {{int 1 100}} 等占位符；顶层 {{repeat N}} 生成 N 行'>
        <MTextarea v-model="mockTemplate" :rows="6" fluid placeholder='{"name":"{{name}}","amount":"{{int 10 999}}","date":"{{date 2024-01-01 2024-12-31}}"}' />
      </MFormItem>
      <MFormItem label="数据(JSON)" help="模板留空时使用；组件新建时默认即为可渲染的 Mock 数据">
        <MTextarea :model-value="staticText" :rows="5" fluid @update:model-value="staticText = $event as string" />
      </MFormItem>
      <div class="dsec__actions">
        <MButton type="default" size="small" @click="formatStatic">格式化</MButton>
        <MButton type="default" size="small" @click="triggerImport">导入 JSON</MButton>
        <MButton type="default" size="small" :disabled="!rows.length" @click="downloadJson">下载</MButton>
        <input ref="importInput" type="file" accept=".json,application/json,text/plain" class="dsec__file" @change="importStatic">
        <MButton type="primary" size="small" :loading="testing" @click="runTest">测试</MButton>
      </div>
    </section>

    <!-- WebSocket -->
    <section v-else-if="mode === 'websocket'" class="dsec">
      <p class="dsec__title">WebSocket 配置</p>
      <MFormItem label="地址(wsUrl)"><MInput v-model="wsUrl" placeholder="wss://example.com/live" fluid /></MFormItem>
      <div class="dgrid">
        <MFormItem label="消息路径" help="如 data.list"><MInput v-model="wsMessagePath" placeholder="留空取整条消息" fluid /></MFormItem>
        <MFormItem label="聚合方式">
          <MSelect v-model="wsAggregate" :options="[
            { label: '首条', value: 'first' },
            { label: '追加', value: 'append' },
            { label: '覆盖', value: 'replace' },
          ]" fluid />
        </MFormItem>
        <MFormItem label="超时(ms)" help="收集窗口"><MInputNumber v-model="timeoutMs" :min="0" fluid /></MFormItem>
      </div>
      <div class="dsec__actions">
        <MButton type="primary" size="small" :loading="testing" @click="runTest">测试</MButton>
      </div>
    </section>

    <!-- SQL -->
    <section v-else-if="mode === 'sql'" class="dsec">
      <p class="dsec__title">SQL 配置</p>
      <p class="dsec__hint">经后端代理执行只读查询（仅允许 SELECT / WITH）</p>
      <div class="dgrid">
        <MFormItem label="数据库类型">
          <MSelect :model-value="sql.driver ?? 'mysql'" @update:model-value="patchSql({ driver: $event })" :options="[
            { label: 'MySQL', value: 'mysql' },
            { label: 'PostgreSQL', value: 'postgresql' },
            { label: 'SQL Server', value: 'sqlserver' },
          ]" fluid />
        </MFormItem>
        <MFormItem label="主机"><MInput :model-value="sql.host ?? ''" placeholder="localhost" @update:model-value="patchSql({ host: $event })" fluid /></MFormItem>
        <MFormItem label="端口"><MInputNumber :model-value="sql.port ?? 3306" :min="1" :max="65535" @update:model-value="patchSql({ port: $event })" fluid /></MFormItem>
        <MFormItem label="数据库名"><MInput :model-value="sql.database ?? ''" @update:model-value="patchSql({ database: $event })" fluid /></MFormItem>
        <MFormItem label="用户名"><MInput :model-value="sql.user ?? ''" @update:model-value="patchSql({ user: $event })" fluid /></MFormItem>
        <MFormItem label="密码"><MInput type="password" :model-value="sql.password ?? ''" @update:model-value="patchSql({ password: $event })" fluid /></MFormItem>
        <MFormItem label="行数上限"><MInputNumber :model-value="sql.limit ?? 1000" :min="1" :max="5000" @update:model-value="patchSql({ limit: $event })" fluid /></MFormItem>
      </div>
      <MFormItem label="查询语句" help="仅允许 SELECT / WITH 只读查询">
        <MTextarea :model-value="sql.query ?? ''" :rows="5" placeholder="SELECT * FROM orders LIMIT 100" @update:model-value="patchSql({ query: $event })" fluid />
      </MFormItem>
      <div class="dsec__actions">
        <MButton type="primary" size="small" :loading="testing" @click="runTest">测试查询</MButton>
      </div>
    </section>

    <!-- 引用数据源 -->
    <section v-else class="dsec">
      <p class="dsec__title">引用数据源</p>
      <MFormItem label="选择数据源">
        <MSelect v-model="dataSourceId" :options="savedDataSourceOptions" fluid allow-clear />
      </MFormItem>
      <div v-if="referenced" class="dinfo">
        <MTag type="primary" size="small">{{ referenced.type }}</MTag>
        <span class="dinfo__name">{{ referenced.name }}</span>
      </div>
      <p v-else class="dsec__hint">未选择数据源</p>
      <div class="dsec__actions">
        <MButton type="default" size="small" @click="openDataSources">去数据源管理</MButton>
        <MButton type="primary" size="small" :disabled="!referenced" :loading="testing" @click="runTest">测试</MButton>
      </div>
    </section>

    <!-- 测试结果 -->
    <DataResultPanel :result="result" :loading="testing" />

    <!-- 过滤器 / 转换 -->
    <p class="data-sec">过滤器 / 数据转换</p>
    <TransformEditor />

    <!-- 数据映射 -->
    <p class="data-sec">数据映射</p>
    <div v-if="fields.length" class="dfields">
      <div v-for="f in fields" :key="f" class="dfields__row">
        <span class="dfields__name">{{ f }}</span>
        <span v-if="fieldRole(f)" class="dfields__role">{{ fieldRole(f) }}</span>
        <span v-if="chartCfg" class="dfields__bind">
          <MButton type="text" size="small" @click="bindRole(f, 'xField')">维度</MButton>
          <MButton type="text" size="small" @click="bindRole(f, 'yField')">数值</MButton>
          <MButton type="text" size="small" @click="bindRole(f, 'seriesField')">系列</MButton>
        </span>
      </div>
    </div>
    <p v-else class="dsec__hint">暂无数据，先测试或绑定数据源</p>

    <!-- 数据内容 -->
    <div class="data-sec-row">
      <p class="data-sec">数据内容</p>
      <PanelTabs v-model="contentView" :options="[{ label: '表格', value: 'table' }, { label: 'JSON', value: 'json' }]" />
    </div>
    <div v-if="rows.length" class="dcontent">
      <table v-if="contentView === 'table'" class="dcontent__table">
        <thead><tr><th v-for="f in fields" :key="f">{{ f }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, i) in previewRows" :key="i">
            <td v-for="f in fields" :key="f">{{ row[f] ?? '' }}</td>
          </tr>
        </tbody>
      </table>
      <pre v-else class="dcontent__json">{{ contentJson }}</pre>
    </div>
    <p v-else class="dsec__hint">暂无数据</p>
    <div v-if="rows.length" class="dsec__actions">
      <MButton type="default" size="small" @click="downloadJson">下载 JSON</MButton>
    </div>
  </div>
</template>

<style scoped>
.data-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dsec {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
}

.dsec__title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dsec__hint {
  margin: 0;
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.dsec__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dsec__file {
  display: none;
}

.data-sec {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 6px 0 2px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--m-color-split);
}

.data-sec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
}

.data-sec-row .data-sec {
  flex: 1;
  margin: 0;
}

.data-sec-row :deep(.panel-tabs) {
  width: 160px;
}

.dgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}

.drow {
  display: flex;
  gap: 6px;
}

.drow__method {
  width: 110px;
  flex: none;
}

.dinfo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dinfo__name {
  font-size: 13px;
  color: var(--m-color-text);
}

.dfields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dfields__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--m-radius-sm);
  background: var(--m-color-fill-light);
}

.dfields__name {
  font-size: 13px;
  color: var(--m-color-text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dfields__role {
  font-size: 11px;
  font-weight: 600;
  color: var(--m-color-primary);
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
}

.dfields__bind {
  display: flex;
  gap: 2px;
}

.dcontent {
  max-height: 240px;
  overflow: auto;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
}

.dcontent__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.dcontent__table th,
.dcontent__table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--m-color-split);
  white-space: nowrap;
}

.dcontent__table th {
  color: var(--m-color-text-muted);
  font-weight: 600;
  background: var(--m-color-fill-light);
  position: sticky;
  top: 0;
}

.dcontent__json {
  margin: 0;
  padding: 10px;
  font-size: 12px;
  font-family: var(--m-font-mono, monospace);
  color: var(--m-color-text);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
