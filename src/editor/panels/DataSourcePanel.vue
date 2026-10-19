<script setup lang="ts">
/**
 * 数据源面板
 * 列出已保存数据源，新建/编辑/删除/测试。
 * MVP：static/api/mock 表单；sql 占位提示。
 */

import { computed, onMounted, ref, watch } from 'vue'
import { MButton, MDialog, MForm, MFormItem, MInput, MInputNumber, MSelect, MSegmented, MTextarea, message } from 'morya-ui'
import type { DataSourceConfig, DataSourceType } from '../../types/schema'
import { listDataSources, saveDataSource, deleteDataSource, genDataSourceId } from '../../services/datasource'
import { useDataStore } from '../../data/store'
import { getAdapter } from '../../data/adapters'
import { formatMockTemplate } from '../../data/mockgen'

const dataStore = useDataStore()
const sources = ref<DataSourceConfig[]>([])

const dialogVisible = ref(false)
const editing = ref<DataSourceConfig | null>(null)
/** 类型守卫：确保 editing 非 null 时模板可安全访问 */
const e = computed(() => editing.value!)
const staticDataText = ref('[]')
const mockTemplateText = ref('')
/** Mock 数据方式：模板生成 / 固定数据（二选一） */
type MockMode = 'template' | 'static'
const mockMode = ref<MockMode>('template')
const MOCK_MODE_OPTIONS = [
  { label: '模板生成', value: 'template' },
  { label: '固定数据', value: 'static' },
]
const testing = ref(false)

const TYPE_OPTIONS = [
  { label: '静态数据', value: 'static' },
  { label: 'REST API', value: 'api' },
  { label: 'Mock', value: 'mock' },
  { label: 'WebSocket', value: 'websocket' },
  { label: 'SQL 查询', value: 'sql' },
]

const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
]

watch(() => e.value?.type, (type) => {
  if (!editing.value) return
  if (type === 'sql' && !editing.value.sql) {
    editing.value.sql = { driver: 'mysql', host: 'localhost', port: 3306, limit: 1000 }
  }
})

function refresh() {
  sources.value = listDataSources()
}

onMounted(() => {
  refresh()
  // 注册到 DataStore 供渲染用
  for (const ds of sources.value) dataStore.registerDataSource(ds)
})

function onAdd() {
  editing.value = {
    id: genDataSourceId(),
    name: '',
    type: 'static',
    staticData: [],
  }
  staticDataText.value = '[]'
  mockTemplateText.value = ''
  mockMode.value = 'template'
  dialogVisible.value = true
}

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
  message.success('已格式化')
}

/** 美化 Mock 固定数据 JSON */
function onFormatMockData() {
  try {
    staticDataText.value = JSON.stringify(JSON.parse(staticDataText.value || '[]'), null, 2)
    message.success('已格式化')
  } catch {
    message.warning('固定数据需为合法的 JSON 数组')
  }
}

function onDelete(ds: DataSourceConfig) {
  if (!ds.id) return
  deleteDataSource(ds.id)
  dataStore.unregisterDataSource(ds.id)
  refresh()
  message.success('已删除')
}

function onSave() {
  const ds = editing.value
  if (!ds) return
  if (!ds.name?.trim()) {
    message.warning('请填写数据源名称')
    return
  }
  if (ds.type === 'api' && !ds.url?.trim()) {
    message.warning('请填写 API 地址')
    return
  }
  // 解析 staticData / mockTemplate
  if (ds.type === 'static') {
    try {
      ds.staticData = JSON.parse(staticDataText.value || '[]')
      if (!Array.isArray(ds.staticData)) throw new Error('not array')
    } catch {
      message.warning('静态数据必须是合法的 JSON 数组')
      return
    }
  }
  if (ds.type === 'mock') {
    if (mockMode.value === 'template') {
      ds.mockTemplate = mockTemplateText.value.trim() || undefined
      if (!ds.mockTemplate) {
        message.warning('请填写 Mock 模板')
        return
      }
      ds.staticData = undefined
    } else {
      try {
        const parsed = JSON.parse(staticDataText.value || '[]')
        if (!Array.isArray(parsed)) throw new Error('not array')
        ds.staticData = parsed
      } catch {
        message.warning('固定数据需为合法的 JSON 数组')
        return
      }
      ds.mockTemplate = undefined
    }
  }
  if (ds.type === 'sql' && !ds.sql?.query?.trim()) {
    message.warning('请填写 SQL 查询语句')
    return
  }
  saveDataSource(ds)
  dataStore.registerDataSource(ds)
  dialogVisible.value = false
  refresh()
  message.success('已保存')
}

