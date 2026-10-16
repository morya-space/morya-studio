<script setup lang="ts">
/**
 * 编辑器右侧属性面板
 * 头部分组标题 + 选中卡片信息；未选中时显示「画布设置」。
 */

import { computed } from 'vue'
import { MScrollbar } from 'morya-ui'
import PropertyForm from '../panels/PropertyForm.vue'
import { useEditorStore } from '../store'
import { getCardRegistration } from '../../engine/registry'

const editorStore = useEditorStore()

const card = computed(() => editorStore.selectedCard)

const title = computed(() => {
  if (!card.value) return '画布设置'
  return card.value.title || getCardRegistration(card.value.type)?.label || card.value.type
})

const sub = computed(() => {
  if (!card.value) return '未选中组件'
  const reg = getCardRegistration(card.value.type)
  if (editorStore.page.layout === 'free') {
    return `${reg?.label ?? card.value.type} · ${card.value.w ?? 0} × ${card.value.h ?? 0}`
  }
  return `${reg?.label ?? card.value.type} · 跨 ${card.value.span ?? 6} 列`
})
</script>

<template>
  <aside class="editor-right">
    <div class="rp-head">
      <div>
        <h3 class="rp-title">{{ title }}</h3>
        <p class="rp-sub">{{ sub }}</p>
      </div>
    </div>
    <MScrollbar class="panel-body" view-class="panel-body__view">
      <PropertyForm />
    </MScrollbar>
  </aside>
</template>

<style scoped lang="scss">
.editor-right {
  width: 300px;
  flex-shrink: 0;
  background: var(--m-color-surface);
  border-left: 1px solid var(--m-color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rp-head {
  flex: none;
  padding: 14px 16px;
  border-bottom: 1px solid var(--m-color-border);
}

.rp-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-sub {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 3px 0 0;
}

.panel-body {
  flex: 1;
  min-height: 0;

  :deep(.panel-body__view) {
    padding: 8px 16px 24px;
  }
}
</style>
