<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MButton, MSelect, message } from 'morya-ui'
import { dashboardSchema, sidebarSchema } from '../schemas/dashboard'
import KpiBanner from '../components/dashboard/KpiBanner.vue'
import TransactionsPanel from '../components/dashboard/TransactionsPanel.vue'
import ActiveMembersCard from '../components/dashboard/ActiveMembersCard.vue'
import UpgradeCard from '../components/dashboard/UpgradeCard.vue'   
import SvgIcon from '../components/common/SvgIcon.vue'            
const { t } = useI18n()

const mainCards = computed(() => dashboardSchema.cards)
const sidebarCards = computed(() => sidebarSchema.cards)

const kpiBanner = computed(() => mainCards.value.find(c => c.id === 'kpi-banner'))
const transactionsPanel = computed(() => mainCards.value.find(c => c.id === 'transactions-panel'))
const activeMembers = computed(() => sidebarCards.value.find(c => c.id === 'active-members'))
const upgradeAccount = computed(() => sidebarCards.value.find(c => c.id === 'upgrade-account'))

const weekOptions = computed(() => [
  { label: t('dashboard.periodWeek'), value: 'week' },
  { label: t('dashboard.periodMonth'), value: 'month' },
  { label: t('dashboard.periodYear'), value: 'year' },
])

const period = ref('week')

function onDownload() {
  message.info(t('dashboard.downloadNotReady'))
}

function handleUpgrade() {
  message.info(t('dashboard.upgradeNotReady'))
}
</script>

<template>
  <div class="dashboard-view">
    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 问候区 -->
      <div class="greeting-section">
        <div class="greeting-left">
          <h1 class="greeting-title">{{ t('dashboard.greeting') }}</h1>
          <p class="greeting-balance">$24,800.00</p>
        </div>
        <div class="greeting-actions">
          <MSelect
            v-model="period"
            :options="weekOptions"
            style="width: 120px"
          />
          <MButton @click="onDownload">{{ t('dashboard.downloadReport') }}</MButton>
        </div>
      </div>

      <!-- KPI 渐变 Banner -->
      <KpiBanner v-if="kpiBanner" :schema="kpiBanner" />

      <!-- 交易面板 -->
      <TransactionsPanel v-if="transactionsPanel" :schema="transactionsPanel" />
    </div>

    <!-- 右侧栏 -->
    <aside class="right-sidebar">
      <ActiveMembersCard v-if="activeMembers" :schema="activeMembers" />
      <UpgradeCard v-if="upgradeAccount" :schema="upgradeAccount" @action="handleUpgrade" />

      <!-- 插画 -->
      <div class="sidebar-illustration">
        <svg viewBox="0 0 280 200" fill="none">
          <rect width="280" height="200" rx="16" fill="#E0F2FE" />
          <circle cx="140" cy="70" r="24" fill="#7C6AEF" opacity="0.2" />
          <path d="M120 130 Q140 90 160 130" stroke="#7C6AEF" stroke-width="3" stroke-linecap="round" fill="none" />
          <ellipse cx="140" cy="145" rx="30" ry="8" fill="#7C6AEF" opacity="0.15" />
          <circle cx="100" cy="60" r="3" fill="#5B8DEF" />
          <circle cx="185" cy="50" r="4" fill="#F59E0B" opacity="0.6" />
          <circle cx="200" cy="90" r="2.5" fill="#EC4899" opacity="0.5" />
        </svg>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.dashboard-view {
  display: flex;
  gap: 24px;
  padding: 24px 32px;
  background: var(--m-color-page-bg);
  min-height: 100%;
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 问候区 */
.greeting-section {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.greeting-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 4px;
}

.greeting-balance {
  font-size: 15px;
  font-weight: 600;
  color: var(--m-color-primary);
  margin: 0;
}

.greeting-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 右侧栏 */
.right-sidebar {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar-illustration {
  border-radius: 20px;
  overflow: hidden;
}

.sidebar-illustration svg {
  width: 100%;
  display: block;
}

@media (max-width: 1280px) {
  .dashboard-view {
    flex-direction: column;
  }

  .right-sidebar {
    width: 100%;
  }
}
</style>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            