<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Brand from '../../../components/brand/Brand.vue'
import { login, register } from '../../../services/auth'

const route = useRoute()
const router = useRouter()
const isRegister = computed(() => route.name === 'register')
const isSubmitting = ref(false)
const errorMessage = ref('')
const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

function switchMode() {
  errorMessage.value = ''
  router.push({ name: isRegister.value ? 'login' : 'register' })
}

async function handleSubmit() {
  errorMessage.value = ''

  if (isRegister.value && !form.name.trim()) {
    errorMessage.value = '请输入你的姓名'
    return
  }
  if (!form.email.trim()) {
    errorMessage.value = '请输入邮箱地址'
    return
  }
  if (form.password.length < 6) {
    errorMessage.value = '密码至少需要 6 位'
    return
  }
  if (isRegister.value && form.password !== form.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }

  isSubmitting.value = true
  try {
    if (isRegister.value) {
      await register(form.name, form.email, form.password)
    } else {
      await login(form.email, form.password)
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '操作失败，请稍后再试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-layout">
      <section class="auth-intro">
        <Brand />
        <div class="intro-copy">
          <p class="kicker">
            MORYA STUDIO / 2026
          </p>
          <h1>{{ isRegister ? '从一个好想法开始。' : '让灵感继续发生。' }}</h1>
          <p>{{ isRegister ? '创建你的工作空间，保存每一次值得继续的创作。' : '登录你的工作空间，继续构建值得被看见的东西。' }}</p>
        </div>
        <span class="intro-note">DESIGN WITH INTENTION</span>
      </section>

      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="panel-heading">
          <p class="panel-kicker">
            {{ isRegister ? 'NEW ACCOUNT' : 'WELCOME BACK' }}
          </p>
          <h2 id="auth-title">
            {{ isRegister ? '创建账号' : '登录账号' }}
          </h2>
          <p>
            {{ isRegister ? '填写信息，开始你的创作旅程。' : '输入账号信息，回到你的工作空间。' }}
          </p>
        </div>

        <form class="auth-form" @submit.prevent="handleSubmit">
          <label v-if="isRegister" class="field">
            <span>姓名</span>
            <input v-model="form.name" name="name" autocomplete="name" placeholder="你的名字" type="text">
          </label>
          <label class="field">
            <span>邮箱</span>
            <input v-model="form.email" name="email" autocomplete="email" placeholder="you@example.com" type="email">
          </label>
          <label class="field">
            <span>密码</span>
            <input v-model="form.password" name="password" :autocomplete="isRegister ? 'new-password' : 'current-password'" placeholder="至少 6 位字符" type="password">
          </label>
          <label v-if="isRegister" class="field">
            <span>确认密码</span>
            <input v-model="form.confirmPassword" name="confirmPassword" autocomplete="new-password" placeholder="再次输入密码" type="password">
          </label>

          <p v-if="errorMessage" class="form-error" role="alert">
            {{ errorMessage }}
          </p>
          <button class="submit-button" :disabled="isSubmitting" type="submit">
            {{ isSubmitting ? '处理中...' : (isRegister ? '创建账号' : '登录') }}
          </button>
        </form>

        <p class="mode-switch">
          {{ isRegister ? '已经有账号？' : '还没有账号？' }}
          <button type="button" @click="switchMode">
            {{ isRegister ? '返回登录' : '立即注册' }}
          </button>
        </p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100%;
  overflow: auto;
  background: var(--m-color-ground-background);
}

.auth-layout {
  display: grid;
  grid-template-columns: 1fr 520px;
  min-height: 100vh;
}

.auth-intro {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  padding: clamp(28px, 5vw, 72px);
  color: var(--m-color-on-emphasis);
  background: var(--m-color-brand-gradient);
}

.auth-intro :deep(.brand-copy strong),
.auth-intro :deep(.brand-copy span) {
  color: var(--m-color-on-emphasis);
}

.intro-copy {
  max-width: 560px;
  margin: auto 0;
  padding: 80px 0;
}

.kicker,
.panel-kicker,
.intro-note {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.16em;
}

.intro-copy h1 {
  max-width: 540px;
  margin: 18px 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(44px, 6vw, 80px);
  font-weight: 400;
  line-height: 1.05;
}

.intro-copy p:last-child {
  max-width: 370px;
  margin: 0;
  font-size: 16px;
  line-height: 1.8;
  opacity: 0.85;
}

.auth-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: clamp(32px, 7vw, 96px);
  background: var(--m-color-surface);
}

.panel-heading h2 {
  margin: 14px 0 10px;
  color: var(--m-color-text);
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 500;
}

.panel-heading p:last-child {
  margin: 0;
  color: var(--m-color-text-muted);
  font-size: 14px;
}

.auth-form {
  display: grid;
  gap: 18px;
  margin-top: 44px;
}

.field {
  display: grid;
  gap: 8px;
  color: var(--m-color-text-muted);
  font-size: 12px;
}

.field input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: var(--m-border-width) solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  color: var(--m-color-text);
  background: var(--m-color-ground-background);
  font: inherit;
  outline: 0;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.field input:focus {
  border-color: var(--m-color-primary);
  box-shadow: 0 0 0 3px var(--m-color-primary-soft);
}

.form-error {
  margin: -2px 0 0;
  color: var(--m-color-danger);
  font-size: 13px;
}

.submit-button {
  min-height: 48px;
  margin-top: 6px;
  border: 0;
  border-radius: var(--m-radius-sm);
  color: var(--m-color-on-primary);
  background: var(--m-color-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.mode-switch {
  margin: 28px 0 0;
  color: var(--m-color-text-muted);
  font-size: 13px;
}

.mode-switch button {
  padding: 0;
  border: 0;
  color: var(--m-color-primary);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

@media (max-width: 760px) {
  .auth-layout {
    display: block;
  }

  .auth-intro {
    min-height: 300px;
    padding: 28px 24px;
  }

  .intro-copy {
    padding: 40px 0 24px;
  }

  .intro-copy h1 {
    margin: 12px 0;
    font-size: 44px;
  }

  .intro-copy p:last-child,
  .intro-note {
    display: none;
  }

  .auth-panel {
    width: 100%;
    min-height: auto;
    padding: 48px 24px 56px;
  }
}
</style>