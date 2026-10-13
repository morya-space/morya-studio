<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MCard } from 'morya-ui'
import type { CardSchema } from '../../types/schema'
import { useDataSource } from '../../composables/useDataSource'
import SvgIcon from '../common/SvgIcon.vue'

const props = defineProps<{
  schema: CardSchema
}>()

const { t } = useI18n()
const { data } = useDataSource(props.schema.dataSource)

const metrics = computed(() => data.value)

const labelKeys: Record<string, string> = {
  'Opening balance': 'dashboard.kpi.opening',
  'Credit for period': 'dashboard.kpi.credit',
  'Debits for period': 'dashboard.kpi.debits',
}

function formatCurrency(value: unknown): string {
  const num = Number(value)
  return `$${num.toLocaleString('en-US')}`
}
</script>

<template>
  <MCard shadow="always" :bordered="false" class="kpi-banner" :style="{ background: schema.banner?.gradient }">
    <div
      v-for="(metric, index) in metrics"
      :key="index"
      class="kpi-item"
    >
      <div class="kpi-icon">
        <SvgIcon :name="String(metric.icon ?? 'wallet')" :px="24" />
      </div>
      <div class="kpi-content">
        <p class="kpi-label">{{ t(labelKeys[String(metric.label)] ?? 'dashboard.kpi.opening') }}</p>
        <div class="kpi-value-row">
          <span class="kpi-value">{{ formatCurrency(metric.value) }}</span>
          <span class="kpi-trend" :class="`trend--${metric.trendDirection}`">
            {{ metric.trend }}
          </span>
        </div>
        <p class="kpi-meta">{{ t('dashboard.kpi.lastYear', { value: metric.lastYear }) }}</p>
      </div>
    </div>
  </MCard>
</template>

<style scoped>
.kpi-banner {
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  box-shadow: 0 8px 24px rgba(124, 106, 239, 0.25);
}

.kpi-banner :deep(.m-card__body) {
  padding: 28px 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
}

.kpi-item {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.kpi-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.kpi-content {
  min-width: 0;
}

.kpi-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 4px;
}

.kpi-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.kpi-trend {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.kpi-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  margin: 4px 0 0;
}
</style>
