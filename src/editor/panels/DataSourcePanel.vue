<script setup lang="ts">
/**
 * 数据源面板
 * 列出已保存数据源，新建/编辑/删除/测试。
 * MVP：static/api/mock 表单；sql 占位提示。
 */

import { onMounted, ref } from 'vue'
import { MButton, MDialog, MForm, MFormItem, MInput, MInputNumber, MSelect, MTextarea, message } from 'morya-ui'
import type { DataSourceConfig, DataSourceType } from '../../types/schema'
import { listDataSources, saveDataSource, deleteDataSource, genDataSourceId } from '../../services/datasource'
import { useDataStore } from '../../data/store'
import { getAdapter } from '../../data/adapters'

const dataStore = useDataStore()
const sources = ref<DataSourceConfig[]>([])

const dialogVisible = ref(false)
const editing = ref<DataSourceConfig | null>(null)
const staticDataText = ref('[]')
const testing = ref(false)

const TYPE_OPTIONS = [
  { label: '静态数据', value: 'static' },
  { label: 'REST API', value: 'api' },
  { label: 'Mock', value: 'mock' },
]

const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
]

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
  // 解析 staticData
  if (ds.type === 'static' || ds.type === 'mock') {
    try {
      ds.staticData = JSON.parse(staticDataText.value || '[]')
      if (!Array.isArray(ds.staticData)) throw new Error('not array')
    } catch {
      message.warning('静态数据必须是合法的 JSON 数组')
      return
    }
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
          <MInput v-model="editing.name" placeholder="如：订单 API" fluid />
        </MFormItem>
        <MFormItem label="类型" required>
          <MSelect v-model="editing.type" :options="TYPE_OPTIONS" fluid />
        </MFormItem>

        <template v-if="editing.type === 'api'">
          <MFormItem label="请求地址" required>
            <MInput v-model="editing.url" placeholder="https://api.example.com/data" fluid />
          </MFormItem>
          <MFormItem label="请求方法">
            <MSelect v-model="editing.method" :options="METHOD_OPTIONS" fluid />
          </MFormItem>
          <MFormItem label="数据路径" help="如 data.list，留空取整个响应">
            <MInput v-model="editing.dataPath" placeholder="data.list" fluid />
          </MFormItem>
          <MFormItem label="轮询间隔(ms)" help="0 表示不轮询">
            <MInputNumber v-model="editing.pollInterval" :min="0" fluid />
          </MFormItem>
        </template>

        <template v-else-if="editing.type === 'static' || editing.type === 'mock'">
          <MFormItem label="静态数据(JSON)" required>
            <MTextarea v-model="staticDataText" :rows="8" fluid placeholder='[{"x":"1月","y":100}]' />
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
