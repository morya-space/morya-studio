<script lang='ts' setup>
import { MButton, MForm, MFormItem, MInput, MInputPassword, MSpace } from 'morya-ui'
</script>

<template>
  <div class="login-container w-full h-full flex items-center justify-center">
    <div class="login-box w-[800px] flex h-[500px]">
      <div class="login-left-card flex flex-col items-center justify-center p-8 gap-4">
        <span class="font-bold text-2em">登录</span>

        <span class="font-bold">或者使用您的账号密码登录</span>

        <MForm>
          <MFormItem>
            <MInput placeholder="用户名" />
          </MFormItem>
          <MFormItem>
            <MInputPassword type="password" placeholder="密码" />
          </MFormItem>
        </MForm>

        <MSpace>
          <span>Forgot your password?</span>
          <MButton text link>
            重置密码
          </MButton>
        </MSpace>

        <MButton rounded class="w-[160px]">
          登录
        </MButton>
      </div>
      <div class="login-right-card flex flex-col items-center justify-center p-8 gap-4">
        <span class="font-bold text-2em">Hello, Friend!</span>
        <span>Enter your personal details and start journey with us</span>
        <MButton class="register-btn w-[160px]" rounded outlined>
          注册
        </MButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  background-color: var(--m-color-ground-background);

  .login-box {
    background-color: var(--m-color-surface);
    border-radius: var(--m-radius-md);
    box-shadow: var(--m-shadow-md);
    overflow: hidden;

    .login-left-card {
      flex: 1;
      background-color: var(--m-color-surface);
    }

    .login-right-card {
      flex: 1;
      background: var(--m-color-login-accent-gradient);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: 0 0;
      color: var(--m-color-surface);

      .register-btn {
        border-color: var(--m-color-surface);
        --m-button-fg: var(--m-color-surface);
        --m-button-hover-fg: var(--m-color-surface);
      }
    }
  }
}
</style>
