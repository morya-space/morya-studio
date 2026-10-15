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

// 中间：数据概览仪表（参考图 gauge）
const gaugeSegments = computed(() => {
  const total = Math.max(pages.value.length + dsCount.value + componentCount.value + templateCount.value, 1)
  return [
    { label: t('workbench.panelCount'), value: pages.value.length, color: 'var(--m-color-primary)', pct: Math.round((pages.value.length / total) * 100) },
    { label: t('workbench.dsCount'), value: dsCount.value, color: 'var(--m-color-accent-blue)', pct: Math.round((dsCount.value / total) * 100) },
    { label: t('workbench.componentCount'), value: componentCount.value, color: 'var(--m-color-accent-orange)', pct: Math.round((componentCount.value / total) * 100) },
    { label: t('workbench.templateCount'), value: templateCount.value, color: 'var(--m-color-success)', pct: Math.round((templateCount.value / total) * 100) },
  ]
})

// 仪表圆弧（SVG）：0~100 映射到 180°~0° 半圆
const gaugeArc = computed(() => {
  const R = 70
  const CX = 90
  const CY = 90
  const total = gaugeSegments.value.reduce((n, s) => n + s.value, 0) || 1
  let acc = 0
  return gaugeSegments.value
    .filter(s => s.value > 0)
    .map(s => {
      const start = acc / total
      acc += s.value
      const end = acc / total
      const a0 = Math.PI * (1 - start)
      const a1 = Math.PI * (1 - end)
      const x0 = CX + R * Math.cos(a0)
      const y0 = CY - R * Math.sin(a0)
      const x1 = CX + R * Math.cos(a1)
      const y1 = CY - R * Math.sin(a1)
      const large = end - start > 0.5 ? 1 : 0
      return { d: `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`, color: s.color }
    })
})

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
    <div class="wb__main">
      <!-- 顶部：问候 + 操作 -->
      <div class="wb-top">
        <div class="wb-top__text">
          <h1 class="wb-greeting">{{ t('workbench.greeting') }}</h1>
          <p class="wb-total">{{ totalCards }} <span>{{ t('workbench.cardTotal') }}</span></p>
        </div>
        <div class="wb-top__actions">
          <MButton type="default" @click="router.push('/panels')">{{ t('workbench.viewAll') }}</MButton>
          <MButton type="primary" @click="router.push(`/editor/${genPageId()}`)">
            <SvgIcon name="plus" :px="14" /> {{ t('workbench.newPanel') }}
          </MButton>
        </div>
      </div>

      <!-- 紫色资产横幅 -->
      <MSkeleton v-if="loading" height="104px" border-radius="var(--m-radius-lg)" />
      <section v-else class="wb-banner">
        <div v-for="s in bannerStats" :key="s.key" class="wb-banner__item">
          <span class="wb-banner__icon"><SvgIcon :name="s.icon" :px="22" /></span>
          <div class="wb-banner__meta">
            <span class="wb-banner__label">{{ s.label }}</span>
            <span class="wb-banner__value">
              {{ s.value }}
              <em class="wb-banner__trend">{{ s.trend }}</em>
            </span>
          </div>
        </div>
      </section>

      <!-- 中部两栏：最近面板 + 数据概览 -->
      <div class="wb-mid">
        <!-- 最近面板（交易列表风） -->
        <MCard class="wb-panels" shadow="always" :bordered="false">
          <template #header>
            <div class="wb-panel__head">
              <h3 class="wb-panel__title">{{ t('workbench.recentPanels') }}</h3>
              <MButton type="text" size="small" @click="router.push('/panels')">{{ t('workbench.viewAll') }}</MButton>
            </div>
          </template>

          <div v-if="loading" class="wb-skeleton-rows">
            <MSkeleton v-for="i in 4" :key="i" height="52px" border-radius="var(--m-radius-md)" />
          </div>

          <div v-else-if="recentPages.length === 0" class="wb-panels__empty">
            <MEmpty :title="t('workbench.emptyTitle')" :description="t('workbench.emptyDesc')">
              <template #extra>
                <MButton type="primary" @click="router.push(`/editor/${genPageId()}`)">{{ t('workbench.createNow') }}</MButton>
              </template>
            </MEmpty>
          </div>

          <div v-else class="wb-tx">
            <button
              v-for="page in recentPages"
              :key="page.id"
              type="button"
              class="wb-tx__row"
              @click="onEdit(page.id)"
            >
              <span class="wb-tx__thumb"><SvgIcon name="layout" :px="18" /></span>
              <span class="wb-tx__main">
                <span class="wb-tx__title">{{ page.title }}</span>
                <span class="wb-tx__sub">{{ fmtDate(page.meta?.updatedAt) }} · {{ t('workbench.cardCount', { n: page.cards.length }) }}</span>
              </span>
              <span class="wb-tx__value">{{ page.cards.length }}</span>
              <SvgIcon name="arrow-up-right" :px="16" class="wb-tx__go" />
            </button>
          </div>
        </MCard>

        <!-- 数据概览（仪表风） -->
        <MCard class="wb-gauge" shadow="always" :bordered="false">
          <template #header>
            <div class="wb-panel__head">
              <h3 class="wb-panel__title">{{ t('workbench.overview') }}</h3>
            </div>
          </template>
          <div v-if="loading" class="wb-gauge__skeleton">
            <MSkeleton shape="circle" width="150px" height="150px" />
          </div>
          <div v-else class="wb-gauge__content">
          <div class="wb-gauge__body">
            <svg class="wb-gauge__svg" viewBox="0 0 180 100" aria-hidden="true">
              <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="var(--m-color-split)" stroke-width="14" stroke-linecap="round" />
              <path
                v-for="(seg, i) in gaugeArc"
                :key="i"
                :d="seg.d"
                fill="none"
                :stroke="seg.color"
                stroke-width="14"
                stroke-linecap="round"
              />
            </svg>
            <div class="wb-gauge__center">
              <span class="wb-gauge__num">{{ totalCards }}</span>
              <span class="wb-gauge__cap">{{ t('workbench.cardTotal') }}</span>
            </div>
          </div>
          <ul class="wb-gauge__legend">
            <li v-for="s in gaugeSegments" :key="s.label">
              <span class="dot" :style="{ background: s.color }" />
              <span class="wb-gauge__legend-label">{{ s.label }}</span>
              <span class="wb-gauge__legend-val">{{ s.value }}</span>
            </li>
          </ul>
          </div>
        </MCard>
      </div>
    </div>

    <!-- ============ 右侧信息面板 ============ -->
    <aside class="wb-side">
      <!-- 用户卡 -->
      <MCard shadow="always" :bordered="false" size="sm">
        <div class="wb-side__user">
          <span class="wb-side__avatar">{{ (user?.name ?? 'M').slice(0, 1) }}</span>
          <div class="wb-side__user-meta">
            <span class="wb-side__user-name">{{ user?.name ?? 'Member' }}</span>
            <span class="wb-side__user-plan">{{ t('user.freeMember') }}</span>
          </div>
        </div>
      </MCard>

      <!-- Active Members -->
      <MCard shadow="always" :bordered="false">
        <template #header>
          <h4 class="wb-card__title">{{ t('workbench.activeMembers') }}</h4>
        </template>
        <div class="wb-card__body">
        <div class="wb-members__bar">
          <span
            v-for="m in members"
            :key="m.name"
            class="wb-members__seg"
            :style="{ width: `${m.pct}%`, background: m.color }"
          />
        </div>
        <ul class="wb-members__list">
          <li v-for="m in members" :key="m.name">
            <span class="dot" :style="{ background: m.color }" />
            <span class="wb-members__name">{{ m.name }}</span>
            <span class="wb-members__pct">{{ m.pct }}%</span>
          </li>
        </ul>
        </div>
      </MCard>

      <!-- Upgrade -->
      <MCard class="wb-upgrade" shadow="always" :bordered="false">
        <template #header>
          <h4 class="wb-card__title">{{ t('workbench.upgradeTitle') }}</h4>
        </template>
        <div class="wb-card__body">
        <p class="wb-upgrade__desc">{{ t('workbench.upgradeDesc') }}</p>
        <MButton type="primary" class="wb-upgrade__btn" @click="router.push('/settings')">
          {{ t('workbench.upgradeNow') }}
        </MButton>
        <div class="wb-upgrade__art" aria-hidden="true">
          <SvgIcon name="crown" :px="64" />
        </div>
        </div>
      </MCard>
    </aside>
  </div>
