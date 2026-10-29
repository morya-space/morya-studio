<script setup lang="ts">
/**
 * 数据源详情（/datasources/:id）— 全屏独立页
 * 页头 + KPI + Tabs(概览/字段/预览/同步/看板)
 * 数据来自后端 API，非 mock。
 * 组件优先 morya-ui（MCard / MTag / MProgressBar / MTable），布局样式为 scoped SCSS。
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
import ComputedFieldsEditor from '../../editor/panels/ComputedFieldsEditor.vue'
import type { DataSourceDetail } from '../../services/datasource/detail'
import { getDataSourceDetail, testDataSourceConnection, syncDataSource } from '../../services/datasource/detail'
import { getDataSource, initDataSources, saveDataSource } from '../../services/datasource'
import { useDataStore } from '../../data/store'
import { applyComputedFields } from '../../data/transform/pipeline'
import { inferFieldProfiles } from '../../data/field-profile'
import { useECharts } from '../../composables/useECharts'
import type { ChartConfig, ComputedField, DataSourceConfig } from '../../types/schema'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const dataStore = useDataStore()

// ---------- 数据源详情 ----------
const detail = ref<DataSourceDetail | null>(null)
/** 可编辑的数据源配置（计算列写在这里） */
const source = ref<DataSourceConfig | null>(null)
const computedFields = ref<ComputedField[]>([])
const savingComputed = ref(false)
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
    const [loaded] = await Promise.all([
      getDataSourceDetail(id.value),
      initDataSources(),
    ])
    detail.value = loaded
    source.value = getDataSource(id.value)
    computedFields.value = source.value?.computedFields?.map(f => ({ ...f })) ?? []
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('dsd.notFound'))
  } finally {
    loading.value = false
  }
})

const computedProfiles = computed(() => {
  const rows = source.value?.staticData
  if (rows?.length) return inferFieldProfiles(rows)
  return (detail.value?.fields ?? []).map(f => ({
    key: f[0],
    label: f[0],
    valueKind: 'unknown' as const,
    semanticHint: 'unknown' as const,
    nullable: false,
    sampleValues: [],
  }))
})

const enrichedRows = computed(() =>
  applyComputedFields(source.value?.staticData ?? [], computedFields.value),
)

function formatComputedValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const s = String(value)
  if (s.length <= 4) return s
  return `${s.slice(0, 2)}****${s.slice(-2)}`
}

const computedFieldNames = computed(() =>
  computedFields.value.map(f => f.name.trim()).filter(Boolean),
)

// ---------- Tab 配置 ----------
const visibleFieldCount = computed(() => {
  const base = new Set(detail.value?.fields.map(f => f[0]) ?? [])
  const extra = computedFieldNames.value.filter(name => !base.has(name)).length
  return base.size + extra
})

const tabs = computed(() => [
  { label: t('dsd.overview'), value: 'overview' },
  { label: `${t('dsd.fields')} ${visibleFieldCount.value}`, value: 'fields' },
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
const fieldRows = computed(() => {
  const base = filteredFields.value.map(f => ({
    name: f[0],
    type: f[1],
    required: f[2],
    comment: f[3],
    example: f[4],
    pct: f[5],
    missing: f[6],
    computed: false,
  }))
  const kw = fieldSearch.value.toLowerCase()
  const names = new Set(base.map(row => row.name))
  const extra = computedFieldNames.value
    .filter(name => !names.has(name))
    .filter(name => {
      if (!kw) return true
      const expr = computedFields.value.find(f => f.name.trim() === name)?.expr ?? ''
      return name.toLowerCase().includes(kw) || expr.toLowerCase().includes(kw)
    })
    .map(name => {
      const expr = computedFields.value.find(f => f.name.trim() === name)?.expr ?? ''
      const sample = enrichedRows.value.find(row => row[name] !== undefined && row[name] !== null)?.[name]
      return {
        name,
        type: t('dsd.computedCol'),
        required: '否',
        comment: expr,
        example: formatComputedValue(sample),
        pct: '0.0%',
        missing: '0',
        computed: true,
      }
    })
  return [...base, ...extra]
})

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
    yAxis: { type: 'value', max: Number(c.max.toFixed(0)) },
    series: [{
      type: 'bar',
      data: c.vals,
      barWidth: '60%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
      },
    }],
  })
}, { deep: true })

