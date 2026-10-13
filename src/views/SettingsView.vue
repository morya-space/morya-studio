<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MForm, MFormItem, MInput } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import { useSession } from '../composables/useSession'

const { t } = useI18n()
const { user } = useSession()

const name = computed(() => user.value?.name ?? '')
const email = computed(() => user.value?.email ?? '')
const plan = computed(() => user.value?.plan ?? '')
</script>

<template>
  <WorkspacePage :title="t('pages.settings.title')" :summary="t('pages.settings.summary')">
    <section class="settings-card">
      <MForm>
        <MFormItem :label="t('settings.name')" name="name">
          <MInput :model-value="name" readonly fluid />
        </MFormItem>
        <MFormItem :label="t('settings.email')" name="email">
          <MInput :model-value="email" type="email" readonly fluid />
        </MFormItem>
        <MFormItem :label="t('settings.plan')" name="plan">
          <MInput :model-value="plan" readonly fluid />
        </MFormItem>
      </MForm>
    </section>
  </WorkspacePage>
</template>

<style scoped>
.settings-card {
  width: min(100%, 28rem);
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  padding: 28px;
  box-shadow: var(--m-shadow-card);
}
</style>