</template>

<style scoped>
.wb {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 28px;
  padding: 28px 32px;
  background: var(--m-color-page-bg);
  height: 100%;
  overflow-y: auto;
  align-items: start;
}

/* ============ 主内容 ============ */
.wb__main {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.wb-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.wb-greeting {
  font-size: 30px;
  font-weight: 800;
  color: var(--m-color-text);
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}

.wb-total {
  font-size: 26px;
  font-weight: 800;
  color: var(--m-color-primary);
  margin: 0;
}

.wb-total span {
  font-size: 13px;
  font-weight: 500;
  color: var(--m-color-text-muted);
  margin-left: 6px;
}

.wb-top__actions {
  display: flex;
  gap: 8px;
}

.wb-skeleton-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-gauge__skeleton {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

/* 紫色横幅 */
.wb-banner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 24px 28px;
  border-radius: var(--m-radius-lg);
  background: linear-gradient(120deg, var(--m-color-primary), color-mix(in srgb, var(--m-color-primary) 70%, var(--m-color-accent-blue)));
  box-shadow: var(--m-shadow-card);
}

.wb-banner__item {
  display: flex;
  align-items: center;
  gap: 14px;
}

.wb-banner__icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-color-surface) 20%, transparent);
  color: var(--m-color-surface);
  flex-shrink: 0;
}

