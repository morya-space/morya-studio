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
  <MConfigProvider class="app-provider" :locale="moryaLocale">
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

<style lang="scss" scoped>
.app-provider,
.app-layout,
.app-main,
.app-content {
  width: 100%;
  height: 100%;
}

.app-provider,
.app-layout {
  overflow: hidden;
}

.app-layout {
  display: flex;
  background: var(--m-color-page-bg);
}

.app-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  margin-left: 76px;
  overflow: hidden;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