// ---------- 预览表 ----------
const previewCols = computed(() => {
  const base = detail.value?.preview[1] ?? []
  const extra = computedFieldNames.value.filter(name => !base.includes(name))
  return [...base, ...extra]
})
const previewRows = computed(() => {
  const rows = detail.value?.preview[2] ?? []
  const baseCols = detail.value?.preview[1] ?? []
  return rows.map((r, rowIndex) => {
    const obj: Record<string, string> = {}
    baseCols.forEach((col, i) => { obj[col] = r[i] ?? '' })
    for (const name of computedFieldNames.value) {
      if (baseCols.includes(name)) continue
      obj[name] = formatComputedValue(enrichedRows.value[rowIndex]?.[name])
    }
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
  message.success(`字段字典已导出 · ${visibleFieldCount.value} 个字段`)
}

function onComputedFields(fields: ComputedField[]) {
  computedFields.value = fields
}

async function saveComputed() {
  const ds = source.value
  if (!ds?.id || savingComputed.value) return
  savingComputed.value = true
  try {
    const kept = computedFields.value
      .map(f => ({ name: f.name.trim(), expr: f.expr }))
      .filter(f => f.name || f.expr.trim())
    const next: DataSourceConfig = { ...ds, computedFields: kept.length ? kept : undefined }
    await saveDataSource(next)
    source.value = getDataSource(ds.id) ?? next
    computedFields.value = source.value.computedFields?.map(f => ({ ...f })) ?? []
    dataStore.registerDataSource(source.value)
    message.success(t('dsd.computedSaved'))
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    savingComputed.value = false
  }
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
    <div class="dsd">
      <!-- 页头：返回 + 数据源信息 + 操作 -->
      <header class="dsd-header">
        <MButton type="text" @click="goBack">
          <SvgIcon name="chevron-left" :px="14" /> {{ t('dsd.backToList') }}
        </MButton>
        <template v-if="detail">
          <span class="dsd-header__divider" />
          <span class="dsd-header__icon">
            <SvgIcon :name="TYPE_ICON_MAP[d.icon] ?? 'database'" :px="22" />
          </span>
          <div class="dsd-header__info">
            <div class="dsd-header__name-row">
              <span class="dsd-header__name">{{ d.name }}</span>
              <MTag size="small">{{ d.type }}</MTag>
              <MTag size="small" type="success">{{ t('dsd.connected') }}</MTag>
            </div>
            <div class="dsd-header__desc">{{ d.desc }}</div>
          </div>
          <div class="dsd-toolbar">
            <MButton :loading="testing" @click="onTest">{{ t('dsd.testConn') }}</MButton>
            <MButton type="primary" :loading="syncing" @click="onSync">
              <SvgIcon name="sync" :px="14" class="dsd-header__sync-icon" />
              {{ syncing ? t('dsd.syncing') : t('dsd.syncNow') }}
            </MButton>
          </div>
        </template>
      </header>

      <!-- 内容区 -->
      <div class="dsd-body">
      <MEmpty v-if="!loading && !detail" :title="t('dsd.notFound')">
      <template #extra>
        <MButton type="primary" @click="goBack">{{ t('dsd.backToList') }}</MButton>
      </template>
    </MEmpty>

    <div v-else-if="loading" class="dsd-loading">
      <MLoading :text="t('common.loading')" />
    </div>

    <template v-else>
      <!-- KPI 指标条 -->
      <div class="dsd-kpis">
        <MCard v-for="(kpi, i) in d.kpis" :key="i">
          <div class="dsd-note">{{ kpi[0] }}</div>
          <div
            class="dsd-kpi__value"
            :class="{ 'dsd-kpi__value--pos': kpi[3] === 'pos' }"
          >
            {{ kpi[1] }}
          </div>
          <div class="dsd-hint">{{ kpi[2] }}</div>
        </MCard>
      </div>

      <!-- 标签页 -->
      <MTabs v-model="activeTab" class="custom-tabs" :tabs="tabs">
        <template #default="{ activeValue }">
          <!-- 概览 -->
          <div v-if="activeValue === 'overview'" class="dsd-overview">
            <div class="dsd-overview__main">
              <!-- 图表卡片 -->
              <MCard>
                <div class="dsd-card__head">
                  <span class="dsd-card__title">{{ d.chart.title }}</span>
                  <MTag size="small">{{ d.chart.tag }}</MTag>
                </div>
                <div class="dsd-chart">
                  <div ref="chartRef" class="dsd-chart__el" />
                </div>
              </MCard>
              <!-- 连接信息 -->
              <MCard>
                <span class="dsd-card__heading">{{ d.connTitle }}</span>
                <div class="dsd-conn">
                  <div v-for="(c, i) in d.conn" :key="i">
                    <div class="dsd-note">{{ c[0] }}</div>
                    <div class="dsd-mono dsd-conn__value">{{ c[1] }}</div>
                  </div>
                </div>
              </MCard>
            </div>
            <div class="dsd-overview__side">
              <!-- 数据质量 -->
              <MCard>
                <span class="dsd-card__heading">{{ t('dsd.quality') }}</span>
                <div class="dsd-quality">
                  <div v-for="(q, i) in d.quality" :key="i">
                    <div class="dsd-quality__row">
                      <span class="dsd-quality__label">{{ q[0] }}</span>
                      <span class="dsd-quality__value">{{ q[1] }}%</span>
                    </div>
                    <MProgressBar
                      class="dsd-quality__bar"
                      :value="Number(q[1])"
                      :status="q[2] === 'warning' ? 'warning' : 'success'"
                      :show-value="false"
                    />
                  </div>
                </div>
              </MCard>
              <!-- 标签 -->
              <MCard>
                <span class="dsd-card__heading">{{ t('dsd.tags') }}</span>
                <div class="dsd-tags">
                  <MTag v-for="(tag, i) in d.tags" :key="i" size="small" type="secondary">{{ tag }}</MTag>
                </div>
              </MCard>
              <!-- 生成看板 -->
              <MButton type="primary" class="dsd-gen" @click="onGenBoard">
                {{ t('dsd.genBoard') }}
              </MButton>
            </div>
          </div>

          <!-- 字段 -->
          <div class="dsd-fields" v-else-if="activeValue === 'fields'">
            <MCard>
              <div class="dsd-fields__head">
                <div class="dsd-header__info">
                  <div class="dsd-card__title">{{ t('dsd.computed') }}</div>
                  <div class="dsd-hint">{{ t('dsd.computedHint') }}</div>
                </div>
                <MButton type="primary" size="small" :loading="savingComputed" :disabled="!source" @click="saveComputed">
                  {{ t('dsd.computedSave') }}
                </MButton>
              </div>
              <ComputedFieldsEditor
                v-if="source"
                :fields="computedFields"
                :profiles="computedProfiles"
                @update:fields="onComputedFields"
              />
              <p v-else class="dsd-note">{{ t('dsd.notFound') }}</p>
            </MCard>
            <MCard class="dsd-card--flush dsd-card--fields">
              <template #header>
                <div class="dsd-toolbar">
                  <MInput
                    v-model="fieldSearch"
                    :placeholder="t('dsd.searchFields')"
                    clearable
                    class="dsd-fields__search"
                  >
                    <template #prefix>
                      <SvgIcon name="search" :px="14" />
                    </template>
                  </MInput>
                  <span class="dsd-note">
                    {{ t('dsd.fieldCount', { n: fieldRows.length, total: visibleFieldCount }) }}
                  </span>
                  <span class="dsd-spacer" />
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
                  <span class="dsd-mono dsd-cell-name">{{ row.name }}</span>
                </template>
                <template #cell-type="{ row }">
                  <MTag v-if="row.computed" size="small">{{ row.type }}</MTag>
                  <span v-else class="dsd-mono dsd-cell-muted">{{ row.type }}</span>
                </template>
                <template #cell-example="{ row }">
                  <span class="dsd-mono dsd-cell-muted">{{ row.example }}</span>
                </template>
                <template #cell-missing="{ row }">
                  <div class="dsd-missing">
                    <MProgressBar
                      class="dsd-missing__bar"
                      :value="Number(row.missing)"
                      :color="Number(row.missing) > 10 ? 'var(--m-color-warning)' : 'var(--m-color-text-muted)'"
                      :show-value="false"
                    />
                    <span class="dsd-missing__pct">{{ row.pct }}</span>
                  </div>
                </template>
                <template #cell-act>
                  <span class="row-act dsd-mono dsd-row-act">{{ t('dsd.analyze') }}</span>
                </template>
              </MTable>
            </MCard>
          </div>

          <!-- 预览 -->
          <div class="dsd-pane" v-else-if="activeValue === 'preview'">
            <MCard class="dsd-card--flush">
              <template #header>
                <div class="dsd-preview__hint">
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
          <div class="dsd-pane" v-else-if="activeValue === 'sync'">
            <MCard class="dsd-card--list">
              <div
                v-for="(s, i) in d.syncs" :key="i"
                class="sync-row"
              >
                <span class="sync-row__time">{{ s[0] }}</span>
                <span class="sync-row__name">{{ s[1] }}</span>
                <MTag size="small" :type="toneMap[s[2]] ?? 'success'">{{ s[2] }}</MTag>
                <span class="sync-row__msg">{{ s[3] }}</span>
                <span v-if="s[2] === '失败'" class="row-act dsd-mono dsd-row-act">{{ t('dsd.viewLog') }}</span>
              </div>
            </MCard>
          </div>

          <!-- 关联看板 -->
          <div v-else-if="activeValue === 'boards'" class="dsd-boards">
            <MCard v-for="(b, i) in d.boards" :key="i" class="dsd-board">
              <div class="dsd-toolbar">
                <span class="dsd-board__icon"><SvgIcon name="bar-chart" :px="18" /></span>
                <span class="dsd-board__name">{{ b[0] }}</span>
              </div>
              <div class="dsd-note">{{ b[1] }}</div>
              <div class="dsd-board__actions">
                <MButton size="small">{{ t('dsd.openBoard') }}</MButton>
                <MButton size="small">{{ t('dsd.lineage') }}</MButton>
              </div>
            </MCard>
          </div>
        </template>
      </MTabs>
      </template>
      </div>
    </div>
</template>

<style scoped lang="scss">
.dsd {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--m-color-page-bg);
  display: flex;
  flex-direction: column;
}

.dsd-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--m-color-border);
  background: var(--m-color-surface);
  padding: 0.75rem 1.5rem;

  &__divider {
    height: 1.5rem;
    width: 1px;
    flex: none;
    background: var(--m-color-split);
  }

  &__icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--m-radius-lg);
    background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
    color: var(--m-color-primary);
  }

  &__info {
    min-width: 200px;
    flex: 1;
  }

  &__name-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  &__name {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 500;
    color: var(--m-color-text);
  }

  &__desc {
    margin-top: 0.125rem;
    font-size: 13px;
    color: var(--m-color-text-muted);
  }

  &__sync-icon {
    margin-right: 0.25rem;
  }
}

