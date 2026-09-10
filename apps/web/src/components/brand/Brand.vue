<script lang="ts" setup>
import { MFlex } from 'morya-ui'
</script>

<template>
  <MFlex class="logo-brand" align="center" gap="11px" aria-label="Morya Studio">
    <div class="brand-mark">
      <span>MS</span><i />
    </div>
    <div class="brand-copy">
      <strong>Morya</strong>
      <span>DESIGN STUDIO</span>
    </div>
  </MFlex>
</template>

<style scoped>
.logo-brand {
  display: inline-flex;
}

.brand-mark {
  width: 30px;
  height: 30px;
  position: relative;
  display: grid;
  place-items: center;
  border: var(--m-border-width) solid var(--m-color-primary);
  border-radius: var(--m-radius-md) var(--m-radius-md) var(--m-radius-md) var(--m-radius-sm);
  color: var(--m-color-on-emphasis);
  background: var(--m-color-primary);
  transform: rotate(-5deg);
}

.brand-mark span {
  font-size: 10px;
  font-weight: 900;
  transform: rotate(5deg);
}

.brand-mark i {
  position: absolute;
  width: 5px;
  height: 5px;
  right: -3px;
  bottom: -3px;
  border-radius: 50%;
  background: var(--m-color-warning);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-copy strong {
  font-size: 13px;
  letter-spacing: -0.02em;
}

.brand-copy span {
  font-size: 9px;
  letter-spacing: 0.16em;
  color: var(--m-color-text-muted);
}
</style>
