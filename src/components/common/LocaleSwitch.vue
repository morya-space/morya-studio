<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MDropdown } from 'morya-ui'
import { setLocale, supportedLocales, type AppLocale } from '../../locales'

const { t, locale } = useI18n()
const open = ref(false)

const current = computed(() => supportedLocales.find(l => l.value === locale.value)?.label ?? locale.value)

function onSelect(item: { value?: string }) {
  open.value = false
  if (!item.value) return
  setLocale(item.value as AppLocale)
}
</script>

<template>
  <MDropdown v-model="open" :items="supportedLocales" placement="bottom-end" @select="onSelect">
    <template #trigger>
      <button class="locale-switch" type="button" :aria-label="t('language.switch')">
        <span class="locale-label">{{ current }}</span>
        <svg class="locale-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </template>
  </MDropdown>
</template>

<style scoped>
.locale-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--m-color-text-muted);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: var(--m-radius-sm);
  white-space: nowrap;
}

.locale-switch:hover {
  background: var(--m-color-split);
  color: var(--m-color-text);
}

.locale-switch:focus-visible {
  outline: 2px solid var(--m-color-primary);
  outline-offset: 2px;
}

.locale-chevron {
  flex-shrink: 0;
}
</style>
