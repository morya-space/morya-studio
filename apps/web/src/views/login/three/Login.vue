<script setup lang="ts">
import { MInput, MInputPassword } from 'morya-ui'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, register } from '../../../services/auth'

const route = useRoute()
const router = useRouter()
// 动画状态与 register 路由同步
const isRegister = computed(() => route.name === 'register')
const isAnimating = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const emailPattern = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

function toggleMode() {
  errorMessage.value = ''
  if (isRegister.value) {
    form.confirmPassword = ''
  }
  isAnimating.value = true
  router.push({ name: isRegister.value ? 'login' : 'register' })
  setTimeout(() => {
    isAnimating.value = false
  }, 1500)
}

async function handleSubmit() {
  errorMessage.value = ''
  const email = form.email.trim()
  const name = form.name.trim()

  if (isRegister.value) {
    if (!name) {
      errorMessage.value = '请输入你的姓名'
      return
    }
    if (name.length > 80) {
      errorMessage.value = '姓名不能超过 80 个字符'
      return
    }
  }
  if (!email) {
    errorMessage.value = '请输入邮箱地址'
    return
  }
  if (!emailPattern.test(email)) {
    errorMessage.value = '请输入有效的邮箱地址'
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
      await register(name, email, form.password)
    } else {
      await login(email, form.password)
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
  <div class="login-container">
    <div class="main">
      <!-- 注册表单 -->
      <div id="a-container" class="container a-container" :class="{ 'is-txl': isRegister, 'is-z200': isRegister }">
        <form id="a-form" class="form" @submit.prevent="handleSubmit">
          <h2 class="form_title title">
            创建账号
          </h2>
          <p class="form__hint">
            填写信息，开始你的创作旅程
          </p>

          <label class="form__field">
            <span class="form__label">姓名</span>
            <MInput
              v-model="form.name" class="form__input" type="text" name="name" placeholder="你的名字"
              autocomplete="name" :maxlength="80" required
            />
          </label>
          <label class="form__field">
            <span class="form__label">邮箱</span>
            <MInput
              v-model="form.email" class="form__input" type="email" name="email" placeholder="you@example.com"
              autocomplete="email" required
            />
          </label>
          <label class="form__field">
            <span class="form__label">密码</span>
            <MInputPassword
              v-model="form.password" class="form__input" type="password" name="password"
              placeholder="至少 6 位字符" autocomplete="new-password" minlength="6" required
            />
          </label>
          <label class="form__field">
            <span class="form__label">确认密码</span>
            <MInputPassword
              v-model="form.confirmPassword" class="form__input" type="password" name="confirmPassword"
              placeholder="再次输入密码" autocomplete="new-password" minlength="6" required
            />
          </label>

          <p v-if="errorMessage && isRegister" class="form__error" role="alert">
            {{ errorMessage }}
          </p>

          <button type="submit" class="form__button button submit" :disabled="isSubmitting">
            {{ isSubmitting ? '注册中...' : '创建账号' }}
          </button>
        </form>
      </div>

      <!-- 登录表单 -->
      <div id="b-container" class="container b-container" :class="{ 'is-txl': isRegister, 'is-z200': !isRegister }">
        <form id="b-form" class="form" @submit.prevent="handleSubmit">
          <h2 class="form_title title">
            登录账号
          </h2>
          <p class="form__hint">
            输入账号信息，回到你的工作空间
          </p>

          <label class="form__field">
            <span class="form__label">邮箱</span>

            <MInput
              v-model="form.email" class="form__input" type="email" name="email" placeholder="you@example.com"
              autocomplete="email" required
            />
            <!-- <input
              v-model="form.email" class="form__input" type="email" name="email" placeholder="you@example.com"
              autocomplete="email" required
            > -->
          </label>
          <label class="form__field">
            <span class="form__label">密码</span>

            <MInputPassword
              v-model="form.password" class="form__input" type="password" name="password"
              placeholder="至少 6 位字符" autocomplete="current-password" minlength="6" required
            />
            <!-- <input
              v-model="form.password"
              class="form__input"
              type="password"
              name="password"
              placeholder="至少 6 位字符"
              autocomplete="current-password"
              minlength="6"
              required
            > -->
          </label>

          <p v-if="errorMessage && !isRegister" class="form__error" role="alert">
            {{ errorMessage }}
          </p>

          <button type="submit" class="form__button button submit" :disabled="isSubmitting">
            {{ isSubmitting ? '登录中...' : '登录' }}
          </button>
        </form>
      </div>

      <!-- 切换面板 -->
      <div id="switch-cnt" class="switch" :class="{ 'is-txr': isRegister, 'is-gx': isAnimating }">
        <div class="switch__circle" />
        <div class="switch__circle switch__circle--t" />

        <div id="switch-c1" class="switch__container" :class="{ 'is-hidden': isRegister }">
          <h2 class="switch__title title">
            欢迎回来！
          </h2>
          <p class="switch__description description">
            登录你的账号，回到工作空间继续创作
          </p>
          <button type="button" class="switch__button button switch-btn" @click="toggleMode">
            去注册
          </button>
        </div>

        <div id="switch-c2" class="switch__container" :class="{ 'is-hidden': !isRegister }">
          <h2 class="switch__title title">
            你好，朋友！
          </h2>
          <p class="switch__description description">
            填写个人信息，开启你的创作旅程
          </p>
          <button type="button" class="switch__button button switch-btn" @click="toggleMode">
            去登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');

.login-container {

  $neu-1: #ecf0f3;
  $neu-2: #d1d9e6;
  $white: #f9f9f9;
  $gray: #a0a5a8;
  $black: #181818;
  $purple: #4B70E2;
  $transition: 1.25s;

  *,
  *::after,
  *::before {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    user-select: none;
  }

  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Noto Sans SC',
  'Montserrat',
  sans-serif;
  font-size: 12px;
  background-color: $neu-1;
  color: $gray;



  .main {
    position: relative;
    width: 1000px;
    min-width: 1000px;
    min-height: 600px;
    height: 600px;
    padding: 25px;
    background-color: $neu-1;
    box-shadow:
      10px 10px 10px $neu-2,
      -10px -10px 10px $white;
    border-radius: 12px;
    overflow: hidden;

    @media (max-width: 1200px) {
      transform: scale(.7);
    }

    @media (max-width: 1000px) {
      transform: scale(.6);
    }

    @media (max-width: 800px) {
      transform: scale(.5);
    }

    @media (max-width: 600px) {
      transform: scale(.4);
    }
  }

  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
    top: 0;
    width: 600px;
    height: 100%;
    padding: 25px;
    background-color: $neu-1;
    transition: $transition;
  }

  .form {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    width: 100%;
    height: 100%;

    &__hint {
      margin: -8px 0 20px;
      font-size: 13px;
      line-height: 1.6;
      text-align: center;
      color: $gray;
    }

    &__field {
      display: grid;
      gap: 6px;
      width: 350px;
      margin: 4px 0;
    }

    &__label {
      font-size: 12px;
      color: $gray;
    }

    &__input {

      :deep(input) {
        width: 100%;
        height: 40px;
        padding: 0 16px;
        font-size: 13px;
        letter-spacing: .15px;
        border: none;
        outline: none;
        font-family: 'Noto Sans SC', 'Montserrat', sans-serif;
        background-color: $neu-1;
        transition: .25s ease;
        border-radius: 8px;
        box-shadow:
          inset 2px 2px 4px $neu-2,
          inset -2px -2px 4px $white;

        &:focus {
          box-shadow:
            inset 4px 4px 4px $neu-2,
            inset -4px -4px 4px $white;
        }
      }

    }

    &__error {
      color: #e74c3c;
      font-size: 0.75rem;
      margin-top: 10px;
      text-align: center;
    }
  }

  .title {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.6;
    color: $black;
  }

  .description {
    font-size: 14px;
    letter-spacing: .25px;
    text-align: center;
    line-height: 1.6;
  }

  .button {
    width: 180px;
    height: 50px;
    border-radius: 25px;
    margin-top: 24px;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 1.15px;
    background-color: $purple;
    color: $white;
    box-shadow:
      8px 8px 16px $neu-2,
      -8px -8px 16px $white;
    border: none;
    outline: none;
    cursor: pointer;
    transition: box-shadow .25s, transform .25s;

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }

  .a-container {
    z-index: 100;
    left: calc(100% - 600px);
  }

  .b-container {
    left: calc(100% - 600px);
    z-index: 0;
  }

  .switch {
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 400px;
    padding: 50px;
    z-index: 200;
    transition: $transition;
    background-color: $neu-1;
    overflow: hidden;
    box-shadow:
      4px 4px 10px $neu-2,
      -4px -4px 10px $white;

    &__circle {
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background-color: $neu-1;
      box-shadow:
        inset 8px 8px 12px $neu-2,
        inset -8px -8px 12px $white;
      bottom: -60%;
      left: -60%;
      transition: $transition;

      &--t {
        top: -30%;
        left: 60%;
        width: 300px;
        height: 300px;
      }
    }

    &__container {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      position: absolute;
      width: 400px;
      padding: 50px 55px;
      transition: $transition;
    }

    &__button {
      &:hover {
        box-shadow:
          6px 6px 10px $neu-2,
          -6px -6px 10px $white;
        transform: scale(.985);
      }

      &:active,
      &:focus {
        box-shadow:
          2px 2px 6px $neu-2,
          -2px -2px 6px $white;
        transform: scale(.97);
      }
    }
  }

  .is-txr {
    left: calc(100% - 400px);
    transition: $transition;
    transform-origin: left;
  }

  .is-txl {
    left: 0;
    transition: $transition;
    transform-origin: right;
  }

  .is-z200 {
    z-index: 200;
    transition: $transition;
  }

  .is-hidden {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    transition: $transition;
  }

  .is-gx {
    animation: is-gx $transition;
  }
}
</style>

<style lang="scss">
@keyframes is-gx {

  0%,
  10%,
  100% {
    width: 400px;
  }

  30%,
  50% {
    width: 500px;
  }
}
</style>
