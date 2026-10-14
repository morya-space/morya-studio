<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MConfigProvider, MScrollbar, enUS, zhCN } from 'morya-ui'
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
        <MScrollbar class="app-content" wrap-class="app-content__wrap">
          <router-view />
        </MScrollbar>
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

/* header 固定不滚动，仅内容区独立滚动（MScrollbar 提供统一滚动条） */
.app-content {
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* fill 页面（如数据源详情表格撑满剩余高度）：打通 wrap → view → 页面根 的高度链 */
.app-content__wrap {
  height: 100%;
}
.app-content__wrap:has(> .m-scrollbar__view > .workspace-page--fill) {
  overflow: hidden;
}
.app-content__wrap:has(> .m-scrollbar__view > .workspace-page--fill) > .m-scrollbar__view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.app-content__wrap > .m-scrollbar__view > .workspace-page--fill {
  flex: 1;
  min-height: 0;
}
</style>
