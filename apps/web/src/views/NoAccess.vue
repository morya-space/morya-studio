<script setup lang="ts">
import { MButton, MCard, MIcon } from 'morya-ui'
import { useRouter } from 'vue-router'
import { logout } from '../services/auth'

const router = useRouter()

async function backToLogin() {
  await logout().catch(() => undefined)
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="empty-page">
    <MCard class="empty-card">
      <div class="empty-body">
        <MIcon name="lock" size="lg" />
        <h1>暂无可用页面</h1>
        <p>当前账号没有可访问的功能权限。请联系超级管理员分配角色后再试。</p>
        <MButton label="返回登录" severity="secondary" outlined @click="backToLogin" />
      </div>
    </MCard>
  </div>
</template>

<style scoped>
.empty-page {
  min-height: 100%;
  display: grid;
  place-items: center;
}

.empty-card {
  width: min(28rem, 100%);
}

.empty-body {
  display: grid;
  justify-items: center;
  gap: var(--m-space-3);
  text-align: center;
  padding: var(--m-space-4) 0;
}

.empty-body h1 {
  margin: 0;
  font-size: var(--m-font-size-lg);
  font-weight: 600;
  color: var(--m-color-text);
}

.empty-body p {
  margin: 0;
  color: var(--m-color-text-muted);
  line-height: 1.7;
  font-size: var(--m-font-size-sm);
}
</style>
