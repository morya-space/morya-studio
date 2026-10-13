<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MCard } from 'morya-ui'
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import type { CardSchema } from '../../types/schema'
import { useDataSource } from '../../composables/useDataSource'

echarts.use([GaugeChart, CanvasRenderer])

const props = defineProps<{
  schema: CardSchema
}>()

const { t } = useI18n()
const { data } = useDataSource(props.schema.dataSource)

const transactions = computed(() => data.value)

const nameKeys: Record<string, string> = {
  'Dribbble subscription': 'dashboard.transactions.items.dribbble',
  'Figma pro plan': 'dashboard.transactions.items.figma',
}

const dateKeys: Record<string, string> = {
  'October 24': 'dashboard.transactions.dates.oct24',
  'October 28': 'dashboard.transactions.dates.oct28',
}

const weekDays = computed(() => [
  { day: t('dashboard.transactions.weekdays.mon'), date: 27 },
  { day: t('dashboard.transactions.weekdays.tue'), date: 28 },
  { day: t('dashboard.transactions.weekdays.wed'), date: 29 },
  { day: t('dashboard.transactions.weekdays.thu'), date: 30 },
])

const gaugeRef = ref<HTMLElement | null>(null)
let gaugeChart: echarts.ECharts | null = null

onMounted(() => {
  if (!gaugeRef.value) return

  gaugeChart = echarts.init(gaugeRef.value)
  gaugeChart.setOption({
    series: [{
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      radius: '100%',
      center: ['50%', '60%'],
      progress: {
        show: true,
        width: 10,
        roundCap: true,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 1,
            colorStops: [
              { offset: 0, color: '#7C6AEF' },
              { offset: 1, color: '#5B8DEF' },
            ],
          },
        },
      },
      axisLine: {
        lineStyle: {
          width: 10,
          color: [[1, '#F0F0F5']],
        },
      },
      pointer: {
        show: true,
        length: '60%',
        width: 4,
        itemStyle: { color: '#7C6AEF' },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      anchor: {
        show: true,
        size: 14,
        showAbove: true,
        itemStyle: { color: '#fff', borderColor: '#7C6AEF', borderWidth: 3 },
      },
      title: { show: false },
      detail: { show: false },
      data: [{ value: 30 }],
    }],
  })
})

function formatAmount(value: unknown): string {
  const num = Number(value)
  return num >= 0 ? `+$${Math.abs(num).toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`
}
</script>

<template>
  <MCard shadow="always" :bordered="false" class="transactions-panel">
    <template #header>
      <div class="panel-header">
        <h3 class="panel-title">{{ t('dashboard.transactions.title') }}</h3>
        <button class="view-all-btn">{{ t('dashboard.transactions.viewAll') }}</button>
      </div>
    </template>

    <div class="panel-body">
      <!-- 左侧：日期 + 交易列表 -->
      <div class="transactions-left">
        <!-- 日期标签 -->
        <div class="date-tabs">
          <button
            v-for="d in weekDays"
            :key="d.date"
            class="date-tab"
            :class="{ 'date-tab--active': d.date === 28 }"
          >
            <span class="date-day">{{ d.day }}</span>
            <span class="date-num">{{ d.date }}</span>
          </button>
        </div>

        <!-- 交易胶囊列表 -->
        <div class="transaction-pills">
          <div
            v-for="(tx, index) in transactions"
            :key="index"
            class="transaction-pill"
            :style="{ background: `${tx.color}15` }"
          >
            <div class="pill-info">
              <span class="pill-name">{{ t(nameKeys[String(tx.name)] ?? 'dashboard.transactions.items.dribbble') }}</span>
              <span class="pill-amount">{{ formatAmount(tx.amount) }}</span>
            </div>
            <div class="pill-meta">
              <span class="pill-date">{{ t(dateKeys[String(tx.date)] ?? 'dashboard.transactions.dates.oct24') }} · {{ tx.time }}</span>
              <span class="pill-dot" :style="{ background: String(tx.color) }" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：仪表盘 -->
      <div class="gauge-section">
        <div class="gauge-header">
          <span class="gauge-label">{{ t('dashboard.transactions.currentBalance') }}</span>
          <span class="gauge-value">$2,400.00</span>
          <span class="gauge-spend">{{ t('dashboard.transactions.spend') }} &nbsp;<strong>30%</strong></span>
        </div>
        <div ref="gaugeRef" class="gauge-chart" />
        <div class="gauge-footer">
          <div class="gauge-stat">
            <span class="stat-label">{{ t('dashboard.transactions.outcome') }}</span>
            <span class="stat-value outcome">$400.00</span>
          </div>
          <div class="gauge-stat">
            <span class="stat-label">{{ t('dashboard.transactions.income') }}</span>
            <span class="stat-value income">$1,500.00</span>
          </div>
        </div>
      </div>
    </div>
  </MCard>
</template>

<style scoped>
.transactions-panel {
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.transactions-panel :deep(.m-card__header),
.transactions-panel :deep(.m-card__body) {
  padding: 24px 28px;
}

.transactions-panel :deep(.m-card__header) {
  padding-bottom: 0;
  border-bottom: none;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.panel-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.view-all-btn {
  border: none;
  background: var(--m-color-split);
  color: var(--m-color-text-muted);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
}

.panel-body {
  display: flex;
  gap: 32px;
}

/* 左侧 */
.transactions-left {
  flex: 1;
  min-width: 0;
}

.date-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.date-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  color: var(--m-color-text-muted);
}

.date-tab--active {
  background: #1F2937;
  color: #fff;
}

.date-day {
  font-size: 12px;
}

.date-num {
  font-size: 15px;
  font-weight: 600;
}

.transaction-pills {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transaction-pill {
  border-radius: 16px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pill-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.pill-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill-amount {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
}

.pill-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-date {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.pill-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 右侧仪表盘 */
.gauge-section {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.gauge-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.gauge-label {
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.gauge-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--m-color-text);
}

.gauge-spend {
  margin-left: auto;
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.gauge-chart {
  width: 100%;
  height: 200px;
}

.gauge-footer {
  display: flex;
  justify-content: space-between;
  padding: 0 16px;
}

.gauge-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
}

.stat-value.outcome {
  color: #EC4899;
}

.stat-value.income {
  color: var(--m-color-primary);
}
</style>
