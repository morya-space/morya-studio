<script setup lang="ts">
/**
 * 分析（/analytics）
 * 占位页：跨面板的数据洞察、趋势对比与智能解读能力建设中。
 */

import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'

const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <WorkspacePage :title="t('pages.analytics.title')" :summary="t('pages.analytics.summary')">
    <div class="analytics-placeholder">
      <div class="analytics-placeholder__icon">
        <SvgIcon name="bar-chart" :px="40" />
      </div>
      <h3 class="analytics-placeholder__title">{{ t('analytics.title') }}</h3>
      <p class="analytics-placeholder__desc">{{ t('analytics.desc') }}</p>
      <p class="analytics-placeholder__hint">{{ t('analytics.hint') }}</p>
      <div class="analytics-placeholder__actions">
        <MButton type="primary" @click="router.push('/panels')">{{ t('analytics.goPanels') }}</MButton>
        <MButton type="default" @click="router.push('/components')">{{ t('analytics.goComponents') }}</MButton>
      </div>
    </div>
  </WorkspacePage>
</template>

<style scoped>
.analytics-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  padding: 80px 24px;
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
}

.analytics-placeholder__icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
  margin-bottom: 8px;
}

.analytics-placeholder__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.analytics-placeholder__desc {
  font-size: 14px;
  color: var(--m-color-text);
  margin: 0;
  max-width: 32rem;
}

.analytics-placeholder__hint {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
  max-width: 32rem;
}

.analytics-placeholder__actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}
</style>
