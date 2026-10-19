<script setup lang="ts">
/**
 * 低代码编辑器主视图
 * 三栏布局：左（组件/数据源/大纲）+ 中（画布）+ 右（属性）
 * 快捷键：Ctrl+Z 撤销 / Ctrl+Shift+Z 重做 / Ctrl+S 保存
 * 支持：/editor（新建）、/editor/:id（编辑）
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { MSkeleton, message } from 'morya-ui'
import EditorTopBar from '../../editor/components/EditorTopBar.vue'
import EditorLeftPanel from '../../editor/components/EditorLeftPanel.vue'
import EditorRightPanel from '../../editor/components/EditorRightPanel.vue'
import EditorCanvas from '../../editor/components/EditorCanvas.vue'
import EditorBottomBar from '../../editor/components/EditorBottomBar.vue'
import CanvasContextMenu from '../../editor/components/CanvasContextMenu.vue'
import { useEditorStore } from '../../editor/store'
import { useDataStore } from '../../data/store'
import { plain } from '../../editor/plain'
import { initPages, getPage, genPageId } from '../../services/page'
import { initDataSources, listDataSources } from '../../services/datasource'
import { validatePage } from '../../engine/validate'

const route = useRoute()
const router = useRouter()
const editorStore = useEditorStore()
const dataStore = useDataStore()

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
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

onBeforeRouteLeave(() => {
  if (!editorStore.dirty) return true
  return window.confirm('当前看板尚未保存，离开后将丢失这些修改。确定离开吗？')
})

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!editorStore.dirty) return
  e.preventDefault()
  e.returnValue = ''
}

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
  } else if (mod && key === 'g' && e.shiftKey) {
    e.preventDefault()
    editorStore.ungroupSelection()
  } else if (mod && key === 'g') {
    e.preventDefault()
    if (editorStore.groupSelection()) message.success('已成组')
  } else if (mod && key === 'l') {
    e.preventDefault()
    editorStore.toggleSelectionLock()
  } else if (mod && key === 'h') {
    e.preventDefault()
    editorStore.toggleSelectionHide()
  } else if (mod) {
    return
  }

  // 自由布局：选中卡片的常用操作（支持多选）
  if (editorStore.selectionCount > 0 && editorStore.page.layout === 'free') {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      editorStore.removeSelection()
      return
    }
    if (e.key === 'Escape') {
      editorStore.clearSelection()
      return
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowUp') dy = -step
      if (e.key === 'ArrowDown') dy = step
      if (e.key === 'ArrowLeft') dx = -step
      if (e.key === 'ArrowRight') dx = step
      editorStore.beginChange()
      editorStore.moveCardsBy(editorStore.selectedIds, dx, dy)
    }
  }
}

/** 预览：把当前 Schema 写入 draft，并新开全屏页面预览 */
function onPreview() {
  const knownDataSourceIds = new Set(listDataSources().map(ds => ds.id).filter((id): id is string => Boolean(id)))
  const errors = validatePage(editorStore.page, knownDataSourceIds).issues.filter(issue => issue.level === 'error')
  if (errors.length > 0) {
    message.error(`无法预览：${errors[0].message}`)
    return
  }
  const id = editorStore.page.id
  try {
    localStorage.setItem(`morya:preview:${id}`, JSON.stringify(plain(editorStore.page)))
  } catch {
    message.warn('本地存储不可用，将打开已保存版本')
  }
  const href = router.resolve({ name: 'preview', params: { id }, query: { draft: '1' } }).href
  window.open(href, '_blank', 'noopener')
}
</script>

<template>
  <div class="editor-view">
    <EditorTopBar @preview="onPreview" />
    <div v-if="ready" class="editor-main">
      <EditorLeftPanel v-if="editorStore.showLeft" />
      <EditorCanvas />
      <EditorRightPanel v-if="editorStore.showRight" />
    </div>
    <EditorBottomBar v-if="ready" />
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

    <!-- 画布 / 组件右键菜单 -->
    <CanvasContextMenu />
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
