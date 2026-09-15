<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isNarrowForm = computed(() => {
  const name = typeof route.name === 'string' ? route.name : ''
  return name === 'profile'
})
</script>

<template>
  <div class="settings-shell" :class="{ 'settings-shell--narrow': isNarrowForm }">
    <RouterView />
  </div>
</template>

<style scoped>
.settings-shell {
  min-height: 100%;
  width: 100%;
}

.settings-shell--narrow {
  max-width: 56rem;
}
</style>