.dsd-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dsd-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2rem;
}

.dsd-loading {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.dsd-kpis {
  margin-bottom: 1.25rem;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.dsd-kpi__value {
  margin-top: 0.25rem;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  color: var(--m-color-text);

  &--pos {
    color: var(--m-color-success);
  }
}

.dsd-note {
  font-size: 0.75rem;
  line-height: 1rem;
  color: var(--m-color-text-muted);
}

.dsd-hint {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1rem;
  color: var(--m-color-text-muted);
}

.dsd-overview {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 300px;
  }

  &__main {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__side {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    @media (max-width: 1023px) {
      flex-direction: row;
      flex-wrap: wrap;

      > * {
        min-width: 200px;
      }
    }
  }
}

.dsd-card__head {
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dsd-card__title {
  font-size: 15px;
  font-weight: 500;
  color: var(--m-color-text);
}

.dsd-card__heading {
  margin-bottom: 0.75rem;
  display: block;
  font-size: 15px;
  font-weight: 500;
  color: var(--m-color-text);
}

.dsd-chart {
  position: relative;
  height: 200px;

  &__el {
    height: 100%;
    width: 100%;
  }
}

.dsd-conn {
  display: grid;
  gap: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));

  &__value {
    margin-top: 0.125rem;
    color: var(--m-color-text);
  }
}

.dsd-quality {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-size: 0.875rem;
  line-height: 1.25rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label {
    color: var(--m-color-text-muted);
  }

  &__value {
    font-variant-numeric: tabular-nums;
    color: var(--m-color-text);
  }

  &__bar {
    margin-top: 0.25rem;
  }
}

.dsd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.dsd-gen {
  height: 2.25rem;
  width: 100%;
}

.dsd-fields {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0.75rem;
  overflow: auto;

  &__head {
    margin-bottom: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__search {
    width: 15rem;
  }
}

.dsd-spacer {
  flex: 1;
}

.dsd-cell-name {
  font-size: 13px;
  color: var(--m-color-text);
}

.dsd-cell-muted {
  color: var(--m-color-text-muted);
}

.dsd-missing {
  display: flex;
  align-items: center;
  gap: 0.375rem;

  &__bar {
    flex: 1;
  }

  &__pct {
    font-size: 0.75rem;
    line-height: 1rem;
    font-variant-numeric: tabular-nums;
    color: var(--m-color-text-muted);
  }
}

.dsd-row-act {
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1rem;
  color: var(--m-color-text-muted);
  opacity: 0;
}

.dsd-pane {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.dsd-preview__hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--m-color-text-muted);
}

.sync-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--m-color-border);
  padding: 0.75rem 0;
  font-size: 0.875rem;
  line-height: 1.25rem;

  &:last-child {
    border-bottom: 0;
  }

  &__time {
    width: 76px;
    flex: none;
    color: var(--m-color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  &__name {
    width: 68px;
    flex: none;
    color: var(--m-color-text);
  }

  &__msg {
    flex: 1;
    color: var(--m-color-text-muted);
  }
}

.dsd-boards {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.dsd-board {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__icon {
    color: var(--m-color-text-muted);
  }

  &__name {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: var(--m-color-text);
  }

  &__actions {
    margin-top: 0.25rem;
    display: flex;
    gap: 0.5rem;
  }
}

/* MCard 内表格贴边 */
.dsd-card--flush {
  display: flex;
  height: 100%;
  flex-direction: column;

  :deep(.m-card__body) {
    flex: 1 1 auto;
    height: 0;
  }
}

.dsd-card--fields {
  min-height: 280px;
  flex: 1;
}

.custom-tabs {
  flex: auto;
  height: 0;
  display: flex;
  flex-direction: column;

  :deep(.m-tabs__panel) {
    flex: 1 1 auto;
    height: 0;
  }
}

/* 行内 hover 操作（MTable 行 / 同步记录行共用） */
.row-act {
  transition: opacity 0.12s ease-out;
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