async function onTest() {
  const ds = editing.value
  if (!ds) return
  testing.value = true
  try {
    const adapter = getAdapter(ds.type as DataSourceType)
    const result = adapter.test ? await adapter.test(ds) : { ok: true, message: '该类型不支持测试' }
    if (result.ok) message.success(`连接成功：${result.message ?? ''}`)
    else message.error(`测试失败：${result.message ?? ''}`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '测试失败')
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="datasource-panel">
    <div class="panel-header">
      <p class="panel-tip">数据源可跨卡片复用</p>
      <MButton type="primary" size="small" block @click="onAdd">+ 新建数据源</MButton>
    </div>

    <div v-if="sources.length === 0" class="panel-empty">
      还没有数据源，点击上方新建
    </div>

    <ul v-else class="ds-list">
      <li v-for="ds in sources" :key="ds.id" class="ds-item">
        <div class="ds-info">
          <span class="ds-name">{{ ds.name }}</span>
          <span class="ds-type">{{ ds.type }}</span>
        </div>
        <div class="ds-actions">
          <MButton type="text" size="small" @click="onEdit(ds)">编辑</MButton>
          <MButton type="text" size="small" danger @click="onDelete(ds)">删除</MButton>
        </div>
      </li>
    </ul>

    <MDialog v-model="dialogVisible" title="数据源配置" width="480px">
      <MForm v-if="editing" :model="editing">
        <MFormItem label="名称" required>
          <MInput v-model="e.name" placeholder="如：订单 API" fluid />
        </MFormItem>
        <MFormItem label="类型" required>
          <MSelect v-model="e.type" :options="TYPE_OPTIONS" fluid />
        </MFormItem>

        <template v-if="e.type === 'api'">
          <MFormItem label="请求地址" required>
            <MInput v-model="e.url" placeholder="https://api.example.com/data" fluid />
          </MFormItem>
          <MFormItem label="请求方法">
            <MSelect v-model="e.method" :options="METHOD_OPTIONS" fluid />
          </MFormItem>
          <MFormItem label="数据路径" help="如 data.list，留空取整个响应">
            <MInput v-model="e.dataPath" placeholder="data.list" fluid />
          </MFormItem>
          <MFormItem label="轮询间隔(ms)" help="0 表示不轮询">
            <MInputNumber v-model="e.pollInterval" :min="0" fluid />
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'static'">
          <MFormItem label="静态数据(JSON)" required>
            <MTextarea v-model="staticDataText" :rows="8" fluid placeholder='[{"x":"1月","y":100}]' />
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'mock'">
          <MFormItem label="数据方式">
            <MSegmented v-model="mockMode" :options="MOCK_MODE_OPTIONS" />
          </MFormItem>
          <MFormItem
            v-if="mockMode === 'template'"
            label="Mock 模板"
            required
            help="JSON 模板 + {{int 1 100}} 等占位符；顶层 {{repeat N}} 生成 N 行"
          >
            <MTextarea v-model="mockTemplateText" :rows="8" fluid placeholder='{"name":"{{name}}","amount":"{{int 10 999}}","date":"{{date 2024-01-01 2024-12-31}}"}' />
            <div class="flex justify-end">
              <MButton type="default" size="small" :disabled="!mockTemplateText.trim()" @click="onFormatMockTemplate">格式化</MButton>
            </div>
          </MFormItem>
          <MFormItem
            v-else
            label="固定数据(JSON)"
            required
            help="直接作为结果返回，不随机生成"
          >
            <MTextarea v-model="staticDataText" :rows="8" fluid placeholder='[{"x":"1月","y":100}]' />
            <div class="flex justify-end">
              <MButton type="default" size="small" :disabled="!staticDataText.trim()" @click="onFormatMockData">格式化</MButton>
            </div>
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'websocket'">
          <MFormItem label="WebSocket 地址" required>
            <MInput v-model="e.wsUrl" placeholder="wss://example.com/live" fluid />
          </MFormItem>
          <MFormItem label="轮询间隔(ms)" help="0 表示不轮询">
            <MInputNumber v-model="e.pollInterval" :min="0" fluid />
          </MFormItem>
        </template>

        <template v-else-if="e.type === 'sql' && e.sql">
          <MFormItem label="数据库类型">
            <MSelect v-model="e.sql!.driver" :options="[{ label: 'MySQL', value: 'mysql' }, { label: 'PostgreSQL', value: 'postgresql' }, { label: 'SQL Server', value: 'sqlserver' }]" fluid />
          </MFormItem>
          <MFormItem label="主机" required>
            <MInput v-model="e.sql!.host" placeholder="localhost" fluid />
          </MFormItem>
          <MFormItem label="端口">
            <MInputNumber v-model="e.sql!.port" :min="1" :max="65535" fluid />
          </MFormItem>
          <MFormItem label="数据库名">
            <MInput v-model="e.sql!.database" fluid />
          </MFormItem>
          <MFormItem label="用户名">
            <MInput v-model="e.sql!.user" fluid />
          </MFormItem>
          <MFormItem label="密码">
            <MInput type="password" v-model="e.sql!.password" fluid />
          </MFormItem>
          <MFormItem label="查询语句" required help="仅允许 SELECT / WITH 只读查询">
            <MTextarea v-model="e.sql!.query" :rows="5" fluid placeholder="SELECT * FROM orders LIMIT 100" />
          </MFormItem>
          <MFormItem label="行数上限">
            <MInputNumber v-model="e.sql!.limit" :min="1" :max="5000" fluid />
          </MFormItem>
        </template>
      </MForm>

      <template #footer>
        <MButton type="default" :loading="testing" @click="onTest">测试</MButton>
        <MButton type="default" @click="dialogVisible = false">取消</MButton>
        <MButton type="primary" @click="onSave">保存</MButton>
      </template>
    </MDialog>
  </div>
</template>

<style scoped>
.datasource-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-tip {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.panel-empty {
  font-size: 12px;
  color: var(--m-color-text-muted);
  text-align: center;
  padding: 24px 0;
}

.ds-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ds-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: var(--m-color-surface);
}

.ds-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ds-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-type {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.ds-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
