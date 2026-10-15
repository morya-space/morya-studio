<script setup lang="ts">
/**
 * 数据源详情（/datasources/:id）— 全屏独立页
 * 页头 + KPI + Tabs(概览/字段/预览/同步/看板)
 * 数据来自后端 API，非 mock。
 * 组件优先 morya-ui（MCard / MTag / MProgressBar / MTable），布局样式用 UnoCSS。
 */

import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  MButton,
  MCard,
  MEmpty,
  MInput,
  MLoading,
  MProgressBar,
  MTable,
  MTabs,
  MTag,
  message,
  type TableColumnDefinition,
} from 'morya-ui'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { DataSourceDetail } from '../../services/datasource/detail'
import { getDataSourceDetail, testDataSourceConnection, syncDataSource } from '../../services/datasource/detail'
import { useECharts } from '../../composables/useECharts'
import type { ChartConfig } from '../../types/schema'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// ---------- 数据源详情 ----------
const detail = ref<DataSourceDetail | null>(null)
/** 类型守卫：确保 detail 非 null 时模板可安全访问 */
const d = computed(() => detail.value!)
const loading = ref(true)
const activeTab = ref('overview')
const fieldSearch = ref('')
const testing = ref(false)
const syncing = ref(false)

const id = computed(() => String(route.params.id ?? ''))

// 从后端 API 获取数据源详情
onMounted(async () => {
  loading.value = true
  try {
    detail.value = await getDataSourceDetail(id.value)
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('dsd.notFound'))
  } finally {
    loading.value = false
  }
})

// ---------- Tab 配置 ----------
const tabs = computed(() => [
  { label: t('dsd.overview'), value: 'overview' },
  { label: `${t('dsd.fields')} ${detail.value?.fields.length ?? 0}`, value: 'fields' },
  { label: t('dsd.preview'), value: 'preview' },
  { label: t('dsd.sync'), value: 'sync' },
  { label: t('dsd.boards'), value: 'boards' },
])

// ---------- 字段过滤 ----------
const filteredFields = computed(() => {
  if (!detail.value) return []
  const kw = fieldSearch.value.toLowerCase()
  if (!kw) return detail.value.fields
  return detail.value.fields.filter(
    f => f[0].toLowerCase().includes(kw) || f[3].toLowerCase().includes(kw),
  )
})

// ---------- 字段表（MTable） ----------
const fieldRows = computed(() =>
  filteredFields.value.map(f => ({
    name: f[0],
    type: f[1],
    required: f[2],
    comment: f[3],
    example: f[4],
    pct: f[5],
    missing: f[6],
  })),
)

const fieldTableCols = computed<TableColumnDefinition[]>(() => [
  { key: 'name', label: t('dsd.fieldName'), minWidth: 140 },
  { key: 'type', label: t('dsd.fieldType'), minWidth: 110 },
  { key: 'required', label: t('dsd.fieldRequired'), width: 96 },
  { key: 'comment', label: t('dsd.fieldComment'), minWidth: 200 },
  { key: 'example', label: t('dsd.fieldExample'), minWidth: 120 },
  { key: 'missing', label: t('dsd.fieldMissing'), width: 150 },
  { key: 'act', label: '', width: 80, align: 'end' },
])

// ---------- ECharts 柱状图 ----------
const chartData = computed(() => {
  if (!detail.value) return []
  const c = detail.value.chart
  return c.labels.map((label, i) => ({
    x: label,
    y: c.vals[i] ?? 0,
  }))
})

const chartConfig = computed<ChartConfig>(() => ({
  chartType: 'bar',
  xField: 'x',
  yField: 'y',
  showGrid: true,
  showTooltip: true,
  showLegend: false,
}))

const { containerRef: chartRef, setOption: setChartOption } = useECharts(chartConfig.value, chartData)
void chartRef // template ref usage

// 数据变化时更新图表
watch(chartData, () => {
  if (!detail.value) return
  const c = detail.value.chart
  setChartOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: c.labels },
    yAxis: { type: 'value', max: c.max },
    series: [{
      type: 'bar',
      data: c.vals,
      barWidth: '60%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: (params: { dataIndex: number }) => {
          const isLast = params.dataIndex === c.vals.length - 1
          return isLast
            ? 'var(--m-color-primary)'
            : 'color-mix(in srgb, var(--m-color-primary) 55%, transparent)'
        },
      },
    }],
  })
}, { deep: true })

