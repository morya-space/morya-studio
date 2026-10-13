<script setup lang="ts">
/**
 * 横幅卡（banner）
 * 品牌渐变背景 + 标题 + 描述 + CTA 按钮。
 * 视觉规范：docs/DESIGN-DEV.md §12.6 KPI Banner。
 */

import { computed } from 'vue'
import { MButton } from 'morya-ui'
import CardShell from './CardShell.vue'
import type { CardProps, CardEmits } from './types'

const props = defineProps<CardProps>()
const emit = defineEmits<CardEmits>()

const banner = computed(() => props.schema.banner)

const background = computed(() =>
  banner.value?.gradient ?? 'var(--m-gradient-brand)',
)

function onCta() {
  if (banner.value?.buttonAction) {
    emit('action', {
      label: banner.value.buttonText ?? '',
      action: banner.value.buttonAction,
      type: 'primary',
    })
  }
}
</script>

<template>
  <CardShell
    :loading="loading"
    :error="error"
    :show-header="false"
    :state-text="schema.stateText"
    @retry="emit('retry')"
  >
    <div class="banner-card" :style="{ background }">
      <div class="banner-card__content">
        <h3 class="banner-card__title">{{ banner?.title ?? schema.title }}</h3>
        <p v-if="banner?.description" class="banner-card__desc">{{ banner.description }}</p>
      </div>
      <MButton
        v-if="banner?.buttonText"
        class="banner-card__cta"
        @click="onCta"
      >
        {{ banner.buttonText }}
      </MButton>
    </div>
  </CardShell>
</template>

<style scoped>
.banner-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-radius: var(--m-radius-lg);
  padding: 24px 28px;
  box-shadow: var(--m-shadow-banner);
  color: var(--m-color-text-on-primary, #fff);
}

.banner-card__content {
  min-width: 0;
}

.banner-card__title {
  font-size: 17px;
  font-weight: 700;
  margin: 0;
  color: inherit;
}

.banner-card__desc {
  font-size: 13px;
  margin: 6px 0 0;
  opacity: 0.85;
  color: inherit;
}

.banner-card__cta {
  flex-shrink: 0;
}
</style>
