<script setup lang="ts">
import { useMotion, WkConfigProvider, WkMessage, WkToast, zhCN } from '@wise-kit/ui'
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

const { setMotion } = useMotion()

onMounted(() => {
  setMotion('full')
})
</script>

<template>
  <WkConfigProvider class="w-full h-full" :locale="zhCN">
    <div class="app-shell">
      <RouterView />
    </div>
    <WkMessage placement="top" />
    <WkToast position="bottom-right" />
  </WkConfigProvider>
</template>

<style>
.app-shell {
  height: 100%;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}
</style>
