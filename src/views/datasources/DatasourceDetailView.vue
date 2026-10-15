<script setup lang="ts">
/**
 * 数据源详情（/datasources/:id）— 全屏独立页
 * 页头 + KPI + Tabs(概览/字段/预览/同步/看板)
 * 数据来自后端 API，非 mock。
 */

import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { MButton, MEmpty, MInput, MTable, MTabs, MTag, message } from 'morya-ui'
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

// ---------- 同步记录状态映射 ----------
const toneMap: Record<string, string> = {
  '成功': 'positive',
  '失败': 'danger',
  '进行中': 'accent',
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

const ICON_PATHS: Record<string, string> = {
  database: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12.0996 2C14.1963 2.00002 16.1125 2.3224 17.5371 2.87402C18.2464 3.1487 18.8793 3.49843 19.3506 3.93164C19.8228 4.36576 20.2 4.95206 20.2002 5.66895V13.9688L20.1992 13.9736L20.2002 13.9785V18.1318C20.2 18.8486 19.8228 19.4351 19.3506 19.8691C18.8793 20.3023 18.2464 20.6521 17.5371 20.9268C16.1125 21.4784 14.1963 21.8008 12.0996 21.8008C10.0032 21.8008 8.08759 21.4782 6.66309 20.9268C5.95381 20.6521 5.31994 20.3023 4.84863 19.8691C4.37651 19.4351 4.00024 18.8486 4 18.1318V5.66895C4.00015 4.95211 4.37645 4.36575 4.84863 3.93164C5.31995 3.49842 5.95375 3.14869 6.66309 2.87402C8.0876 2.32255 10.0032 2.00002 12.0996 2Z" fill="currentColor"/>',
  api: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3.97427 8.06961C4.99348 7.33581 6.18946 7.1 7.00001 7.1H9.00001C9.49706 7.1 9.90001 7.50294 9.90001 8C9.90001 8.49706 9.49706 8.9 9.00001 8.9H7.00001C6.47755 8.9 5.67353 9.06419 5.02599 9.53039C4.42434 9.96356 3.90001 10.6934 3.90001 12C3.90001 13.3066 4.42434 14.0364 5.02599 14.4696C5.67353 14.9358 6.47755 15.1 7.00001 15.1H9.00001C9.49706 15.1 9.90001 15.5029 9.90001 16C9.90001 16.4971 9.49706 16.9 9.00001 16.9H7.00001C6.18946 16.9 4.99348 16.6642 3.97427 15.9304C2.90917 15.1636 2.10001 13.8934 2.10001 12C2.10001 10.1066 2.90917 8.83644 3.97427 8.06961ZM14.1 8C14.1 7.50294 14.5029 7.1 15 7.1H17C17.8105 7.1 19.0065 7.33581 20.0257 8.06961C21.0908 8.83644 21.9 10.1066 21.9 12C21.9 13.8934 21.0908 15.1636 20.0257 15.9304C19.0065 16.6642 17.8105 16.9 17 16.9H15C14.5029 16.9 14.1 16.4971 14.1 16C14.1 15.5029 14.5029 15.1 15 15.1H17C17.5225 15.1 18.3265 14.9358 18.974 14.4696C19.5757 14.0364 20.1 13.3066 20.1 12C20.1 10.6934 19.5757 9.96356 18.974 9.53039C18.3265 9.06419 17.5225 8.9 17 8.9H15C14.5029 8.9 14.1 8.49706 14.1 8ZM7.10001 12C7.10001 11.5029 7.50295 11.1 8.00001 11.1H16C16.4971 11.1 16.9 11.5029 16.9 12C16.9 12.4971 16.4971 12.9 16 12.9H8.00001C7.50295 12.9 7.10001 12.4971 7.10001 12Z" fill="currentColor"/>',
  doc: '<path fill-rule="evenodd" clip-rule="evenodd" d="M13.1719 2.09961C13.9408 2.09969 14.6789 2.40555 15.2227 2.94922L19.0508 6.77734C19.5946 7.32113 19.9003 8.05911 19.9004 8.82812V18C19.9004 20.1539 18.1539 21.9004 16 21.9004H8C5.84626 21.9002 4.09961 20.1538 4.09961 18V6C4.09961 3.84621 5.84626 2.09981 8 2.09961H13.1719ZM8 3.90039C6.84037 3.90059 5.90039 4.84032 5.90039 6V18C5.90039 19.1597 6.84037 20.0994 8 20.0996H16C17.1598 20.0996 18.0996 19.1598 18.0996 18V9.90039H15C13.3985 9.90019 12.0996 8.6015 12.0996 7V3.90039H8ZM13.9004 7C13.9004 7.60739 14.3927 8.09941 15 8.09961H17.8213C17.8068 8.08333 17.7928 8.06626 17.7773 8.05078L13.9492 4.22266C13.9335 4.20696 13.9169 4.19237 13.9004 4.17773V7Z" fill="currentColor"/>',
  hive: '<path d="M4 3.08496C4.55224 3.08496 4.99993 3.53273 5 4.08496V18.0361H19.9941L20.0967 18.041C20.6008 18.0923 20.9941 18.5185 20.9941 19.0361C20.9941 19.5538 20.6008 19.9799 20.0967 20.0312L19.9941 20.0361H5C3.89546 20.0361 3.00005 19.1407 3 18.0361V4.08496C3.00007 3.53273 3.44776 3.08496 4 3.08496ZM18.2627 6.5166C18.6316 6.10561 19.2638 6.07157 19.6748 6.44043C20.0858 6.80932 20.1198 7.44153 19.751 7.85254L15.8682 12.1787C15.1552 12.9731 13.9437 13.0678 13.1162 12.3936L10.9121 10.5967L7.45117 14.6602C7.09308 15.0805 6.46145 15.1315 6.04102 14.7734C5.6206 14.4153 5.56969 13.7837 5.92773 13.3633L9.38965 9.2998C10.0949 8.47222 11.3318 8.36 12.1748 9.04688L14.3799 10.8428L18.2627 6.5166Z" fill="currentColor"/>',
}

function iconSvg(icon: string): string {
  const name = TYPE_ICON_MAP[icon] ?? icon
  return ICON_PATHS[name] ?? ICON_PATHS.database ?? ''
}
</script>

<template>
  <div class="dsd-page">
    <!-- 顶部工具栏 -->
    <div class="dsd-topbar">
      <MButton type="text" @click="goBack">
        <SvgIcon name="chevron-left" :px="14" /> {{ t('dsd.backToList') }}
      </MButton>
    </div>

    <MEmpty v-if="!loading && !detail" :title="t('dsd.notFound')">
      <template #extra>
        <MButton type="primary" @click="goBack">{{ t('dsd.backToList') }}</MButton>
      </template>
    </MEmpty>

    <div v-else-if="loading" class="dsd-loading">
      <span>{{ t('common.loading') }}</span>
    </div>

    <template v-else>
      <!-- 页头 -->
      <div class="dsd-header">
        <div class="dsd-header__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" v-html="iconSvg(d.icon)" />
        </div>
        <div class="dsd-header__info">
          <div class="dsd-header__title-row">
            <span class="dsd-header__name">{{ d.name }}</span>
            <MTag size="small">{{ d.type }}</MTag>
            <span class="dsd-pill dsd-pill--success">
              <span class="dsd-pill__dot" />{{ t('dsd.connected') }}
            </span>
          </div>
          <div class="dsd-header__desc">{{ d.desc }}</div>
        </div>
        <div class="dsd-header__actions">
          <MButton :loading="testing" @click="onTest">{{ t('dsd.testConn') }}</MButton>
          <MButton type="primary" :loading="syncing" @click="onSync">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="margin-right:4px">
              <path d="M6.88048 6.89231C9.69226 4.08054 14.251 4.08054 17.0628 6.89231L16.2364 7.71871C15.7324 8.22268 16.0894 9.0844 16.8021 9.0844H19.7276C20.1694 9.0844 20.5276 8.72623 20.5276 8.2844V5.35891C20.5276 4.64619 19.6659 4.28926 19.1619 4.79323L18.3356 5.61952C14.8209 2.1048 9.12241 2.1048 5.60769 5.61952C2.09297 9.13424 2.09297 14.8327 5.60769 18.3474C9.12241 21.8622 14.8209 21.8622 18.3356 18.3474C19.4929 17.1902 20.2703 15.7937 20.6655 14.3163C20.7939 13.8361 20.5087 13.3428 20.0285 13.2143C19.5483 13.0859 19.055 13.3711 18.9266 13.8513C18.611 15.0314 17.9906 16.1469 17.0628 17.0746C14.251 19.8864 9.69226 19.8864 6.88048 17.0746C4.06871 14.2629 4.06871 9.70409 6.88048 6.89231Z" fill="currentColor"/>
            </svg>
            {{ syncing ? t('dsd.syncing') : t('dsd.syncNow') }}
          </MButton>
        </div>
      </div>

      <!-- KPI 指标条 -->
      <div class="dsd-kpi-row">
        <div v-for="(kpi, i) in d.kpis" :key="i" class="dsd-card dsd-kpi">
          <div class="dsd-kpi__label">{{ kpi[0] }}</div>
          <div class="dsd-kpi__value" :class="{ 'dsd-kpi__value--pos': kpi[3] === 'pos' }">{{ kpi[1] }}</div>
          <div class="dsd-kpi__sub">{{ kpi[2] }}</div>
        </div>
      </div>

      <!-- 标签页 -->
      <MTabs v-model="activeTab" :tabs="tabs" class="dsd-tabs">
        <template #default="{ activeValue }">
          <!-- 概览 -->
          <div v-if="activeValue === 'overview'" class="dsd-overview">
            <div class="dsd-overview__main">
              <!-- 图表卡片 -->
              <div class="dsd-card">
                <div class="dsd-card__head">
                  <span class="dsd-card__title">{{ d.chart.title }}</span>
                  <MTag size="small">{{ d.chart.tag }}</MTag>
                </div>
                <div class="dsd-chart">
                  <div ref="chartRef" class="dsd-chart__echart" />
                </div>
              </div>
              <!-- 连接信息 -->
              <div class="dsd-card">
                <div class="dsd-card__head">
                  <span class="dsd-card__title">{{ d.connTitle }}</span>
                </div>
                <div class="dsd-conn-grid">
                  <div v-for="(c, i) in d.conn" :key="i">
                    <div class="dsd-conn__label">{{ c[0] }}</div>
                    <div class="dsd-conn__value dsd-mono">{{ c[1] }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="dsd-overview__side">
              <!-- 数据质量 -->
              <div class="dsd-card">
                <div class="dsd-card__head">
                  <span class="dsd-card__title">{{ t('dsd.quality') }}</span>
                </div>
                <div class="dsd-quality-list">
                  <div v-for="(q, i) in d.quality" :key="i" class="dsd-quality-item">
                    <div class="dsd-quality-item__row">
                      <span class="dsd-quality-item__label">{{ q[0] }}</span>
                      <span class="dsd-quality-item__value dsd-num">{{ q[1] }}%</span>
                    </div>
                    <div class="dsd-quality-item__bar">
                      <div
                        class="dsd-quality-item__fill"
                        :style="{ width: q[1] + '%', background: q[2] === 'warning' ? 'var(--m-color-warning)' : 'var(--m-color-success)' }"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <!-- 标签 -->
              <div class="dsd-card">
                <div class="dsd-card__head">
                  <span class="dsd-card__title">{{ t('dsd.tags') }}</span>
                </div>
                <div class="dsd-tag-row">
                  <span v-for="(tag, i) in d.tags" :key="i" class="dsd-chip">{{ tag }}</span>
                </div>
              </div>
              <!-- 生成看板 -->
              <MButton type="primary" class="dsd-gen-btn" @click="onGenBoard">
                {{ t('dsd.genBoard') }}
              </MButton>
            </div>
          </div>

          <!-- 字段 -->
          <div v-else-if="activeValue === 'fields'" class="dsd-fields">
            <div class="dsd-fields__toolbar">
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
              <span class="dsd-fields__count">
                {{ t('dsd.fieldCount', { n: filteredFields.length, total: d.fields.length }) }}
              </span>
              <span style="flex:1" />
              <MButton size="small" @click="onExportDict">{{ t('dsd.exportDict') }}</MButton>
            </div>
            <div class="dsd-card dsd-card--table">
              <table class="dsd-tbl">
                <thead>
                  <tr>
                    <th>{{ t('dsd.fieldName') }}</th>
                    <th>{{ t('dsd.fieldType') }}</th>
                    <th>{{ t('dsd.fieldRequired') }}</th>
                    <th>{{ t('dsd.fieldComment') }}</th>
                    <th>{{ t('dsd.fieldExample') }}</th>
                    <th style="width:110px">{{ t('dsd.fieldMissing') }}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(f, i) in filteredFields" :key="i">
                    <td>{{ f[0] }}</td>
                    <td class="dsd-mono">{{ f[1] }}</td>
                    <td>{{ f[2] }}</td>
                    <td class="dsd-tbl__comment">{{ f[3] }}</td>
                    <td class="dsd-mono dsd-tbl__example">{{ f[4] }}</td>
                    <td>
                      <div class="dsd-missing">
                        <div class="dsd-missing__track">
                          <div
                            class="dsd-missing__fill"
                            :style="{ width: f[6] + '%', background: +f[6] > 10 ? 'var(--m-color-warning)' : 'var(--m-color-text-muted)' }"
                          />
                        </div>
                        <span class="dsd-num dsd-missing__pct">{{ f[5] }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="dsd-row-act">{{ t('dsd.analyze') }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 预览 -->
          <div v-else-if="activeValue === 'preview'" class="dsd-preview">
            <div class="dsd-preview__info">
              <MTag size="small" class="dsd-mono">{{ d.preview[0] }}</MTag>
              <span class="dsd-preview__hint">{{ t('dsd.previewHint') }}</span>
            </div>
            <div class="dsd-card dsd-card--table">
              <MTable
                :columns="previewTableCols"
                :rows="previewRows"
                :empty-text="t('dsd.noData')"
                striped
              />
            </div>
          </div>

          <!-- 同步记录 -->
          <div v-else-if="activeValue === 'sync'" class="dsd-sync">
            <div class="dsd-card dsd-card--list">
              <div
                v-for="(s, i) in d.syncs" :key="i"
                class="dsd-sync-row"
              >
                <span class="dsd-sync-row__time dsd-num">{{ s[0] }}</span>
                <span class="dsd-sync-row__type">{{ s[1] }}</span>
                <span
                  class="dsd-pill"
                  :class="`dsd-pill--${toneMap[s[2]] ?? 'positive'}`"
                >
                  {{ s[2] }}
                </span>
                <span class="dsd-sync-row__desc">{{ s[3] }}</span>
                <span v-if="s[2] === '失败'" class="dsd-row-act">{{ t('dsd.viewLog') }}</span>
              </div>
            </div>
          </div>

          <!-- 关联看板 -->
          <div v-else-if="activeValue === 'boards'" class="dsd-boards">
            <div class="dsd-boards__grid">
              <div v-for="(b, i) in d.boards" :key="i" class="dsd-card dsd-board-card">
                <div class="dsd-board-card__head">
                  <span class="dsd-board-card__icon">
                    <SvgIcon name="bar-chart" :px="18" />
                  </span>
                  <span class="dsd-board-card__name">{{ b[0] }}</span>
                </div>
                <div class="dsd-board-card__desc">{{ b[1] }}</div>
                <div class="dsd-board-card__actions">
                  <MButton size="small">{{ t('dsd.openBoard') }}</MButton>
                  <MButton size="small">{{ t('dsd.lineage') }}</MButton>
                </div>
              </div>
            </div>
          </div>
        </template>
      </MTabs>
    </template>
  </div>
</template>

<style scoped>
/* ========== 全屏页布局 ========== */
.dsd-page {
  min-height: 100vh;
  background: var(--m-color-page-bg);
  padding: 20px 24px 24px;
  overflow-y: auto;
}

.dsd-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--m-color-text-muted);
}

/* ========== 顶部工具栏 ========== */
.dsd-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.dsd-topbar__sep {
  width: 1px;
  height: 20px;
  background: var(--m-color-border);
}

.dsd-topbar__label {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.dsd-topbar__hint {
  font-size: 12px;
  color: var(--m-color-text-muted);
  opacity: 0.7;
}

/* ========== 类型切换 ========== */
.dsd-seg-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dsd-seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--m-radius-md);
  border: 1px solid var(--m-color-border);
  background: transparent;
  color: var(--m-color-text-muted);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s ease-out;
}

.dsd-seg:hover {
  background: var(--m-color-split);
}

.dsd-seg--active {
  background: var(--m-color-text);
  color: var(--m-color-surface);
  border-color: var(--m-color-text);
}

/* ========== 页头 ========== */
.dsd-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.dsd-header__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--m-radius-lg);
  background: var(--m-color-split);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--m-color-text);
  flex-shrink: 0;
}

