<script setup lang="ts">
/**
 * 工作台（/）
 * 金融风三栏布局：左窄图标栏（全局壳）+ 中间主内容 + 右侧信息面板。
 * 内容与本系统适配：资产横幅 / 最近面板（交易列表）/ 数据概览（仪表）+ 右侧 成员 / 升级。
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MCard, MEmpty, MSkeleton } from 'morya-ui'
import SvgIcon from '../../components/common/SvgIcon.vue'
import type { PageSchema } from '../../types/schema'
import { initPages, listPages, genPageId } from '../../services/page'
import { initDataSources, listDataSources } from '../../services/datasource'
import { initComponents, listCustomComponents } from '../../services/component'
import { initTemplates, listTemplates } from '../../services/template'
import { getAllCardTypes } from '../../engine/registry'
import { useSession } from '../../composables/useSession'
import { useECharts } from '../../composables/useECharts'
import { getToken } from '../../composables/useThemeToken'

const router = useRouter()
const { t } = useI18n()
const { user } = useSession()

const pages = ref<PageSchema[]>([])
const dsCount = ref(0)
const componentCount = ref(0)
const templateCount = ref(0)
const loading = ref(true)

// 顶部问候 + 总资产（面板里卡片总数）
const totalCards = computed(() => pages.value.reduce((n, p) => n + p.cards.length, 0))

// 紫色横幅三项（参考图：Opening balance / Credit / Debits）
const bannerStats = computed(() => [
  { key: 'panels', label: t('workbench.panelCount'), value: pages.value.length, icon: 'layout', trend: '+12%' },
  { key: 'ds', label: t('workbench.dsCount'), value: dsCount.value, icon: 'database', trend: '+4%' },
  { key: 'components', label: t('workbench.componentCount'), value: componentCount.value, icon: 'layers', trend: '+8%' },
])

// 中间：最近面板（参考图 All Transactions 列表）
const recentPages = computed(() => pages.value.slice(0, 6))

// 中间：数据概览（ECharts 环形图）
// 单源定义四类资产（图例颜色与图表一致），图表用 ECharts donut。
const overviewSegments = computed(() => [
  { label: t('workbench.panelCount'), value: pages.value.length, token: '--m-color-primary' },
  { label: t('workbench.dsCount'), value: dsCount.value, token: '--m-color-accent-blue' },
  { label: t('workbench.componentCount'), value: componentCount.value, token: '--m-color-accent-orange' },
  { label: t('workbench.templateCount'), value: templateCount.value, token: '--m-color-success' },
])

const overviewData = computed(() =>
  overviewSegments.value.map(s => ({ name: s.label, value: s.value })),
)

const overviewConfig = computed(() => ({
  chartType: 'pie' as const,
  xField: 'name',
  yField: 'value',
  showLegend: false,
  height: 220,
  colors: overviewSegments.value.map(s => getToken(s.token, '#888888')),
}))

const overviewChart = useECharts(overviewConfig.value, overviewData)
const { containerRef: overviewRef } = overviewChart
void overviewRef

// 右侧：成员（参考 Active Members，用团队成员占位）
const members = computed(() => [
  { name: 'UI Designer', pct: 60, color: 'var(--m-color-primary)' },
  { name: 'Illustrator', pct: 30, color: 'var(--m-color-accent-blue)' },
  { name: 'Leader', pct: 10, color: 'var(--m-color-accent-pink)' },
])

function refresh() {
  pages.value = listPages()
  dsCount.value = listDataSources().length
  componentCount.value = getAllCardTypes().length + listCustomComponents().length
  templateCount.value = listTemplates().length
}

onMounted(async () => {
  try {
    // 四类缓存从后端就绪后再读（init 幂等，重复进入秒回）
    await Promise.all([initPages(), initDataSources(), initComponents(), initTemplates()])
    refresh()
  } finally {
    loading.value = false
  }
})

function onEdit(id: string) {
  router.push(`/editor/${id}`)
}

function formatTime(iso?: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
void formatTime

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
</script>

<template>
  <div class="wb">
    <!-- ============ 中间主内容 ============ -->
    <div class="wb-main">
      <!-- 顶部：问候 + 操作 -->
      <div class="wb-head">
        <div>
          <h1 class="wb-title">{{ t('workbench.greeting') }}</h1>
          <p class="wb-total">
            {{ totalCards }}
            <span class="wb-total-label">{{ t('workbench.cardTotal') }}</span>
          </p>
        </div>
        <div class="wb-head-actions">
          <MButton type="default" @click="router.push('/panels')">{{ t('workbench.viewAll') }}</MButton>
          <MButton type="primary" @click="router.push(`/editor/${genPageId()}`)">
            <SvgIcon name="plus" :px="14" /> {{ t('workbench.newPanel') }}
          </MButton>
        </div>
      </div>

      <!-- 紫色资产横幅 -->
      <MSkeleton v-if="loading" height="104px" border-radius="var(--m-radius-lg)" />
      <section v-else class="wb-banner">
        <div v-for="s in bannerStats" :key="s.key" class="wb-stat">
          <span class="wb-stat-icon">
            <SvgIcon :name="s.icon" :px="22" />
          </span>
          <div class="wb-stat-info">
            <span class="wb-stat-label">{{ s.label }}</span>
            <span class="wb-stat-value">
              {{ s.value }}
              <em class="wb-stat-trend">{{ s.trend }}</em>
            </span>
          </div>
        </div>
      </section>

      <!-- 中部两栏：最近面板 + 数据概览 -->
      <div class="wb-mid">
        <!-- 最近面板（交易列表风） -->
        <MCard class="studio-card" shadow="always" :bordered="false">
          <template #header>
            <div class="wb-card-head">
              <h3 class="wb-card-title">{{ t('workbench.recentPanels') }}</h3>
              <MButton type="text" size="small" @click="router.push('/panels')">{{ t('workbench.viewAll') }}</MButton>
            </div>
          </template>

          <div v-if="loading" class="wb-skel">
            <MSkeleton v-for="i in 4" :key="i" height="52px" border-radius="var(--m-radius-md)" />
          </div>

          <div v-else-if="recentPages.length === 0" class="wb-empty">
            <MEmpty :title="t('workbench.emptyTitle')" :description="t('workbench.emptyDesc')">
              <template #extra>
                <MButton type="primary" @click="router.push(`/editor/${genPageId()}`)">{{ t('workbench.createNow') }}</MButton>
              </template>
            </MEmpty>
          </div>

          <div v-else class="wb-page-list">
            <button
              v-for="page in recentPages"
              :key="page.id"
              type="button"
              class="wb-page-item"
              @click="onEdit(page.id)"
            >
              <span class="wb-page-icon">
                <SvgIcon name="layout" :px="18" />
              </span>
              <span class="wb-page-info">
                <span class="wb-page-title">{{ page.title }}</span>
                <span class="wb-page-meta">{{ fmtDate(page.meta?.updatedAt) }} · {{ t('workbench.cardCount', { n: page.cards.length }) }}</span>
              </span>
              <span class="wb-page-count">{{ page.cards.length }}</span>
              <SvgIcon name="arrow-up-right" :px="16" class="wb-page-arrow" />
            </button>
          </div>
        </MCard>

        <!-- 数据概览（ECharts 环形图） -->
        <MCard class="studio-card" shadow="always" :bordered="false">
          <template #header>
            <div class="wb-card-head">
              <h3 class="wb-card-title">{{ t('workbench.overview') }}</h3>
            </div>
          </template>
          <div v-if="loading" class="wb-donut-skel">
            <MSkeleton shape="circle" width="150px" height="150px" />
          </div>
          <div v-else class="wb-donut-wrap">
            <div class="wb-donut-area">
              <div ref="overviewRef" class="wb-donut" />
              <div class="wb-donut-center">
                <span class="wb-donut-value">{{ totalCards }}</span>
                <span class="wb-donut-label">{{ t('workbench.cardTotal') }}</span>
              </div>
            </div>
            <ul class="wb-legend">
              <li v-for="s in overviewSegments" :key="s.label" class="wb-legend-item">
                <span class="wb-dot" :style="{ background: `var(${s.token})` }" />
                <span class="wb-legend-name">{{ s.label }}</span>
                <span class="wb-legend-value">{{ s.value }}</span>
              </li>
            </ul>
          </div>
        </MCard>
      </div>
    </div>

    <!-- ============ 右侧信息面板 ============ -->
    <aside class="wb-side">
      <!-- 用户卡 -->
      <MCard class="studio-card" shadow="always" :bordered="false" size="sm">
        <div class="wb-user">
          <span class="wb-user-avatar">
            {{ (user?.name ?? 'M').slice(0, 1) }}
          </span>
          <div class="wb-user-info">
            <span class="wb-user-name">{{ user?.name ?? 'Member' }}</span>
            <span class="wb-user-plan">{{ t('user.freeMember') }}</span>
          </div>
        </div>
      </MCard>

      <!-- Active Members -->
      <MCard class="studio-card" shadow="always" :bordered="false">
        <template #header>
          <h4 class="wb-subtitle">{{ t('workbench.activeMembers') }}</h4>
        </template>
        <div class="wb-members">
          <div class="wb-members-bar">
            <span
              v-for="m in members"
              :key="m.name"
              class="wb-members-seg"
              :style="{ width: `${m.pct}%`, background: m.color }"
            />
          </div>
          <ul class="wb-members-list">
            <li v-for="m in members" :key="m.name" class="wb-member-item">
              <span class="wb-dot" :style="{ background: m.color }" />
              <span class="wb-member-name">{{ m.name }}</span>
              <span class="wb-member-pct">{{ m.pct }}%</span>
            </li>
          </ul>
        </div>
      </MCard>

      <!-- Upgrade -->
      <MCard class="studio-card wb-upgrade" shadow="always" :bordered="false">
        <template #header>
          <h4 class="wb-subtitle">{{ t('workbench.upgradeTitle') }}</h4>
        </template>
        <div class="wb-members">
          <p class="wb-upgrade-desc">{{ t('workbench.upgradeDesc') }}</p>
          <MButton type="primary" class="wb-upgrade-btn" @click="router.push('/settings')">
            {{ t('workbench.upgradeNow') }}
          </MButton>
          <div class="wb-upgrade-crown" aria-hidden="true">
            <SvgIcon name="crown" :px="64" />
          </div>
        </div>
      </MCard>
    </aside>
  </div>
</template>

<style lang="scss" scoped>
.wb {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  align-items: flex-start;
  gap: 28px;
  height: 100%;
  overflow-y: auto;
  background: var(--m-color-page-bg);
  padding: 28px 32px;
}

.wb-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.wb-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.wb-title {
  margin: 0 0 6px;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--m-color-text);
}

.wb-total {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: var(--m-color-primary);
}

.wb-total-label {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--m-color-text-muted);
}

.wb-head-actions {
  display: flex;
  gap: 8px;
}

/* 紫色资产横幅 */
.wb-banner {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  border-radius: var(--m-radius-lg);
  background: linear-gradient(120deg, var(--m-color-primary), color-mix(in srgb, var(--m-color-primary) 70%, var(--m-color-accent-blue)));
  padding: 24px 28px;
  box-shadow: var(--m-shadow-card);
}

