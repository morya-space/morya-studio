<script setup lang="ts">
import Brand from '../components/brand/Brand.vue'
</script>

<template>
  <div class="home-shell">
    <header class="topbar">
      <Brand />
    </header>

    <main class="home-main">
      <p class="eyebrow">
        PLACEHOLDER
      </p>
      <h1>Wex Design Studio</h1>
      <p class="lead">
        项目需求尚未确定。当前为空白占位页面，后续可在此扩展业务功能。
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
  color: var(--rd-color-text);
  background: var(--rd-color-ground-background, var(--rd-color-surface));
}

.topbar {
  height: 68px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 clamp(20px, 5vw, 76px);
  border-bottom: var(--rd-border-width) solid var(--rd-color-border);
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
  color: var(--rd-color-text-muted);
  font-size: 11px;
  letter-spacing: 0.16em;
}

h1 {
  margin: 0 0 16px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 400;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.lead {
  margin: 0;
  max-width: 520px;
  color: var(--rd-color-text-muted);
  font-size: 15px;
  line-height: 1.7;
}
</style>