.dsd-header__info {
  flex: 1;
  min-width: 200px;
}

.dsd-header__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dsd-header__name {
  font-size: 20px;
  font-weight: 500;
  color: var(--m-color-text);
}

.dsd-header__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin-top: 4px;
}

.dsd-header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ========== 状态 pill ========== */
.dsd-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--m-radius-sm);
  font-size: 12px;
}

.dsd-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}

.dsd-pill--success {
  background: color-mix(in srgb, var(--m-color-success) 12%, transparent);
  color: var(--m-color-success);
}

.dsd-pill--danger {
  background: color-mix(in srgb, var(--m-color-danger) 12%, transparent);
  color: var(--m-color-danger);
}

.dsd-pill--accent {
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}

/* ========== KPI 卡片 ========== */
.dsd-kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.dsd-kpi__label {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.dsd-kpi__value {
  font-size: 26px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  margin-top: 4px;
  color: var(--m-color-text);
}

.dsd-kpi__value--pos {
  color: var(--m-color-success);
}

.dsd-kpi__sub {
  font-size: 12px;
  margin-top: 2px;
  color: var(--m-color-text-muted);
}

/* ========== 通用卡片 ========== */
.dsd-card {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-lg);
  padding: 16px;
  background: var(--m-color-surface);
}

.dsd-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.dsd-card__title {
  font-size: 15px;
  font-weight: 500;
  color: var(--m-color-text);
}

