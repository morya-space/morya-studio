<script lang='ts' setup>
import { WkButton, WkForm, WkFormItem, WkInputPassword, WkSpace } from '@wise-kit/ui'
</script>

<template>
  <div class="login-container w-full h-full flex items-center justify-center">
    <div class="login-box w-[400px] flex">
      <div class="login-left-card flex flex-col items-center justify-center p-8">
        <span>登录</span>
        <WkSpace>
          <WkButton icon="database" rounded outlined icon-only />
          <WkButton icon="database" rounded outlined icon-only />
          <WkButton icon="database" rounded outlined icon-only />
        </WkSpace>

        <span>or use your account</span>

        <WkForm>
          <WkFormItem>
            <WkInput placeholder="用户名" />
          </WkFormItem>
          <WkFormItem>
            <WkInputPassword type="password" placeholder="密码" />
          </WkFormItem>
        </WkForm>

        <span>Forgot your password?</span>

        <WkButton fluid rounded>
          登录
        </WkButton>
      </div>
      <div class="login-right-card flex flex-col items-center justify-center p-8">
        <span>Hello, Friend!</span>
        <span>Enter your personal details and start journey with us</span>
        <WkButton class="register-btn" fluid rounded outlined>
          注册
        </WkButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  background-color: #f6f5f8;

  .login-box {
    background-color: var(--wk-color-surface);
    border-radius: var(--wk-radius-sm);
    box-shadow: var(--wk-shadow-sm);
    overflow: hidden;

    .login-left-card {
      flex: 1;
      background-color: var(--wk-color-primary-1);
    }

    .login-right-card {
      flex: 1;
      background: #FF416C;
      background: -webkit-linear-gradient(to right, #FF4B2B, #FF416C);
      background: linear-gradient(to right, #FF4B2B, #FF416C);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: 0 0;
      color: var(--wk-color-surface);

      .register-btn {
        border-color: var(--wk-color-surface);
        --wk-button-fg: var(--wk-color-surface);
        --wk-button-hover-fg: var(--wk-color-surface);
      }
    }
  }
}
</style>