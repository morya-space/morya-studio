<script setup lang="ts">
/**
 * 编辑器顶栏
 * Logo / 页面标题（可编辑）/ 撤销重做 / 预览 / 保存
 */

import { computed } from 'vue'
import { MButton, MInput, MTooltip, message } from 'morya-ui'
import { useEditorStore } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'

const emit = defineEmits<{
  (e: 'preview'): void
}>()

const store = useEditorStore()

const title = computed({
  get: () => store.page.title,
  set: (v: string) => store.updatePageField('title', v),
})

async function onSave() {
  try {
    await store.save()
    message.success('已保存')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  }
}
</script>

<template>
  <header class="editor-topbar">
    <div class="topbar-left">
      <span class="topbar-logo">Morya</span>
      <div class="topbar-title">
        <MInput v-model="title" placeholder="看板标题" />
        <span v-if="store.dirty" class="dirty-dot" title="未保存" />
      </div>
    </div>

    <div class="topbar-actions">
      <MTooltip content="撤销 (Ctrl+Z)">
        <MButton
          type="text"
          :disabled="!store.canUndo"
          aria-label="撤销"
          icon-only
          @click="store.undo()"
        >
          <SvgIcon name="arrow-down-right" :px="16" />
        </MButton>
      </MTooltip>
      <MTooltip content="重做 (Ctrl+Shift+Z)">
        <MButton
          type="text"
          :disabled="!store.canRedo"
          aria-label="重做"
          icon-only
          @click="store.redo()"
        >
          <SvgIcon name="arrow-up-right" :px="16" />
        </MButton>
      </MTooltip>

      <span class="topbar-divider" />

      <MButton type="default" @click="emit('preview')">预览</MButton>
      <MButton type="primary" :loading="store.saving" @click="onSave">保存</MButton>
    </div>
  </header>
</template>

<style scoped>
.editor-topbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--m-color-surface);
  border-bottom: 1px solid var(--m-color-border);
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.topbar-logo {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-primary);
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--m-color-accent-orange);
  flex-shrink: 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-divider {
  width: 1px;
  height: 20px;
  background: var(--m-color-border);
  margin: 0 4px;
}
</style>
