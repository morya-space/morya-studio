<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MConfigProvider, MForm, MFormItem, MInput, MInputPassword, MSpace, message } from 'morya-ui'
import BrandMark from '../../components/common/BrandMark.vue'
import LocaleSwitch from '../../components/common/LocaleSwitch.vue'
import { useSession } from '../../composables/useSession'

const router = useRouter()
const { forgotPassword, resetPassword } = useSession()
const { t } = useI18n()

const step = ref<'request' | 'reset'>('request')
const submitting = ref(false)
const formError = ref('')
const resetToken = ref('')

const requestModel = reactive({ email: '' })
const resetModel = reactive({ password: '', confirmPassword: '' })

async function onRequestReset(payload: { valid: boolean }) {
  formError.value = ''
  if (!payload.valid || !requestModel.email.trim()) {
    formError.value = t('forgot.errorEmpty')
    return
  }
  submitting.value = true
  try {
    const result = await forgotPassword(requestModel.email)
    if (!result.ok) {
      formError.value = t('forgot.errorFailed')
      return
    }
    if (result.resetToken) {
      resetToken.value = result.resetToken
      step.value = 'reset'
      message.success(t('forgot.tokenSent'))
    } else {
      message.success(t('forgot.checkEmail'))
      await router.push({ name: 'login' })
    }
  } finally {
    submitting.value = false
  }
}

async function onResetPassword(payload: { valid: boolean }) {
  formError.value = ''
  if (!payload.valid || !resetModel.password) {
    formError.value = t('forgot.errorEmpty')
    return
  }
  if (resetModel.password !== resetModel.confirmPassword) {
    formError.value = t('forgot.errorMismatch')
    return
  }
  if (resetModel.password.length < 6) {
    formError.value = t('forgot.errorShort')
    return
  }
  submitting.value = true
  try {
    const ok = await resetPassword(resetToken.value, resetModel.password)
    if (!ok) {
      formError.value = t('forgot.errorInvalid')
      return
    }
    message.success(t('forgot.success'))
    await router.push({ name: 'login' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <MConfigProvider input-variant="filled">
    <div class="auth-shell">
      <aside class="auth-brand" aria-label="Morya Studio">
        <BrandMark :size="52" inverse />
        <p class="auth-brand__mark">{{ t('login.brandMark') }}</p>
        <h1 class="auth-brand__title">{{ t('forgot.greeting') }}</h1>
        <p class="auth-brand__lead">{{ t('forgot.brandLead') }}</p>
      </aside>
      <main class="auth-main">
        <div class="auth-panel">
          <div class="auth-panel__top">
            <LocaleSwitch />
          </div>

          <!-- Step 1: Request reset -->
          <template v-if="step === 'request'">
            <header class="auth-panel__header">
              <h2>{{ t('forgot.title') }}</h2>
              <p>{{ t('forgot.subtitle') }}</p>
            </header>
            <p v-if="formError" class="auth-alert" role="alert">{{ formError }}</p>
            <MForm :model="requestModel" @submit="onRequestReset">
              <MFormItem :label="t('forgot.email')" name="email" required>
                <MInput v-model="requestModel.email" type="email" fluid autocomplete="username" />
              </MFormItem>
              <MSpace class="auth-actions" alignment="center">
                <MButton html-type="submit" type="primary" :loading="submitting">{{ t('forgot.submit') }}</MButton>
              </MSpace>
            </MForm>
          </template>

          <!-- Step 2: Reset password with token -->
          <template v-else>
            <header class="auth-panel__header">
              <h2>{{ t('forgot.resetTitle') }}</h2>
              <p>{{ t('forgot.resetSubtitle') }}</p>
            </header>
            <p v-if="formError" class="auth-alert" role="alert">{{ formError }}</p>
            <MForm :model="resetModel" @submit="onResetPassword">
              <MFormItem :label="t('forgot.newPassword')" name="password" required>
                <MInputPassword v-model="resetModel.password" fluid autocomplete="new-password" />
              </MFormItem>
              <MFormItem :label="t('forgot.confirmPassword')" name="confirmPassword" required>
                <MInputPassword v-model="resetModel.confirmPassword" fluid autocomplete="new-password" />
              </MFormItem>
              <MSpace class="auth-actions" alignment="center">
                <MButton html-type="submit" type="primary" :loading="submitting">{{ t('forgot.resetSubmit') }}</MButton>
              </MSpace>
            </MForm>
          </template>

          <p class="auth-link">
            {{ t('forgot.remembered') }}
            <router-link :to="{ name: 'login' }">{{ t('forgot.signIn') }}</router-link>
          </p>
        </div>
      </main>
    </div>
  </MConfigProvider>
</template>

<style lang="scss" scoped>
.auth-shell {
  display: grid;
  grid-template-columns: minmax(16rem, 0.95fr) minmax(20rem, 1.05fr);
  min-height: 100vh;
  background: var(--m-color-page-bg);

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.auth-brand {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--m-space-4);
  padding: clamp(2rem, 6vw, 4.5rem);
  background: linear-gradient(135deg, var(--m-color-primary) 0%, var(--m-color-accent-blue) 100%);
  color: var(--m-color-surface);

  &__mark {
    margin: 0;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--m-color-surface) 78%, transparent);
  }

  &__title {
    margin: 0;
    font-size: clamp(1.75rem, 3vw, 2.25rem);
    line-height: 1.2;
    font-weight: 700;
    color: var(--m-color-surface);
  }

  &__lead {
    margin: 0;
    max-width: 28rem;
    color: color-mix(in srgb, var(--m-color-surface) 80%, transparent);
    font-size: 15px;
    line-height: 1.5;
  }

  @media (max-width: 720px) {
    min-height: 16rem;
  }
}

.auth-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--m-space-6);
}

.auth-panel {
  width: min(100%, 24rem);
  display: flex;
  flex-direction: column;
  gap: var(--m-space-4);
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  padding: 28px;
  box-shadow: var(--m-shadow-card);

  &__top {
    display: flex;
    justify-content: flex-end;
  }

  &__header {
    h2 {
      margin: 0 0 4px;
      font-size: 26px;
      font-weight: 700;
      color: var(--m-color-text);
    }

    p {
      margin: 0;
      color: var(--m-color-text-muted);
      font-size: 14px;
    }
  }
}

.auth-alert {
  margin: 0;
  color: var(--m-color-danger);
  font-size: 14px;
}

.auth-actions {
  margin-top: var(--m-space-2);
}

.auth-link {
  margin: 0;
  text-align: center;
  font-size: 14px;
  color: var(--m-color-text-muted);

  a {
    color: var(--m-color-primary);
    text-decoration: none;
  }
}
</style>
