<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MConfigProvider, enUS, zhCN } from 'morya-ui'
import AppSidebar from './layouts/AppSidebar.vue'
import AppHeader from './layouts/AppHeader.vue'

const route = useRoute()
const { locale } = useI18n()
const isPublic = computed(() => route.meta.public === true)
const isBare = computed(() => route.meta.bare === true)
const moryaLocale = computed(() => locale.value === 'zh-CN' ? zhCN : enUS)
</script>

<template>
  <MConfigProvider class="w-full h-full" :locale="moryaLocale">
    <router-view v-if="isPublic || isBare" />
    <div v-else class="app-layout">
      <AppSidebar />
      <div class="app-main">
        <AppHeader />
        <main class="app-content">
          <router-view />
        </main>
      </div>
    </div>
  </MConfigProvider>
</template>

<style>
.app-layout {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--m-color-page-bg);
}

.app-main {
  flex: 1;
  margin-left: 76px;
  min-width: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 内容区为固定视口，不滚动；滚动由各路由页面自行决定 */
.app-content {
  flex: 1;
  min-height: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
