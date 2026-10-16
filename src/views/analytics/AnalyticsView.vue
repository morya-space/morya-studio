<script setup lang="ts">
/**
 * 分析（/analytics）
 * 跨面板的数据洞察：资产概览、卡片类型分布、数据源类型分布、最近动态、待关注事项。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MCard, MEmpty, MSkeleton, MTable, MTag, type TableColumnDefinition } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import { initPages, listPages } from '../../services/page'
import { initDataSources, listDataSources } from '../../services/datasource'
import { initComponents, listCustomComponents } from '../../services/component'
import { initTemplates, listTemplates } from '../../services/template'
import { useECharts } from '../../composables/useECharts'
import type { DataSourceConfig, PageSchema } from '../../types/schema'

const { t } = useI18n()
const router = useRouter()

const pages = ref<PageSchema[]>([])
const datasources = ref<DataSourceConfig[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    await Promise.all([initPages(), initDataSources(), initComponents(), initTemplates()])
    pages.value = listPages()
    datasources.value = listDataSources()
  } finally {
    loading.value = false
  }
})

// ---------- 概览统计 ----------
const stats = computed(() => {
  const allCards = pages.value.flatMap(p => p.cards ?? [])
  return {
    pages: pages.value.length,
    cards: allCards.length,
    datasources: datasources.value.length,
    components: listCustomComponents().length,
    templates: listTemplates().length,
  }
})

// ---------- 卡片类型分布（饼图） ----------
const cardTypeData = computed(() => {
  const count = new Map<string, number>()
  for (const p of pages.value) {
    for (const c of p.cards ?? []) count.set(c.type, (count.get(c.type) ?? 0) + 1)
  }
  const typeLabel: Record<string, string> = {
    stat: '指标卡', chart: '图表', table: '表格', list: '列表', banner: '横幅', text: '文本', custom: '自定义',
  }
  return [...count.entries()].map(([type, value]) => ({ name: typeLabel[type] ?? type, value }))
})

const pieConfig = computed(() => ({
  chartType: 'pie' as const,
  xField: 'name',
  yField: 'value',
  showLegend: true,
  height: 260,
}))
const pie = useECharts(pieConfig.value, cardTypeData)
const { containerRef: pieRef } = pie
void pieRef

// ---------- 数据源类型分布（柱图） ----------
const dsTypeData = computed(() => {
  const count = new Map<string, number>()
  const dsById = new Map(datasources.value.map(d => [d.id, d]))
  for (const p of pages.value) {
    for (const c of p.cards ?? []) {
      if (c.dataSourceId) {
        const ds = dsById.get(c.dataSourceId)
        count.set(ds?.type ?? '未知', (count.get(ds?.type ?? '未知') ?? 0) + 1)
      } else if (c.dataSource) {
        count.set('内联', (count.get('内联') ?? 0) + 1)
      } else {
        count.set('未绑定', (count.get('未绑定') ?? 0) + 1)
      }
    }
  }
  return [...count.entries()].map(([name, value]) => ({ x: name, y: value }))
})

const barConfig = computed(() => ({
  chartType: 'bar' as const,
  xField: 'x',
  yField: 'y',
  showLegend: false,
  height: 260,
}))
const bar = useECharts(barConfig.value, dsTypeData)
const { containerRef: barRef } = bar
void barRef

// ---------- 待关注事项 ----------
interface AttentionItem {
  level: 'error' | 'warning'
  panel: string
  card: string
  message: string
}

const attention = computed<AttentionItem[]>(() => {
  const items: AttentionItem[] = []
  const dsIds = new Set(datasources.value.map(d => d.id))

  for (const p of pages.value) {
    const cards = p.cards ?? []
    if (cards.length === 0) {
      items.push({ level: 'warning', panel: p.title, card: '—', message: '空面板：未添加任何卡片' })
      continue
    }
    for (const c of cards) {
      if (!c.dataSourceId && !c.dataSource) {
        items.push({ level: 'error', panel: p.title, card: c.title ?? c.type, message: '卡片未绑定数据源' })
      } else if (c.dataSourceId && !dsIds.has(c.dataSourceId)) {
        items.push({ level: 'error', panel: p.title, card: c.title ?? c.type, message: `引用了不存在的数据源：${c.dataSourceId}` })
      }
    }
  }
  return items
})

// ---------- 最近更新面板 ----------
const recentColumns = computed<TableColumnDefinition[]>(() => [
  { key: 'title', label: '面板', minWidth: 240 },
  { key: 'cards', label: '卡片数', width: 100 },
  { key: 'updatedAt', label: '更新时间', width: 180 },
  { key: 'actions', label: '操作', width: 160, align: 'end' },
])

const recentPages = computed(() =>
  [...pages.value].sort((a, b) => String(b.meta?.updatedAt ?? '').localeCompare(String(a.meta?.updatedAt ?? ''))).slice(0, 8),
)

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <WorkspacePage :title="t('pages.analytics.title')" :summary="t('pages.analytics.summary')">
    <!-- 骨架 -->
    <div v-if="loading" class="analytics__skeleton">
      <div class="analytics__stats">
        <MSkeleton v-for="i in 5" :key="i" height="92px" border-radius="var(--m-radius-lg)" />
      </div>
      <div class="analytics__charts">
        <MSkeleton height="320px" border-radius="var(--m-radius-lg)" />
        <MSkeleton height="320px" border-radius="var(--m-radius-lg)" />
      </div>
    </div>

    <div v-else-if="pages.length === 0" class="analytics__empty">
      <MEmpty :title="t('analytics.emptyTitle')" :description="t('analytics.emptyDesc')">
        <template #extra>
          <MButton type="primary" @click="router.push('/panels')">{{ t('analytics.goPanels') }}</MButton>
        </template>
      </MEmpty>
    </div>

    <template v-else>
      <!-- 概览统计 -->
      <div class="analytics__stats">
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--primary"><SvgIcon name="layout" :px="16" /></span>
            <span class="stat-card__label">面板</span>
          </div>
          <div class="stat-card__value">{{ stats.pages }}</div>
          <div class="stat-card__sub">全部可视化看板</div>
        </MCard>
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--primary"><SvgIcon name="layers" :px="16" /></span>
            <span class="stat-card__label">卡片</span>
          </div>
          <div class="stat-card__value">{{ stats.cards }}</div>
          <div class="stat-card__sub">全部面板的卡片总数</div>
        </MCard>
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--info"><SvgIcon name="database" :px="16" /></span>
            <span class="stat-card__label">数据源</span>
          </div>
          <div class="stat-card__value">{{ stats.datasources }}</div>
          <div class="stat-card__sub">可复用的数据连接</div>
        </MCard>
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--warning"><SvgIcon name="layers" :px="16" /></span>
            <span class="stat-card__label">组件</span>
          </div>
          <div class="stat-card__value">{{ stats.components }}</div>
          <div class="stat-card__sub">自定义复用组件</div>
        </MCard>
        <MCard class="stat-card" shadow="always" :bordered="true">
          <div class="stat-card__head">
            <span class="stat-card__icon stat-card__icon--info"><SvgIcon name="file" :px="16" /></span>
            <span class="stat-card__label">模板</span>
          </div>
          <div class="stat-card__value">{{ stats.templates }}</div>
          <div class="stat-card__sub">可一键创建面板</div>
        </MCard>
      </div>

      <!-- 分布图表 -->
      <div class="analytics__charts">
        <MCard class="chart-card" shadow="always" :bordered="true">
          <p class="chart-card__title">卡片类型分布</p>
          <div ref="pieRef" class="chart-card__body" />
        </MCard>
        <MCard class="chart-card" shadow="always" :bordered="true">
          <p class="chart-card__title">卡片数据来源</p>
          <div ref="barRef" class="chart-card__body" />
        </MCard>
      </div>

      <!-- 待关注 + 最近动态 -->
      <div class="analytics__bottom">
        <MCard class="attention-card" shadow="always" :bordered="true">
          <p class="chart-card__title">待关注事项</p>
          <div v-if="attention.length === 0" class="attention-card__ok">一切正常，没有需要关注的问题。</div>
          <ul v-else class="attention-list">
            <li v-for="(item, i) in attention" :key="i" class="attention-item">
              <MTag :type="item.level === 'error' ? 'danger' : 'warning'" size="small">
                {{ item.level === 'error' ? '错误' : '警告' }}
              </MTag>
              <span class="attention-item__panel">{{ item.panel }}</span>
              <span class="attention-item__card">{{ item.card }}</span>
              <span class="attention-item__msg">{{ item.message }}</span>
            </li>
          </ul>
        </MCard>

        <MCard class="recent-card" shadow="always" :bordered="true">
          <p class="chart-card__title">最近更新的面板</p>
          <MTable
            :columns="recentColumns"
            :rows="recentPages"
            row-key="id"
            :paginator="false"
          >
            <template #cell-title="{ row }">
              <span class="recent-title">{{ row.title }}</span>
            </template>
            <template #cell-cards="{ row }">
              <span class="recent-cards">{{ row.cards.length }}</span>
            </template>
            <template #cell-updatedAt="{ row }">
              <span class="recent-time">{{ fmtTime(row.meta?.updatedAt) }}</span>
            </template>
            <template #cell-actions="{ row }">
              <MButton type="text" size="small" @click="router.push(`/editor/${row.id}`)">编辑</MButton>
            </template>
          </MTable>
        </MCard>
      </div>
    </template>
  </WorkspacePage>
</template>

<style scoped>
.analytics__skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analytics__stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.analytics__charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.analytics__bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.analytics__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
}

.stat-card :deep(.m-card__body) {
  padding: 0;
}

.stat-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--m-color-text-muted);
}

.stat-card__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--m-radius-sm);
  flex: none;
}

.stat-card__icon--primary {
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}

.stat-card__icon--info {
  background: color-mix(in srgb, var(--m-color-info) 12%, transparent);
  color: var(--m-color-info);
}

.stat-card__icon--warning {
  background: color-mix(in srgb, var(--m-color-warning) 12%, transparent);
  color: var(--m-color-warning);
}

.stat-card__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--m-color-text-muted);
}

.stat-card__value {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--m-color-text);
  font-variant-numeric: tabular-nums;
}

.stat-card__sub {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.chart-card {
  padding: 16px 18px;
}

.chart-card__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 12px;
}

.chart-card__body {
  width: 100%;
  height: 260px;
}

.attention-card {
  padding: 16px 18px;
}

.attention-card__ok {
  font-size: 13px;
  color: var(--m-color-success);
  padding: 12px 0;
}

.attention-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.attention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px solid var(--m-color-split);
}

.attention-item__panel {
  font-weight: 600;
  color: var(--m-color-text);
  flex-shrink: 0;
}

.attention-item__card {
  color: var(--m-color-text);
  flex-shrink: 0;
}

.attention-item__msg {
  color: var(--m-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-card {
  padding: 16px 18px;
}

.recent-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
}

.recent-cards {
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.recent-time {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

@media (max-width: 1200px) {
  .analytics__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .analytics__charts,
  .analytics__bottom {
    grid-template-columns: 1fr;
  }
}
</style>
