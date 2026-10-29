<script setup lang="ts">
/**
 * 动画面板（v0.3）
 * 选择卡片入场动画（内置轻量动画，见 src/engine/animations.ts）。
 */

import { computed } from 'vue'
import { MForm, MFormItem, MSelect } from 'morya-ui'
import { useEditorStore } from '../store'
import { CARD_ANIMATIONS } from '../../engine/animations'

const store = useEditorStore()
const card = computed(() => store.selectedCard)

const animation = computed({
  get: () => card.value?.styles?.animations?.[0] ?? '',
  set: (v: string) => {
    if (!card.value) return
    store.updateCardField(card.value.id, 'styles.animations', v ? [v] : [])
  },
})
</script>

<template>
  <div v-if="card" class="animation-panel">
    <MForm>
      <MFormItem label="入场动画" help="选择无可关闭入场动画">
      <MSelect v-model="animation" :options="CARD_ANIMATIONS" fluid />
      </MFormItem>
    </MForm>
  </div>
</template>

<style lang="scss" scoped>
.animation-panel {
  display: flex;
  flex-direction: column;
}
</style>
