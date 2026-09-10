<script setup lang="ts">
import { useRouter } from 'vue-router'
import Brand from '../components/brand/Brand.vue'
import { logout, useAuth } from '../services/auth'

const router = useRouter()
const { user } = useAuth()

function handleLogout() {
  void logout().finally(() => router.replace({ name: 'login' }))
}
</script>

<template>
  <div class="home-shell">
    <header class="topbar">
      <Brand />
      <div class="account-area">
        <span class="account-name">{{ user?.name }}</span>
        <button class="logout-button" type="button" @click="handleLogout">
          退出登录
        </button>
      </div>
    </header>

    <main class="home-main">
      <p class="eyebrow">
        WELCOME BACK
      </p>
      <h1>你好，{{ user?.name }}</h1>
      <p class="lead">
        你的 Morya Studio 工作空间已经准备好了。
      </p>
    </main>
  </div>
</template>

<style scoped>
.home-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  color: var(--m-color-text);
  background: var(--m-color-ground-background, var(--m-color-surface));
}

.topbar {
  height: 68px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 clamp(20px, 5vw, 76px);
  border-bottom: var(--m-border-width) solid var(--m-color-border);
  justify-content: space-between;
}

.account-area {
  display: flex;
  align-items: center;
  gap: 16px;
}

.account-name {
  color: var(--m-color-text-muted);
  font-size: 13px;
}

.logout-button {
  border: 0;
  padding: 8px 0;
  color: var(--m-color-primary);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.logout-button:hover {
  color: var(--m-color-text);
}

.home-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(720px, calc(100% - 40px));
  margin: 0 auto;
  padding: 48px 0;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--m-color-text-muted);
  font-size: 11px;
  letter-spacing: 0.16em;
}

h1 {
  margin: 0 0 16px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 400;
  line-height: 1.05;
}

.lead {
  margin: 0;
  max-width: 520px;
  color: var(--m-color-text-muted);
  font-size: 15px;
  line-height: 1.7;
}
</style>