.wb-stat {
  display: flex;
  align-items: center;
  gap: 14px;
}

.wb-stat-icon {
  height: 48px;
  width: 48px;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--m-color-surface) 20%, transparent);
  color: var(--m-color-surface);
}

.wb-stat-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-stat-label {
  font-size: 12px;
  color: color-mix(in srgb, var(--m-color-surface) 80%, transparent);
}

.wb-stat-value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  font-weight: 800;
  color: var(--m-color-surface);
}

.wb-stat-trend {
  border-radius: 9999px;
  background: color-mix(in srgb, var(--m-color-surface) 22%, transparent);
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  font-style: normal;
}

/* 中部两栏 */
.wb-mid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  align-items: flex-start;
  gap: 20px;
}

.wb-card-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--m-color-text);
}

.wb-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--m-color-text);
}

.wb-skel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-empty {
  padding-block: 24px;
}

.wb-page-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wb-page-item {
  display: flex;
  cursor: pointer;
  align-items: center;
  gap: 12px;
  border: none;
  border-radius: var(--m-radius-md);
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  transition:
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--m-color-split);
  }
}

.wb-page-icon {
  height: 38px;
  width: 38px;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-md);
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
}

.wb-page-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.wb-page-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
}

.wb-page-meta {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.wb-page-count {
  flex: none;
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
}

.wb-page-arrow {
  flex: none;
  color: var(--m-color-text-muted);
}

/* 数据概览 */
.wb-donut-skel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-block: 40px;
}