.dsd-card--table {
  padding: 0;
  overflow-x: auto;
}

.dsd-card--list {
  padding: 4px 16px;
}

/* ========== Tabs ========== */
.dsd-tabs {
  margin-top: 0;
}

/* ========== 概览布局 ========== */
.dsd-overview {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 12px;
}

.dsd-overview__main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.dsd-overview__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ========== 图表 ========== */
.dsd-chart {
  position: relative;
  height: 200px;
}

.dsd-chart__echart {
  width: 100%;
  height: 100%;
}

.dsd-bar {
  cursor: pointer;
  transition: opacity 0.12s ease-out;
}

.dsd-bar:hover {
  opacity: 0.7;
}

/* ========== 连接信息 ========== */
.dsd-conn-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  font-size: 13px;
}

.dsd-conn__label {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.dsd-conn__value {
  color: var(--m-color-text);
  margin-top: 2px;
}

/* ========== 数据质量 ========== */
.dsd-quality-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
}

.dsd-quality-item__row {
  display: flex;
  justify-content: space-between;
}

.dsd-quality-item__label {
  color: var(--m-color-text-muted);
}

.dsd-quality-item__value {
  color: var(--m-color-text);
}

.dsd-quality-item__bar {
  height: 4px;
  border-radius: 2px;
  background: var(--m-color-split);
  margin-top: 4px;
}

