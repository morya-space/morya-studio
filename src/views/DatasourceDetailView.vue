<script setup lang="ts">
/**
 * 数据源详情（/datasources/:id）
 * 页面级查看：元信息 + 数据预览表格，可返回数据源列表。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { MButton, MEmpty, MTable, MTag } from 'morya-ui'
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

const endpoint = computed(() => {
  const ds = source.value
  if (!ds) return ''
  if (ds.type === 'api') return ds.url ?? '-'
  return t('datasources.rows', { n: ds.staticData?.length ?? 0 })
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
  <WorkspacePage :title="source?.name ?? t('pages.datasources.title')" :summary="source ? `${typeLabel(source.type)} · ${endpoint}` : ''">
    <div class="dsd__back">
      <MButton type="default" @click="goBack">
        <SvgIcon name="chevron-left" :px="14" /> {{ t('datasources.backToList') }}
      </MButton>
    </div>

    <MEmpty v-if="!source" :title="t('datasources.notFound')">
      <template #extra>
        <MButton type="primary" @click="goBack">{{ t('datasources.backToList') }}</MButton>
      </template>
    </MEmpty>

    <template v-else>
      <div class="dsd__meta">
        <MTag>{{ typeLabel(source.type) }}</MTag>
        <span class="dsd__id">{{ source.id }}</span>
        <span class="dsd__count">{{ t('datasources.rows', { n: rows.length }) }}</span>
      </div>

      <div v-if="error" class="dsd__error" role="alert">{{ error }}</div>

      <div class="dsd__table">
        <MTable
          :columns="columns"
          :rows="rows"
          :loading="loading"
          :paginator="true"
          :rows-per-page="15"
          :page-sizes="[15, 30, 50, 100]"
          bordered
          striped
          :empty-text="t('datasources.noData')"
        />
      </div>
    </template>
  </WorkspacePage>
</template>

<style scoped>
.dsd__back {
  display: flex;
}

.dsd__meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dsd__id {
  font-size: 12px;
  color: var(--m-color-text-muted);
  font-family: var(--m-font-mono, monospace);
}

.dsd__count {
  margin-left: auto;
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.dsd__error {
  padding: 12px 14px;
  border-radius: var(--m-radius-md);
  background: var(--m-color-danger-soft, var(--m-color-split));
  color: var(--m-color-danger, #d03050);
  font-size: 13px;
}

.dsd__table {
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  overflow: hidden;
  padding: 8px;
}
</style>
