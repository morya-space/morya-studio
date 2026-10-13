<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  size?: number
  inverse?: boolean
}>(), {
  size: 36,
  inverse: false,
})

const paintId = `brand-paint-${useId()}`
</script>

<template>
  <!--
    Creative-studio take:
    - One loose brush stroke for the M, width varies like ink
    - Off-center amber signature dash underneath (designer flourish)
    - Deliberately imperfect; no box, no symmetry
  -->
  <svg
    viewBox="0 0 32 32"
    fill="none"
    :width="size"
    :height="size"
    aria-hidden="true"
  >
    <!-- Brush M: thicker left, thin valley, heavier right sweep -->
    <path
      :stroke="inverse ? 'var(--m-color-surface)' : `url(#${paintId})`"
      stroke-width="5"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M6 25
         C6.4 18 7.2 11.6 8.3 10.2
         C9.2 9.1 10.4 9.3 11.4 10.6
         L14.9 20.9
         C15.3 21.9 16.2 21.7 16.8 20.6
         L23.8 7.9
         C24.9 6 26.9 6.7 27 8.8
         L27.3 24.6"
    />
    <!-- Signature dash — ochre, off-center, hand-placed -->
    <path
      :stroke="inverse ? 'var(--m-color-surface)' : 'var(--m-color-accent-orange)'"
      stroke-width="2.6"
      stroke-linecap="round"
      d="M10.4 27.6 C13 27.2 17.6 27.4 21.2 27.1"
      opacity="0.92"
    />
    <defs v-if="!inverse">
      <linearGradient :id="paintId" x1="5" y1="7" x2="28" y2="25">
        <stop stop-color="var(--m-color-primary)" />
        <stop offset="0.6" stop-color="var(--m-color-primary)" />
        <stop offset="1" stop-color="var(--m-color-accent-blue)" />
      </linearGradient>
    </defs>
  </svg>
</template>
