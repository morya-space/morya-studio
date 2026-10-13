<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MButton, MCard } from 'morya-ui'
import type { CardSchema } from '../../types/schema'
import SvgIcon from '../common/SvgIcon.vue'

defineProps<{
  schema: CardSchema
}>()

const emit = defineEmits<{
  action: [action: string]
}>()

const { t } = useI18n()
</script>

<template>
  <MCard shadow="always" :bordered="false" class="upgrade-card">
    <h3 class="upgrade-title">{{ t('dashboard.upgrade.title') }}</h3>
    <p class="upgrade-description">{{ t('dashboard.upgrade.description') }}</p>

    <MButton
      type="primary"
      class="upgrade-button"
      @click="emit('action', schema.banner?.buttonAction ?? '')"
    >
      <template #icon>
        <SvgIcon name="crown" size="md" />
      </template>
      {{ t('dashboard.upgrade.button') }}
    </MButton>
  </MCard>
</template>

<style scoped>
.upgrade-card {
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.upgrade-card :deep(.m-card__body) {
  padding: 24px;
}

.upgrade-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 8px;
}

.upgrade-description {
  font-size: 13px;
  color: var(--m-color-text-muted);
  line-height: 1.5;
  margin: 0 0 20px;
}

.upgrade-button {
  border-radius: 24px;
  background: #1F2937;
  border-color: #1F2937;
}

.upgrade-button:hover {
  background: #111827;
  border-color: #111827;
}
</style>
