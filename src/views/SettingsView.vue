<script setup lang="ts">
/**
 * 设置（/settings）
 * 账户资料（可编辑）/ 修改密码 / 工作区 / 偏好（语言等）。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MForm, MFormItem, MInput, MSelect, message } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import { useSession } from '../composables/useSession'
import { setLocale, supportedLocales, type AppLocale } from '../locales'
import { updateProfile, changePassword, getWorkspace, saveWorkspace } from '../services/settings'

const { t, locale } = useI18n()
const router = useRouter()
const { user, setUser, logout } = useSession()

// 账户资料（可编辑）
const displayName = ref('')
const avatar = ref('')
const savingProfile = ref(false)

// 修改密码
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)

// 工作区
const workspaceName = ref('Morya Studio')
const savingWorkspace = ref(false)

const email = computed(() => user.value?.email ?? '')
const plan = computed(() => 'Free')

// 偏好：语言
const currentLocale = computed({
  get: () => locale.value as AppLocale,
  set: (v: AppLocale) => setLocale(v),
})

onMounted(async () => {
  displayName.value = user.value?.name ?? ''
  avatar.value = user.value?.avatar ?? ''
  try {
    const ws = await getWorkspace()
    if (ws.name) workspaceName.value = ws.name
  } catch { /* 忽略，用默认 */ }
})

async function onSaveProfile() {
  if (savingProfile.value) return
  savingProfile.value = true
  try {
    const updated = await updateProfile({ name: displayName.value.trim() || undefined, avatar: avatar.value.trim() })
    setUser(updated)
    message.success(t('settings.profileUpdated'))
  } catch {
    message.error(t('common.error'))
  } finally {
    savingProfile.value = false
  }
}

async function onChangePassword() {
  if (savingPassword.value) return
  if (newPassword.value !== confirmPassword.value) {
    message.error(t('settings.passwordMismatch'))
    return
  }
  savingPassword.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    message.success(t('settings.passwordUpdated'))
    currentPassword.value = newPassword.value = confirmPassword.value = ''
    // 后端已吊销会话，重新登录
    await logout()
    router.push('/login')
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    savingPassword.value = false
  }
}

async function onSaveWorkspace() {
  if (savingWorkspace.value) return
  savingWorkspace.value = true
  try {
    await saveWorkspace({ name: workspaceName.value.trim() })
    message.success(t('settings.workspaceSaved'))
  } catch {
    message.error(t('common.error'))
  } finally {
    savingWorkspace.value = false
  }
}

function onNotReady() {
  message.info(t('settings.notReady'))
}
</script>

<template>
  <WorkspacePage :title="t('pages.settings.title')" :summary="t('pages.settings.summary')">
    <div class="settings">
      <!-- 账户资料 -->
      <section class="settings-block">
        <header class="settings-block__head">
          <h3 class="settings-block__title">{{ t('settings.accountTitle') }}</h3>
          <p class="settings-block__desc">{{ t('settings.accountDesc') }}</p>
        </header>
        <div class="settings-block__body">
          <MForm>
            <MFormItem :label="t('settings.email')">
              <MInput :model-value="email" type="email" readonly fluid />
            </MFormItem>
            <MFormItem :label="t('settings.displayName')">
              <MInput v-model="displayName" fluid />
            </MFormItem>
            <MFormItem :label="t('settings.avatar')">
              <MInput v-model="avatar" :placeholder="t('settings.avatarHint')" fluid />
            </MFormItem>
            <MFormItem :label="t('settings.plan')">
              <MInput :model-value="plan" readonly fluid />
            </MFormItem>
          </MForm>
          <div class="settings-block__actions">
            <MButton type="primary" :loading="savingProfile" @click="onSaveProfile">{{ t('settings.updateProfile') }}</MButton>
          </div>
        </div>
      </section>

      <!-- 修改密码 -->
      <section class="settings-block">
        <header class="settings-block__head">
          <h3 class="settings-block__title">{{ t('settings.changePassword') }}</h3>
        </header>
        <div class="settings-block__body">
          <MForm>
            <MFormItem :label="t('settings.currentPassword')">
              <MInput v-model="currentPassword" type="password" fluid />
            </MFormItem>
            <MFormItem :label="t('settings.newPassword')">
              <MInput v-model="newPassword" type="password" fluid />
            </MFormItem>
            <MFormItem :label="t('settings.confirmPassword')">
              <MInput v-model="confirmPassword" type="password" fluid />
            </MFormItem>
          </MForm>
          <div class="settings-block__actions">
            <MButton type="primary" :loading="savingPassword" @click="onChangePassword">{{ t('settings.changePassword') }}</MButton>
          </div>
        </div>
      </section>

      <!-- 工作区 -->
      <section class="settings-block">
        <header class="settings-block__head">
          <h3 class="settings-block__title">{{ t('settings.workspaceTitle') }}</h3>
          <p class="settings-block__desc">{{ t('settings.workspaceDesc') }}</p>
        </header>
        <div class="settings-block__body">
          <MForm>
            <MFormItem :label="t('settings.workspaceName')">
              <MInput v-model="workspaceName" fluid />
            </MFormItem>
          </MForm>
          <div class="settings-block__actions">
            <MButton type="primary" :loading="savingWorkspace" @click="onSaveWorkspace">{{ t('settings.saveWorkspace') }}</MButton>
          </div>
        </div>
      </section>

      <!-- 偏好 -->
      <section class="settings-block">
        <header class="settings-block__head">
          <h3 class="settings-block__title">{{ t('settings.preferencesTitle') }}</h3>
          <p class="settings-block__desc">{{ t('settings.preferencesDesc') }}</p>
        </header>
        <div class="settings-block__body">
          <MForm>
            <MFormItem :label="t('settings.language')">
              <MSelect v-model="currentLocale" :options="supportedLocales" fluid />
            </MFormItem>
            <MFormItem :label="t('settings.theme')">
              <MButton type="default" @click="onNotReady">{{ t('settings.themeAuto') }}</MButton>
            </MFormItem>
          </MForm>
        </div>
      </section>
    </div>
  </WorkspacePage>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 640px;
}

.settings-block {
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  overflow: hidden;
}

.settings-block__head {
  padding: 20px 28px 0;
}

.settings-block__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 4px;
}

.settings-block__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.settings-block__body {
  padding: 20px 28px 28px;
}

.settings-block__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
