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
  <MConfigProvider :locale="moryaLocale">
    <router-view v-if="isPublic || isBare" />
    <div v-else class="app-layout">
      <AppSidebar />
      <div class="app-main">
        <AppHeader />
        <div class="app-content">
          <router-view />
        </div>
      </div>
    </div>
  </MConfigProvider>
</template>

<style>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--m-color-page-bg);
}

.app-main {
  flex: 1;
  margin-left: 76px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  overflow-y: auto;
}
</style>