.wb-donut-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wb-donut-area {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

// ECharts 实例依赖容器的确定尺寸。
.wb-donut {
  width: 100%;
  height: 220px;
}

.wb-donut-center {
  pointer-events: none;
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  transform: translate(-50%, -50%);
  flex-direction: column;
  align-items: center;
}

.wb-donut-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--m-color-text);
}

.wb-donut-label {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.wb-legend {
  margin: 0;
  display: flex;
  list-style: none;
  flex-direction: column;
  gap: 8px;
  padding: 0;
}

.wb-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.wb-dot {
  height: 10px;
  width: 10px;
  flex: none;
  border-radius: 3px;
}

.wb-legend-name {
  flex: 1;
  color: var(--m-color-text-muted);
}

.wb-legend-value {
  font-weight: 700;
  color: var(--m-color-text);
}

/* 右侧信息面板 */
.wb-side {
  position: sticky;
  top: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.wb-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-user-avatar {
  height: 42px;
  width: 42px;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(135deg, var(--m-color-primary), var(--m-color-accent-blue));
  font-weight: 700;
  color: var(--m-color-surface);
}

.wb-user-info {
  display: flex;
  flex-direction: column;
}

.wb-user-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--m-color-text);
}

.wb-user-plan {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.wb-members {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wb-members-bar {
  height: 8px;
  display: flex;
  gap: 2px;
  overflow: hidden;
  border-radius: 9999px;
}

.wb-members-seg {
  display: block;
  border-radius: 9999px;
}

.wb-members-list {
  margin: 0;
  display: flex;
  list-style: none;
  flex-direction: column;
  gap: 10px;
  padding: 0;
}

.wb-member-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.wb-member-name {
  flex: 1;
  color: var(--m-color-text-muted);
}

.wb-member-pct {
  font-weight: 700;
  color: var(--m-color-text);
}

.wb-upgrade {
  position: relative;
  overflow: hidden;
}

.wb-upgrade-desc {
  margin: 0;
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.wb-upgrade-btn {
  align-self: flex-start;
}

.wb-upgrade-crown {
  display: flex;
  justify-content: center;
  padding-top: 8px;
  color: var(--m-color-primary);
  opacity: 0.6;
}

@media (max-width: 1100px) {
  .wb {
    grid-template-columns: 1fr;
  }

  .wb-side {
    position: static;
    flex-flow: row wrap;

    > * {
      flex: 1 1 240px;
    }
  }
}

@media (max-width: 760px) {
  .wb-mid,
  .wb-banner {
    grid-template-columns: 1fr;
  }
}
</style>
