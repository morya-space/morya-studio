<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MDropdown, MInput, message } from 'morya-ui'
import SvgIcon from '../components/common/SvgIcon.vue'
import LocaleSwitch from '../components/common/LocaleSwitch.vue'
import UserMenu from '../components/shell/UserMenu.vue'

const { t } = useI18n()

const teams = [
  { value: 'dek', label: 'header.teamDek' },
  { value: 'north', label: 'header.teamNorth' },
  { value: 'east', label: 'header.teamEast' },
]

const teamId = ref('dek')
const teamOpen = ref(false)
const query = ref('')
const teamLabel = computed(() => teams.find(team => team.value === teamId.value)?.label ?? 'header.teamDek')

function onTeam(item: { value?: string }) {
  teamOpen.value = false
  if (!item.value || item.value === teamId.value) return
  message.info(t('header.teamNotReady'))
}

function onSearch() {
  const text = query.value.trim()
  if (!text) return
  message.info(t('header.searchNotReady'))
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <MDropdown v-model="teamOpen" :items="teams.map(team => ({ ...team, label: t(team.label) }))" @select="onTeam">
        <template #trigger>
          <span class="team-selector">
            <span class="team-name">{{ t(teamLabel) }}</span>
            <SvgIcon name="chevron-down" size="md" />
          </span>
        </template>
      </MDropdown>

      <div class="header-search" @keydown.enter="onSearch">
        <MInput
          v-model="query"
          :placeholder="t('header.searchPlaceholder')"
          clearable
        >
          <template #prefix>
            <SvgIcon name="search" size="md" />
          </template>
        </MInput>
      </div>
    </div>
    <div class="header-right">
      <LocaleSwitch />
      <UserMenu />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: var(--m-color-surface);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.team-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  color: var(--m-color-text);
  cursor: pointer;
  padding: 8px 4px;
  border-radius: 8px;
}

.team-selector:hover {
  background: var(--m-color-split);
}

:deep(.m-dropdown__trigger:focus-visible) {
  outline: 2px solid var(--m-color-primary);
  outline-offset: 2px;
  border-radius: 8px;
}

.header-search {
  width: 300px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
</style>
