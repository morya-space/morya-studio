<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MAvatar, MDropdown, message } from 'morya-ui'
import SvgIcon from '../common/SvgIcon.vue'
import { useSession } from '../../composables/useSession'

const router = useRouter()
const { user, logout } = useSession()
const { t } = useI18n()
const menuOpen = ref(false)

const initial = computed(() => user.value?.name.slice(0, 1) ?? 'G')

const items = computed(() => [
  { value: 'settings', label: t('user.accountSettings') },
  { value: 'logout', label: t('user.signOut') },
])

function onNotify() {
  message.info(t('user.notificationsNotReady'))
}

async function onSelect(item: { value?: string }) {
  menuOpen.value = false
  if (item.value === 'settings') {
    router.push('/settings')
    return
  }
  if (item.value === 'logout') {
    await logout()
    router.replace('/login')
  }
}
</script>

<template>
  <div class="user-section">
    <button class="user-notification" type="button" :aria-label="t('user.notifications')" @click="onNotify">
      <SvgIcon name="bell" size="lg" />
      <span class="notification-dot" />
    </button>
    <MDropdown v-model="menuOpen" :items="items" placement="bottom-end" @select="onSelect">
      <template #trigger>
        <span class="user-profile" :aria-label="t('user.accountMenu')">
          <MAvatar
            :label="initial"
            :style="{ background: 'var(--m-color-accent-orange)', color: 'var(--m-color-surface)' }"
          />
          <span class="user-info">
            <span class="user-name">{{ user?.name }}</span>
            <span class="user-plan">{{ t('user.freeMember') }}</span>
          </span>
          <SvgIcon name="chevron-down" size="md" />
        </span>
      </template>
    </MDropdown>
  </div>
</template>

<style scoped>
.user-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.user-notification {
  position: relative;
  border: none;
  background: transparent;
  color: var(--m-color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--m-radius-sm);
}

.notification-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--m-color-accent-pink);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--m-radius-sm);
  color: inherit;
}

.user-notification:focus-visible {
  outline: 2px solid var(--m-color-primary);
  outline-offset: 2px;
}

:deep(.m-dropdown__trigger:focus-visible) {
  outline: 2px solid var(--m-color-primary);
  outline-offset: 2px;
  border-radius: var(--m-radius-sm);
}

.user-info {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
}

.user-plan {
  font-size: 12px;
  color: var(--m-color-text-muted);
}
</style>