// ---------- 预览表 ----------
const previewCols = computed(() => detail.value?.preview[1] ?? [])
const previewRows = computed(() => {
  const rows = detail.value?.preview[2] ?? []
  return rows.map(r => {
    const obj: Record<string, string> = {}
    previewCols.value.forEach((col, i) => { obj[col] = r[i] ?? '' })
    return obj
  })
})

const previewTableCols = computed(() =>
  previewCols.value.map(k => ({ key: k, label: k, minWidth: 100 })),
)

// ---------- 操作 ----------
function goBack() {
  router.push('/datasources')
}

async function onTest() {
  if (!detail.value || testing.value) return
  testing.value = true
  try {
    const result = await testDataSourceConnection(id.value)
    if (result.ok) message.success(result.message ?? detail.value.testOk)
    else message.error(result.message ?? t('common.error'))
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    testing.value = false
  }
}

async function onSync() {
  if (!detail.value || syncing.value) return
  syncing.value = true
  try {
    const result = await syncDataSource(id.value)
    if (result.ok) message.success(result.message ?? detail.value.syncOk)
    else message.error(result.message ?? t('common.error'))
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    syncing.value = false
  }
}

function onGenBoard() {
  message.info(`基于「${detail.value?.name}」（${detail.value?.type}）生成看板`)
}

function onExportDict() {
  message.success(`字段字典已导出 · ${detail.value?.fields.length ?? 0} 个字段`)
}

// ---------- 同步记录状态 → MTag 语义色 ----------
const toneMap: Record<string, 'success' | 'info' | 'danger'> = {
  '成功': 'success',
  '失败': 'danger',
  '进行中': 'info',
  '异常': 'danger',
}

// ---------- 图标映射（按数据源类型） ----------
const TYPE_ICON_MAP: Record<string, string> = {
  static: 'database',
  api: 'api',
  mock: 'doc',
  websocket: 'hive',
  sql: 'database',
}

</script>

