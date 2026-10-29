<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MConfigProvider, MForm, MFormItem, MInput, MInputPassword, MSpace, message } from 'morya-ui'
import BrandMark from '../../components/common/BrandMark.vue'
import LocaleSwitch from '../../components/common/LocaleSwitch.vue'
import { useSession } from '../../composables/useSession'

const route = useRoute()
const router = useRouter()
const { login } = useSession()
const { t } = useI18n()

const submitting = ref(false)
const formError = ref('')
// 演示账号（与后端种子管理员一致）
const demoAccount = { email: 'grealish@teamdek.com', password: 'studio' }
const model = reactive({ email: demoAccount.email, password: demoAccount.password })

function safeRedirect(value: unknown) {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function onForgot() {
  router.push({ name: 'forgot-password' })
}

async function onSubmit(payload: { valid: boolean }) {
  formError.value = ''
  if (!payload.valid || !model.email.trim() || !model.password) {
    formError.value = t('login.errorEmpty')
    return
  }
  submitting.value = true
  try {
    const ok = await login(model.email, model.password)
    if (!ok) {
      formError.value = t('login.errorMismatch')
      return
    }
    message.success(t('login.signedIn'))
    await router.push(safeRedirect(route.query.redirect))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <MConfigProvider input-variant="filled">
    <div class="login-shell">
      <aside class="login-brand" aria-label="Morya Studio">
        <BrandMark :size="52" inverse />
        <p class="login-brand__mark">{{ t('login.brandMark') }}</p>
        <h1 class="login-brand__title">{{ t('login.greeting') }}</h1>
        <p class="login-brand__lead">{{ t('login.brandLead') }}</p>
      </aside>
      <main class="login-main">
        <div class="login-panel">
          <div class="login-panel__top">
            <LocaleSwitch />
          </div>
          <header class="login-panel__header">
            <h2>{{ t('login.title') }}</h2>
            <p>{{ t('login.subtitle') }}</p>
          </header>
          <p v-if="formError" class="login-alert" role="alert">{{ formError }}</p>
          <MForm :model="model" @submit="onSubmit">
            <MFormItem :label="t('login.email')" name="email" required>
              <MInput v-model="model.email" type="email" autocomplete="username" fluid />
            </MFormItem>
            <MFormItem :label="t('login.password')" name="password" required>
              <MInputPassword v-model="model.password" fluid />
            </MFormItem>
            <MSpace class="login-actions" alignment="center">
              <MButton html-type="submit" type="primary" :loading="submitting">{{ t('login.submit') }}</MButton>
              <MButton html-type="button" type="text" @click="onForgot">{{ t('login.forgot') }}</MButton>
            </MSpace>
          </MForm>
          <p class="login-hint">{{ t('login.demoHint', { email: demoAccount.email, password: demoAccount.password }) }}</p>
          <p class="login-link">
            {{ t('login.noAccount') }}
            <router-link :to="{ name: 'register', query: route.query }">{{ t('login.signUp') }}</router-link>
          </p>
        </div>
      </main>
    </div>
  </MConfigProvider>
</template>

<style lang="scss" scoped>
.login-shell {
  display: grid;
  grid-template-columns: minmax(16rem, 0.95fr) minmax(20rem, 1.05fr);
  min-height: 100vh;
  background: var(--m-color-page-bg);

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.login-brand {
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

.login-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--m-space-6);
}

.login-panel {
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

  &__header h2 {
    margin: 0 0 4px;
    font-size: 26px;
    font-weight: 700;
    color: var(--m-color-text);
  }
}

/* 跨根逗号组保持平铺：嵌套会给 .login-hint 错误加上 .login-panel 前缀 */
.login-panel__header p,
.login-hint {
  margin: 0;
  color: var(--m-color-text-muted);
  font-size: 14px;
}

.login-alert {
  margin: 0;
  color: var(--m-color-danger);
  font-size: 14px;
}

.login-actions {
  margin-top: var(--m-space-2);
}

.login-link {
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