.dsd-quality-item__fill {
  height: 4px;
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* ========== 标签 ========== */
.dsd-tag-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.dsd-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--m-radius-sm);
  font-size: 12px;
  background: var(--m-color-split);
  color: var(--m-color-text-muted);
}

/* ========== 生成看板按钮 ========== */
.dsd-gen-btn {
  justify-content: center;
  height: 36px;
}

/* ========== 字段页 ========== */
.dsd-fields__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.dsd-fields__search {
  width: 240px;
}

.dsd-fields__count {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

/* ========== 表格 ========== */
.dsd-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.dsd-tbl th {
  font-size: 12px;
  font-weight: 400;
  color: var(--m-color-text-muted);
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--m-color-border);
}

.dsd-tbl td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--m-color-border);
  color: var(--m-color-text-muted);
}

.dsd-tbl tr:last-child td {
  border-bottom: none;
}

.dsd-tbl td:first-child {
  color: var(--m-color-text);
  font-family: var(--m-font-mono, monospace);
  font-size: 13px;
}

.dsd-tbl__comment {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsd-tbl__example {
  color: var(--m-color-text-muted);
}

/* ========== 缺失率 ========== */
.dsd-missing {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dsd-missing__track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--m-color-split);
}

.dsd-missing__fill {
  height: 4px;
  border-radius: 2px;
}

