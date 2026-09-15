<script setup lang="ts">
import { MConfigProvider, MMessage, MToast, useMotion, zhCN } from 'morya-ui'
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

const { setMotion } = useMotion()

onMounted(() => {
  setMotion('full')
})
</script>

<template>
  <MConfigProvider class="app-config" :locale="zhCN">
    <div class="app-shell">
      <RouterView />
    </div>
    <MMessage placement="top" />
    <MToast position="bottom-right" />
  </MConfigProvider>
</template>

<style>
.m-config-provider.app-config,
.app-shell {
  height: 100%;
  min-height: 0;
  width: 100%;
}

.app-shell {
  overflow: hidden;
}
</style>
