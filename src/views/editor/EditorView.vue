<script setup lang="ts">
/**
 * 低代码编辑器主视图
 * 三栏布局：左（组件/数据源/大纲）+ 中（画布）+ 右（属性）
 * 快捷键：Ctrl+Z 撤销 / Ctrl+Shift+Z 重做 / Ctrl+S 保存
 * 支持：/editor（新建）、/editor/:id（编辑）
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { MDialog, MLoading, MScrollbar } from 'morya-ui'
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
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const key = e.key.toLowerCase()

  if (key === 'z' && e.shiftKey) {
    e.preventDefault()
    editorStore.redo()
  } else if (key === 'z') {
    e.preventDefault()
    editorStore.undo()
  } else if (key === 's') {
    e.preventDefault()
    void editorStore.save()
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
      <MLoading text="加载中…" />
    </div>

    <!-- 预览：用真实 SchemaRenderer 渲染当前 Schema -->
    <MDialog
      v-model="previewVisible"
      title="预览"
      width="90vw"
    >
      <MScrollbar class="preview-body" view-class="preview-body__view" fit-content>
        <SchemaRenderer :page="editorStore.page" />
      </MScrollbar>
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
  align-items: center;
  justify-content: center;
  min-height: 0;
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