.wb-banner__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.wb-banner__label {
  font-size: 12px;
  color: color-mix(in srgb, var(--m-color-surface) 80%, transparent);
}

.wb-banner__value {
  font-size: 24px;
  font-weight: 800;
  color: var(--m-color-surface);
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-banner__trend {
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-surface) 22%, transparent);
}

/* 中部两栏 */
.wb-mid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

/* 中部卡片外观由 MCard 承载，这里只留头部布局 */
.wb-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.wb-panel__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.wb-panels__empty {
  padding: 24px 0;
}

/* 交易列表风 */
.wb-tx {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wb-tx__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--m-radius-md);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
}

.wb-tx__row:hover {
  background: var(--m-color-split);
}

.wb-tx__thumb {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-md);
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
  flex-shrink: 0;
}

.wb-tx__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.wb-tx__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-tx__sub {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.wb-tx__value {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  flex-shrink: 0;
}

.wb-tx__go {
  color: var(--m-color-text-muted);
  flex-shrink: 0;
}

/* 数据概览仪表 */
.wb-gauge__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wb-gauge__body {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.wb-gauge__svg {
  width: 100%;
  max-width: 220px;
}

.wb-gauge__center {
  position: absolute;
  left: 50%;
  bottom: 4px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wb-gauge__num {
  font-size: 26px;
  font-weight: 800;
  color: var(--m-color-text);
}

.wb-gauge__cap {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.wb-gauge__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-gauge__legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.wb-gauge__legend-label {
  color: var(--m-color-text-muted);
  flex: 1;
}

.wb-gauge__legend-val {
  font-weight: 700;
  color: var(--m-color-text);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* ============ 右侧 ============ */
.wb-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 28px;
}

.wb-side__user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-side__avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--m-color-surface);
  background: linear-gradient(135deg, var(--m-color-primary), var(--m-color-accent-blue));
  flex-shrink: 0;
}

.wb-side__user-meta {
  display: flex;
  flex-direction: column;
}

.wb-side__user-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--m-color-text);
}

.wb-side__user-plan {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

/* 右侧卡片外观由 MCard 承载，body 内多元素间距用 wrapper 保持 */
.wb-card__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wb-card__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.wb-members__bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  gap: 2px;
}

.wb-members__seg {
  display: block;
  border-radius: 999px;
}

.wb-members__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wb-members__list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.wb-members__name {
  color: var(--m-color-text-muted);
  flex: 1;
}

.wb-members__pct {
  font-weight: 700;
  color: var(--m-color-text);
}

/* Upgrade */
.wb-upgrade {
  position: relative;
  overflow: hidden;
}

.wb-upgrade__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.wb-upgrade__btn {
  align-self: flex-start;
}

.wb-upgrade__art {
  display: flex;
  justify-content: center;
  color: var(--m-color-primary);
  opacity: 0.6;
  padding-top: 8px;
}

/* 响应式 */
@media (max-width: 1100px) {
  .wb {
    grid-template-columns: 1fr;
  }
  .wb-side {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .wb-side > * {
    flex: 1 1 240px;
  }
}

@media (max-width: 760px) {
  .wb-mid {
    grid-template-columns: 1fr;
  }
  .wb-banner {
    grid-template-columns: 1fr;
  }
}
</style>
