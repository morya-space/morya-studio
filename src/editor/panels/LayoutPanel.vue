<script setup lang="ts">
/**
 * 布局面板（位置 / 尺寸 / 层级 / 状态）
 */

import { computed } from 'vue'
import { MButton, MFormItem, MInputNumber } from 'morya-ui'
import { useEditorStore } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()
const card = computed(() => store.selectedCard)
const isFree = computed(() => store.page.layout === 'free')

function setGeometry(field: 'x' | 'y' | 'w' | 'h', v: number | undefined) {
  if (!card.value) return
  store.beginChange()
  store.updateCardField(card.value.id, field, Number(v) || 0)
}
</script>

<template>
  <div v-if="card" class="layout-panel">
    <div v-if="isFree" class="field-2">
      <MFormItem label="X">
        <MInputNumber :model-value="card.x ?? 0" :min="0" fluid
          @update:model-value="setGeometry('x', $event as number | undefined)" />
      </MFormItem>
      <MFormItem label="Y">
        <MInputNumber :model-value="card.y ?? 0" :min="0" fluid
          @update:model-value="setGeometry('y', $event as number | undefined)" />
      </MFormItem>
      <MFormItem label="宽">
        <MInputNumber :model-value="card.w ?? 0" :min="24" fluid
          @update:model-value="setGeometry('w', $event as number | undefined)" />
      </MFormItem>
      <MFormItem label="高">
        <MInputNumber :model-value="card.h ?? 0" :min="1" fluid
          @update:model-value="setGeometry('h', $event as number | undefined)" />
      </MFormItem>
    </div>
    <MFormItem v-else label="跨列数">
      <MInputNumber
        :model-value="card.span ?? 6"
        :min="1"
        :max="store.page.grid?.cols ?? 12"
        fluid
        @update:model-value="store.resizeCard(card.id, Number($event ?? 6))"
      />
    </MFormItem>

    <div class="op-row">
      <MButton type="default" size="small" block @click="store.bringForward(card.id)">
        <SvgIcon name="arrow-up-right" :px="12" /> 上移一层
      </MButton>
      <MButton type="default" size="small" block @click="store.sendBackward(card.id)">
        <SvgIcon name="arrow-down-right" :px="12" /> 下移一层
      </MButton>
    </div>
    <div class="op-row">
      <MButton type="default" size="small" block @click="store.bringTo(card.id, 'front')">置顶</MButton>
      <MButton type="default" size="small" block @click="store.bringTo(card.id, 'back')">置底</MButton>
    </div>
    <div class="op-row">
      <MButton
        :type="card.status?.lock ? 'primary' : 'default'"
        size="small" block
        @click="store.setCardStatus(card.id, { lock: !card.status?.lock })"
      >
        <SvgIcon name="lock" :px="12" /> {{ card.status?.lock ? '解锁' : '锁定' }}
      </MButton>
      <MButton
        :type="card.status?.hide ? 'primary' : 'default'"
        size="small" block
        @click="store.setCardStatus(card.id, { hide: !card.status?.hide })"
      >
        <SvgIcon :name="card.status?.hide ? 'eye-off' : 'eye'" :px="12" /> {{ card.status?.hide ? '显示' : '隐藏' }}
      </MButton>
    </div>
    <div class="op-row">
      <MButton type="default" size="small" block @click="store.duplicateCard(card.id)">
        <SvgIcon name="plus" :px="12" /> 复制
      </MButton>
      <MButton danger size="small" block @click="store.removeCard(card.id)">
        <SvgIcon name="x" :px="12" /> 删除
      </MButton>
    </div>
  </div>
</template>

<style scoped>
.layout-panel {
  display: flex;
  flex-direction: column;
}

.op-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.op-row :deep(.m-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
</style>
