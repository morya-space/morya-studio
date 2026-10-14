<script setup lang="ts">
/**
 * 数据源详情（/datasources/:id）
 * 页面级查看：元信息 + 数据预览表格，可返回数据源列表。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { MButton, MDescriptions, MDescriptionsItem, MEmpty, MStatus, MTable, MTag } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import SvgIcon from '../components/common/SvgIcon.vue'
import type { DataSourceConfig, DataSourceType } from '../types/schema'
import { getDataSource } from '../services/datasource'
import { getAdapter } from '../data/adapters'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const source = ref<DataSourceConfig | null>(null)
const rows = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref('')

const id = computed(() => String(route.params.id ?? ''))

const columns = computed(() => {
  const keys: string[] = []
  for (const row of rows.value.slice(0, 50)) {
    for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k)
  }
  return keys.map(k => ({ key: k, label: k, minWidth: 120 }))
})

function typeLabel(type: DataSourceType): string {
  return t(`datasources.${type}`)
}

const typeTagType = computed<'primary' | 'info' | 'help'>(() => {
  switch (source.value?.type) {
    case 'api': return 'primary'
    case 'mock': return 'help'
    default: return 'info'
  }
})

const endpoint = computed(() => {
  const ds = source.value
  if (!ds) return ''
  if (ds.type === 'api') return ds.url ?? '-'
  return t('datasources.rows', { n: ds.staticData?.length ?? 0 })
})

const statusType = computed<'success' | 'danger' | 'info'>(() => {
  if (error.value) return 'danger'
  if (loading.value) return 'info'
  return 'success'
})

const statusLabel = computed(() => {
  if (error.value) return t('datasources.statusError')
  if (loading.value) return t('datasources.statusLoading')
  return t('datasources.statusOk')
})

async function load() {
  const ds = getDataSource(id.value)
  source.value = ds
  if (!ds) return
  loading.value = true
  error.value = ''
  try {
    rows.value = await getAdapter(ds.type).fetch(ds)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/datasources')
}

onMounted(load)
</script>

<template>
  <WorkspacePage fill :title="source?.name ?? t('pages.datasources.title')" :summary="source ? `${typeLabel(source.type)} · ${endpoint}` : ''">
    <div class="dsd__toolbar">
      <MButton type="text" @click="goBack">
        <SvgIcon name="chevron-left" :px="14" /> {{ t('datasources.backToList') }}
      </MButton>
    </div>

    <MEmpty v-if="!source" :title="t('datasources.notFound')">
      <template #extra>
        <MButton type="primary" @click="goBack">{{ t('datasources.backToList') }}</MButton>
      </template>
    </MEmpty>

    <template v-else>
      <section class="dsd__panel">
        <header class="dsd__panel-head">
          <h2 class="dsd__panel-title">{{ t('datasources.basicInfo') }}</h2>
          <MStatus :label="statusLabel" :type="statusType" />
        </header>
        <MDescriptions bordered :column="3" layout="vertical" size="small">
          <MDescriptionsItem :label="t('datasources.name')">{{ source.name }}</MDescriptionsItem>
          <MDescriptionsItem :label="t('datasources.type')">
            <MTag :type="typeTagType" bordered size="small">{{ typeLabel(source.type) }}</MTag>
          </MDescriptionsItem>
          <MDescriptionsItem label="ID">
            <span class="dsd__mono">{{ source.id }}</span>
          </MDescriptionsItem>
          <MDescriptionsItem :label="t('datasources.detail')">
            <span class="dsd__mono dsd__endpoint">{{ endpoint }}</span>
          </MDescriptionsItem>
          <MDescriptionsItem v-if="source.type === 'api'" label="Method">
            <MTag type="secondary" bordered size="small">{{ source.method ?? 'GET' }}</MTag>
          </MDescriptionsItem>
          <MDescriptionsItem v-if="source.type === 'api' && source.dataPath" label="dataPath">
            <span class="dsd__mono">{{ source.dataPath }}</span>
          </MDescriptionsItem>
          <MDescriptionsItem :label="t('datasources.loadedRows')">{{ t('datasources.rows', { n: rows.length }) }}</MDescriptionsItem>
        </MDescriptions>
      </section>

      <div v-if="error" class="dsd__error" role="alert">{{ error }}</div>

      <section class="dsd__panel dsd__panel--table">
        <header class="dsd__panel-head">
          <h2 class="dsd__panel-title">{{ t('datasources.dataPreview') }}</h2>
          <span class="dsd__panel-hint">{{ t('datasources.rows', { n: rows.length }) }}</span>
        </header>
        <div class="dsd__table">
          <MTable
            :columns="columns"
            :rows="rows"
            :loading="loading"
            fill
            :paginator="true"
            :rows-per-page="15"
            :page-sizes="[15, 30, 50, 100]"
            striped
            :empty-text="t('datasources.noData')"
          />
        </div>
      </section>
    </template>
  </WorkspacePage>
</template>

<style scoped>
.dsd__toolbar {
  display: flex;
  margin: -12px 0 -16px;
}

.dsd__panel {
  background: var(--m-color-surface);
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  overflow: hidden;
}

.dsd__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--m-color-split);
}

.dsd__panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--m-color-text);
}

.dsd__panel-hint {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.dsd__mono {
  font-family: var(--m-font-mono, monospace);
  font-size: 12px;
}

.dsd__endpoint {
  word-break: break-all;
}

.dsd__error {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--m-color-danger) 30%, transparent);
  border-radius: var(--m-radius-md);
  background: color-mix(in srgb, var(--m-color-danger) 8%, var(--m-color-surface));
  color: var(--m-color-danger);
  font-size: 13px;
}

.dsd__panel--table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dsd__table {
  flex: 1;
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.dsd__table > * {
  flex: 1;
  min-height: 0;
}
</style>
