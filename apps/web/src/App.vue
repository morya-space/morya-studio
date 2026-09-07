<script setup lang="ts">
import { useMotion, RdConfigProvider, RdMessage, RdToast, zhCN } from '@roost-design/ui'
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

const { setMotion } = useMotion()

onMounted(() => {
  setMotion('full')
})
</script>

<template>
  <RdConfigProvider :locale="zhCN">
    <div class="app-shell">
      <RouterView />
    </div>
    <RdMessage placement="top" />
    <RdToast position="bottom-right" />
  </RdConfigProvider>
</template>

<style>
.app-shell {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
