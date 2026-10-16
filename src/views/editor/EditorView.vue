<script setup lang="ts">
/**
 * 低代码编辑器主视图
 * 三栏布局：左（组件/数据源/大纲）+ 中（画布）+ 右（属性）
 * 快捷键：Ctrl+Z 撤销 / Ctrl+Shift+Z 重做 / Ctrl+S 保存
 * 支持：/editor（新建）、/editor/:id（编辑）
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { MButton, MDialog, MSkeleton, MScrollbar, message } from 'morya-ui'
import EditorTopBar from '../../editor/components/EditorTopBar.vue'
import EditorLeftPanel from '../../editor/components/EditorLeftPanel.vue'
import EditorRightPanel from '../../editor/components/EditorRightPanel.vue'
import EditorCanvas from '../../editor/components/EditorCanvas.vue'
import SchemaRenderer from '../../engine/SchemaRenderer.vue'
import { useEditorStore } from '../../editor/store'
import { useDataStore } from '../../data/store'
import { initPages, getPage, genPageId } from '../../services/page'
import { initDataSources, listDataSources } from '../../services/datasource'

const route = useRoute()
const editorStore = useEditorStore()
const dataStore = useDataStore()

const previewVisible = ref(false)
/** 缓存就绪后再渲染编辑器子面板（子面板同步读 listDataSources） */
const ready = ref(false)

onMounted(async () => {
  try {
    // 缓存就绪后再初始化画布（init 幂等，从列表页进入时秒回）
    await Promise.all([initPages(), initDataSources()])

    // 注册已保存的数据源，供画布实时预览
    for (const ds of listDataSources()) dataStore.registerDataSource(ds)

    // 加载已有页面或新建
    const id = route.params.id as string | undefined
    if (id) {
      const page = getPage(id)
      if (page) editorStore.loadPage(page)
      else editorStore.newPage(id)
    } else {
      editorStore.newPage(genPageId())
    }
  } finally {
    ready.value = true
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  // 输入类控件聚焦时跳过快捷键，避免误触撤销/保存
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
  }
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()

  if (mod && (key === 'z' && e.shiftKey)) {
    e.preventDefault()
    editorStore.redo()
    message.info('已重做')
  } else if (mod && key === 'z') {
    e.preventDefault()
    editorStore.undo()
    message.info('已撤销')
  } else if (mod && key === 's') {
    e.preventDefault()
    void editorStore.save()
  } else if (mod && key === 'd') {
    e.preventDefault()
    if (editorStore.selectedCard) editorStore.duplicateCard(editorStore.selectedCard.id)
  } else if (mod && key === 'c') {
    if (editorStore.selectedCard) {
      e.preventDefault()
      editorStore.copyCard(editorStore.selectedCard.id)
      message.success('已复制')
    }
  } else if (mod && key === 'v') {
    e.preventDefault()
    const id = editorStore.pasteCard()
    if (id) message.success('已粘贴')
  } else if (mod) {
    return
  }

  // 自由布局：选中卡片的常用操作
  if (editorStore.page.layout === 'free' && editorStore.selectedCard) {
    const card = editorStore.selectedCard
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      editorStore.removeCard(card.id)
      return
    }
    if (e.key === 'Escape') {
      editorStore.selectCard(null)
      return
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const patch: Partial<{ x: number; y: number }> = {}
      if (e.key === 'ArrowUp') patch.y = (card.y ?? 0) - step
      if (e.key === 'ArrowDown') patch.y = (card.y ?? 0) + step
      if (e.key === 'ArrowLeft') patch.x = (card.x ?? 0) - step
      if (e.key === 'ArrowRight') patch.x = (card.x ?? 0) + step
      editorStore.beginChange()
      editorStore.setCardGeometry(card.id, patch)
    }
  }
}

function onPreview() {
  previewVisible.value = true
}
</script>

<template>
  <div class="editor-view">
    <EditorTopBar @preview="onPreview" />
    <div v-if="ready" class="editor-main">
      <EditorLeftPanel />
      <EditorCanvas />
      <EditorRightPanel />
    </div>
    <div v-else class="editor-loading">
      <MSkeleton class="editor-loading__bar" height="52px" border-radius="0" />
      <div class="editor-loading__main">
        <MSkeleton width="264px" height="100%" border-radius="0" />
        <div class="editor-loading__canvas">
          <MSkeleton height="100%" border-radius="0" />
        </div>
        <MSkeleton width="300px" height="100%" border-radius="0" />
      </div>
    </div>

    <!-- 预览：用真实 SchemaRenderer 渲染当前 Schema -->
    <MDialog
      v-model="previewVisible"
      :title="editorStore.page.title || '预览'"
      width="90vw"
    >
      <MScrollbar class="preview-body" view-class="preview-body__view" fit-content>
        <SchemaRenderer :page="editorStore.page" />
      </MScrollbar>
      <template #footer>
        <MButton type="primary" @click="previewVisible = false">关闭</MButton>
      </template>
    </MDialog>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.editor-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-loading__bar {
  flex: none;
}

.editor-loading__main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.editor-loading__canvas {
  flex: 1;
  min-width: 0;
  display: flex;
}

.editor-loading__canvas :deep(.m-skeleton) {
  width: 100%;
}

.preview-body {
  background: var(--m-color-page-bg);
  border-radius: var(--m-radius-md);
  max-height: 70vh;
}

.preview-body__view {
  padding: 16px;
}
</style>