<template>
  <div class="h-full w-full overflow-hidden bg-page-bg px-8 py-6 flex flex-col">
    <!-- 顶部工具栏 -->
    <div class="mb-5 flex flex-wrap items-center gap-3">
      <MButton type="text" @click="goBack">
        <SvgIcon name="chevron-left" :px="14" /> {{ t('dsd.backToList') }}
      </MButton>
    </div>

    <MEmpty v-if="!loading && !detail" :title="t('dsd.notFound')">
      <template #extra>
        <MButton type="primary" @click="goBack">{{ t('dsd.backToList') }}</MButton>
      </template>
    </MEmpty>

    <div v-else-if="loading" class="flex h-full items-center justify-center">
      <MLoading :text="t('common.loading')" />
    </div>

    <template v-else>
      <!-- 页头 -->
      <div class="mb-4 flex flex-wrap items-start gap-3">
        <span class="chip-primary size-10">
          <SvgIcon :name="TYPE_ICON_MAP[d.icon] ?? 'database'" :px="22" />
        </span>
        <div class="min-w-[200px] flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xl font-medium text-text">{{ d.name }}</span>
            <MTag size="small">{{ d.type }}</MTag>
            <MTag size="small" type="success">{{ t('dsd.connected') }}</MTag>
          </div>
          <div class="mt-1 text-[13px] text-text-muted">{{ d.desc }}</div>
        </div>
        <div class="flex items-center gap-2">
          <MButton :loading="testing" @click="onTest">{{ t('dsd.testConn') }}</MButton>
          <MButton type="primary" :loading="syncing" @click="onSync">
            <SvgIcon name="sync" :px="14" class="mr-1" />
            {{ syncing ? t('dsd.syncing') : t('dsd.syncNow') }}
          </MButton>
        </div>
      </div>

      <!-- KPI 指标条 -->
      <div class="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <MCard v-for="(kpi, i) in d.kpis" :key="i">
          <div class="text-xs text-text-muted">{{ kpi[0] }}</div>
          <div
            class="mt-1 text-[26px] font-semibold leading-tight tabular-nums text-text"
            :class="{ 'text-success': kpi[3] === 'pos' }"
          >
            {{ kpi[1] }}
          </div>
          <div class="mt-0.5 text-xs text-text-muted">{{ kpi[2] }}</div>
        </MCard>
      </div>

      <!-- 标签页 -->
      <MTabs v-model="activeTab" class="custom-tabs flex-auto h-0 flex flex-col" :tabs="tabs">
        <template #default="{ activeValue }">
          <!-- 概览 -->
          <div v-if="activeValue === 'overview'" class="grid gap-3 max-lg:grid-cols-1 lg:grid-cols-[1fr_300px]">
            <div class="flex min-w-0 flex-col gap-3">
              <!-- 图表卡片 -->
              <MCard>
                <div class="mb-3 flex items-center justify-between">
                  <span class="text-[15px] font-medium text-text">{{ d.chart.title }}</span>
                  <MTag size="small">{{ d.chart.tag }}</MTag>
                </div>
                <div class="relative h-[200px]">
                  <div ref="chartRef" class="h-full w-full" />
                </div>
              </MCard>
              <!-- 连接信息 -->
              <MCard>
                <span class="mb-3 block text-[15px] font-medium text-text">{{ d.connTitle }}</span>
                <div class="grid gap-3 text-sm [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                  <div v-for="(c, i) in d.conn" :key="i">
                    <div class="text-xs text-text-muted">{{ c[0] }}</div>
                    <div class="dsd-mono mt-0.5 text-text">{{ c[1] }}</div>
                  </div>
                </div>
              </MCard>
            </div>
            <div class="flex flex-col gap-3 max-lg:flex-row max-lg:flex-wrap max-lg:[&>*]:min-w-[200px]">
              <!-- 数据质量 -->
              <MCard>
                <span class="mb-3 block text-[15px] font-medium text-text">{{ t('dsd.quality') }}</span>
                <div class="flex flex-col gap-2.5 text-sm">
                  <div v-for="(q, i) in d.quality" :key="i">
                    <div class="flex items-center justify-between">
                      <span class="text-text-muted">{{ q[0] }}</span>
                      <span class="tabular-nums text-text">{{ q[1] }}%</span>
                    </div>
                    <MProgressBar
                      class="mt-1"
                      :value="Number(q[1])"
                      :status="q[2] === 'warning' ? 'warning' : 'success'"
                      :show-value="false"
                    />
                  </div>
                </div>
              </MCard>
              <!-- 标签 -->
              <MCard>
                <span class="mb-3 block text-[15px] font-medium text-text">{{ t('dsd.tags') }}</span>
                <div class="flex flex-wrap gap-1.5">
                  <MTag v-for="(tag, i) in d.tags" :key="i" size="small" type="secondary">{{ tag }}</MTag>
                </div>
              </MCard>
              <!-- 生成看板 -->
              <MButton type="primary" class="h-9 w-full" @click="onGenBoard">
                {{ t('dsd.genBoard') }}
              </MButton>
            </div>
          </div>

          <!-- 字段 -->
          <div class="w-full h-full overflow-hidden" v-else-if="activeValue === 'fields'">
            <MCard class="dsd-card--flush">
              <template #header>
                <div class="flex items-center gap-2">
                  <MInput
                    v-model="fieldSearch"
                    :placeholder="t('dsd.searchFields')"
                    clearable
                    class="w-60"
                  >
                    <template #prefix>
                      <SvgIcon name="search" :px="14" />
                    </template>
                  </MInput>
                  <span class="text-xs text-text-muted">
                    {{ t('dsd.fieldCount', { n: filteredFields.length, total: d.fields.length }) }}
                  </span>
                  <span class="flex-1" />
                  <MButton size="small" @click="onExportDict">{{ t('dsd.exportDict') }}</MButton>
                </div>
              </template>
              <MTable
                :columns="fieldTableCols"
                :rows="fieldRows"
                :empty-text="t('dsd.noData')"
                fill
              >
                <template #cell-name="{ row }">
                  <span class="dsd-mono text-[13px] text-text">{{ row.name }}</span>
                </template>
                <template #cell-type="{ row }">
                  <span class="dsd-mono text-text-muted">{{ row.type }}</span>
                </template>
                <template #cell-example="{ row }">
                  <span class="dsd-mono text-text-muted">{{ row.example }}</span>
                </template>
                <template #cell-missing="{ row }">
                  <div class="flex items-center gap-1.5">
                    <MProgressBar
                      class="flex-1"
                      :value="Number(row.missing)"
                      :color="Number(row.missing) > 10 ? 'var(--m-color-warning)' : 'var(--m-color-text-muted)'"
                      :show-value="false"
                    />
                    <span class="text-xs tabular-nums text-text-muted">{{ row.pct }}</span>
                  </div>
                </template>
                <template #cell-act>
                  <span class="row-act cursor-pointer">{{ t('dsd.analyze') }}</span>
                </template>
              </MTable>
            </MCard>
          </div>

          <!-- 预览 -->
          <div class="w-full h-full overflow-hidden" v-else-if="activeValue === 'preview'">
            <MCard class="dsd-card--flush">
              <template #header>
                <div class="flex items-center gap-2 text-sm text-text-muted">
                  <MTag size="small" class="dsd-mono">{{ d.preview[0] }}</MTag>
                  <span>{{ t('dsd.previewHint') }}</span>
                </div>
              </template>
              <MTable
                :columns="previewTableCols"
                :rows="previewRows"
                :empty-text="t('dsd.noData')"
                striped
              />
            </MCard>
          </div>

          <!-- 同步记录 -->
          <div class="w-full h-full overflow-hidden" v-else-if="activeValue === 'sync'">
            <MCard class="dsd-card--list">
              <div
                v-for="(s, i) in d.syncs" :key="i"
                class="sync-row flex items-center gap-3 border-b border-border py-3 text-sm last:border-b-0"
              >
                <span class="w-[76px] flex-none text-text-muted tabular-nums">{{ s[0] }}</span>
                <span class="w-[68px] flex-none text-text">{{ s[1] }}</span>
                <MTag size="small" :type="toneMap[s[2]] ?? 'success'">{{ s[2] }}</MTag>
                <span class="flex-1 text-text-muted">{{ s[3] }}</span>
                <span v-if="s[2] === '失败'" class="row-act cursor-pointer">{{ t('dsd.viewLog') }}</span>
              </div>
            </MCard>
          </div>

          <!-- 关联看板 -->
          <div v-else-if="activeValue === 'boards'" class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <MCard v-for="(b, i) in d.boards" :key="i" class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="text-text-muted"><SvgIcon name="bar-chart" :px="18" /></span>
                <span class="text-sm font-medium text-text">{{ b[0] }}</span>
              </div>
              <div class="text-xs text-text-muted">{{ b[1] }}</div>
              <div class="mt-1 flex gap-2">
                <MButton size="small">{{ t('dsd.openBoard') }}</MButton>
                <MButton size="small">{{ t('dsd.lineage') }}</MButton>
              </div>
            </MCard>
          </div>
        </template>
      </MTabs>
    </template>
  </div>
</template>

<style scoped lang="scss">
/* MCard 内表格贴边 */
.dsd-card--flush {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.m-card__body) {
    flex: 1 1 auto;
    height: 0;
  }
  /* padding: 0; */
}

/* 同步记录卡收窄内边距 */
.dsd-card--list :deep(.m-card__body) {
  /* padding: 4px 16px; */
}

.custom-tabs {
  :deep(.m-tabs__panel) {
    flex: 1 1 auto;
    height: 0;
  }
}

/* 行内 hover 操作（MTable 行 / 同步记录行共用） */
.row-act {
  opacity: 0;
  transition: opacity 0.12s ease-out;
  font-family: var(--m-font-mono, monospace);
  font-size: 12px;
  color: var(--m-color-text-muted);
}

:deep(.m-table__body tr:hover) .row-act,
.sync-row:hover .row-act {
  opacity: 1;
}

/* 等宽字体（token 未提供时回退系统 mono） */
.dsd-mono {
  font-family: var(--m-font-mono, monospace);
}
</style>