.dsd-missing__pct {
  font-size: 12px;
}

/* ========== 行内操作 ========== */
.dsd-row-act {
  opacity: 0;
  transition: opacity 0.12s ease-out;
  font-family: var(--m-font-mono, monospace);
  color: var(--m-color-text-muted);
  cursor: pointer;
  font-size: 12px;
}

tr:hover .dsd-row-act {
  opacity: 1;
}

/* ========== 预览页 ========== */
.dsd-preview__info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.dsd-preview__hint {
  font-size: 13px;
  color: var(--m-color-text-muted);
}

/* ========== 同步记录 ========== */
.dsd-sync-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--m-color-border);
  font-size: 13px;
}

.dsd-sync-row:last-child {
  border-bottom: none;
}

.dsd-sync-row__time {
  color: var(--m-color-text-muted);
  width: 76px;
  flex-shrink: 0;
}

.dsd-sync-row__type {
  color: var(--m-color-text);
  width: 68px;
  flex-shrink: 0;
}

.dsd-sync-row__desc {
  flex: 1;
  color: var(--m-color-text-muted);
}

/* ========== 看板卡片 ========== */
.dsd-boards__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.dsd-board-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dsd-board-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dsd-board-card__icon {
  color: var(--m-color-text-muted);
}

.dsd-board-card__name {
  font-weight: 500;
  font-size: 14px;
  color: var(--m-color-text);
}

.dsd-board-card__desc {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.dsd-board-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* ========== 工具类 ========== */
.dsd-mono {
  font-family: var(--m-font-mono, monospace);
  font-size: 12px;
}

.dsd-num {
  font-variant-numeric: tabular-nums;
}

/* ========== 响应式 ========== */
@media (max-width: 900px) {
  .dsd-overview {
    grid-template-columns: 1fr;
  }

  .dsd-overview__side {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .dsd-overview__side > * {
    flex: 1;
    min-width: 200px;
  }
}
</style>
