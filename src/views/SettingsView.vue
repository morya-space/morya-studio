<script setup lang="ts">
/**
 * 设置（/settings）
 * 管理后台常规配置：账户信息 / 工作区 / 偏好（语言等）。
 */

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MButton, MForm, MFormItem, MInput, MSelect, message } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import { useSession } from '../composables/useSession'
import { setLocale, supportedLocales, type AppLocale } from '../locales'

const { t, locale } = useI18n()
const { user } = useSession()

const name = computed(() => user.value?.name ?? '')
const email = computed(() => user.value?.email ?? '')
const plan = computed(() => user.value?.plan ?? '')

// 工作区（本地配置，MVP 仅展示，保存走 message 提示）
const workspaceName = ref('Morya Studio')

// 偏好：语言
const currentLocale = computed({
  get: () => locale.value as AppLocale,
  set: (v: AppLocale) => setLocale(v),
})

function onSaveWorkspace() {
  message.success(t('settings.saved'))
}

function onNotReady() {
  message.info(t('settings.notReady'))
}
</script>

<template>
  <WorkspacePage :title="t('pages.settings.title')" :summary="t('pages.settings.summary')">
    <div class="settings">
      <!-- 账户信息 -->
      <section class="settings-block">
        <header class="settings-block__head">
          <h3 class="settings-block__title">{{ t('settings.accountTitle') }}</h3>
          <p class="settings-block__desc">{{ t('settings.accountDesc') }}</p>
        </header>
        <div class="settings-block__body">
          <MForm>
            <MFormItem :label="t('settings.name')">
              <MInput :model-value="name" readonly fluid />
            </MFormItem>
            <MFormItem :label="t('settings.email')">
              <MInput :model-value="email" type="email" readonly fluid />
            </MFormItem>
            <MFormItem :label="t('settings.plan')">
              <MInput :model-value="plan" readonly fluid />
            </MFormItem>
          </MForm>
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
            <MButton type="primary" @click="onSaveWorkspace">{{ t('common.save') }}</MButton>
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
