<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAvatar, MAvatarGroup, MCard } from 'morya-ui'
import type { CardSchema } from '../../types/schema'
import { useDataSource } from '../../composables/useDataSource'
import SvgIcon from '../common/SvgIcon.vue'

const props = defineProps<{
  schema: CardSchema
}>()

const { t } = useI18n()
const { data } = useDataSource(props.schema.dataSource)

const roles = computed(() => data.value)

const roleKeys: Record<string, string> = {
  'UI Designer': 'dashboard.members.roles.designer',
  'Illustrator': 'dashboard.members.roles.illustrator',
  'Leader': 'dashboard.members.roles.leader',
}
</script>

<template>
  <MCard shadow="always" :bordered="false" class="members-card">
    <template #header>
      <div class="card-header">
        <h3 class="card-title">{{ t('dashboard.members.title') }}</h3>
        <button class="card-more" :aria-label="t('dashboard.members.moreOptions')">
          <SvgIcon name="more" size="lg" />
        </button>
      </div>
    </template>

    <div class="members-avatars">
      <MAvatarGroup :max="4">
        <MAvatar label="AL" style="background: #7C6AEF; color: #fff" />
        <MAvatar label="BK" style="background: #F59E0B; color: #fff" />
        <MAvatar label="CN" style="background: #EC4899; color: #fff" />
        <MAvatar label="DY" style="background: #5B8DEF; color: #fff" />
        <MAvatar label="+6" style="background: #1F2937; color: #fff" />
      </MAvatarGroup>
    </div>

    <div class="members-progress">
      <div class="progress-bar-track">
        <div
          v-for="(role, i) in roles"
          :key="i"
          class="progress-segment"
          :style="{ width: `${role.percent}%`, background: String(role.color) }"
        />
      </div>
    </div>

    <div class="members-legend">
      <div
        v-for="(role, i) in roles"
        :key="i"
        class="legend-item"
      >
        <span class="legend-dot" :style="{ background: String(role.color) }" />
        <span class="legend-role">{{ t(roleKeys[String(role.role)] ?? 'dashboard.members.roles.designer') }}</span>
        <span class="legend-percent">{{ role.percent }}%</span>
      </div>
    </div>
  </MCard>
</template>

<style scoped>
.members-card {
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.members-card :deep(.m-card__header),
.members-card :deep(.m-card__body) {
  padding: 24px;
}

.members-card :deep(.m-card__header) {
  padding-bottom: 0;
  border-bottom: none;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.card-more {
  border: none;
  background: transparent;
  color: var(--m-color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.members-avatars {
  margin-bottom: 20px;
}

.members-progress {
  margin-bottom: 16px;
}

.progress-bar-track {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  gap: 2px;
}

.progress-segment {
  border-radius: 3px;
}

.members-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-role {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.legend-percent {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
}
</style>
