<script setup lang="ts">
/**
 * 编辑器顶栏
 * Logo / 页面标题（可编辑）/ 撤销重做 / 预览 / 分享 / 保存
 */

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MButton, MDialog, MInput, MTooltip, message } from 'morya-ui'
import { useEditorStore, CANVAS_W, CANVAS_H } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'
import { getShareStatus, publishPage, unpublishPage, buildShareLink, buildEmbedCode, type ShareStatus } from '../../services/share'
import { importPage } from '../../services/page'

const emit = defineEmits<{
  (e: 'preview'): void
}>()

const router = useRouter()

const store = useEditorStore()

const title = computed({
  get: () => store.page.title,
  set: (v: string) => store.updatePageField('title', v),
})

const zoomPct = computed(() => Math.round(store.zoom * 100))

function onUndo() {
  store.undo()
  message.info('已撤销')
}

function onRedo() {
  store.redo()
  message.info('已重做')
}

function onZoomBy(d: number) {
  store.zoomBy(d)
}

function onFit() {
  const availW = window.innerWidth - 264 - 300 - 140
  const availH = window.innerHeight - 54 - 150
  const fit = Math.min(availW / CANVAS_W, availH / CANVAS_H, 1)
  store.setZoom(Math.max(0.4, fit))
}

async function onSave() {
  try {
    await store.save()
    message.success('已保存')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  }
}

// ==================== 分享 ====================

const shareVisible = ref(false)
const shareLoading = ref(false)
const shareStatus = ref<ShareStatus>({ shared: false, token: null, url: null })

const shareUrl = computed(() =>
  shareStatus.value.token ? buildShareLink(store.page.id, shareStatus.value.token) : '',
)
const embedCode = computed(() =>
  shareStatus.value.token ? buildEmbedCode(store.page.id, shareStatus.value.token) : '',
)

async function refreshShare() {
  try {
    shareStatus.value = await getShareStatus(store.page.id)
  } catch {
    shareStatus.value = { shared: false, token: null, url: null }
  }
}

async function onShareClick() {
  // 未保存先保存，再读取分享状态
  if (store.dirty) await onSave()
  await refreshShare()
  shareVisible.value = true
}

async function onPublish() {
  shareLoading.value = true
  try {
    const { token, url } = await publishPage(store.page.id)
    shareStatus.value = { shared: true, token, url }
    message.success('已发布分享链接')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '发布失败')
  } finally {
    shareLoading.value = false
  }
}

async function onUnpublish() {
  shareLoading.value = true
  try {
    await unpublishPage(store.page.id)
    shareStatus.value = { shared: false, token: null, url: null }
    message.success('已取消分享')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '取消失败')
  } finally {
    shareLoading.value = false
  }
}

async function copy(text: string, tip: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(tip)
  } catch {
    message.error('复制失败，请手动复制')
  }
}

function openShareLink() {
  if (shareUrl.value) window.open(shareUrl.value, '_blank')
}

/** 截图导出当前画布（html2canvas，按需加载） */
async function onScreenshot() {
  const el = document.querySelector('.canvas') as HTMLElement | null
  if (!el) {
    message.error('画布未就绪')
    return
  }
  const prevSelection = [...store.selectedIds]
  store.clearSelection()
  store.setGuides([])
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(el, { backgroundColor: null, useCORS: true, scale: 2 })
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.page.title || 'board'}.png`
    a.click()
    message.success('已导出图片')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '截图失败')
  } finally {
    if (prevSelection.length) store.setSelection(prevSelection)
  }
}

// ==================== 导入 ====================
const fileInput = ref<HTMLInputElement | null>(null)

function onImportClick() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const page = importPage(text)
    store.loadPage(page)
    message.success('已导入')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '导入失败')
  }
}

/** 导出当前 Schema 为 JSON 文件 */
function onExport() {
  try {
    const json = JSON.stringify(store.page, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.page.title || 'board'}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出 JSON')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导出失败')
  }
}
</script>

<template>
  <header class="editor-topbar">
    <div class="topbar-left">
      <MButton variant="filled" icon-only aria-label="返回" @click="router.push('/')">
        <template #icon>
          <SvgIcon name="chevron-left" :px="16" />
        </template>
      </MButton>
      <span class="topbar-logo">Morya</span>
      <div class="topbar-title">
        <MInput v-model="title" placeholder="看板标题" />
        <span v-if="store.dirty" class="draft-badge">草稿</span>
      </div>
    </div>

    <div class="topbar-actions">
      <MTooltip placement="bottom" content="撤销 (Ctrl+Z)">
        <MButton type="text" :disabled="!store.canUndo" aria-label="撤销" icon-only @click="onUndo">
          <template #icon>
            <SvgIcon name="arrow-down-right" :px="16" />
          </template>
        </MButton>
      </MTooltip>
      <MTooltip placement="bottom" content="重做 (Ctrl+Shift+Z)">
        <MButton type="text" :disabled="!store.canRedo" aria-label="重做" icon-only @click="onRedo">
          <template #icon>
            <SvgIcon name="arrow-up-right" :px="16" />
          </template>
        </MButton>
      </MTooltip>

      <span class="topbar-divider" />

      <!-- 画布缩放 -->
      <div class="zoom-box">
        <MButton
          type="text"
          size="small"
          :disabled="store.zoom <= 0.4"
          aria-label="缩小"
          @click="onZoomBy(-0.1)"
        >−</MButton>
        <span class="zoom-box__label">{{ zoomPct }}%</span>
        <MButton
          type="text"
          size="small"
          :disabled="store.zoom >= 1.5"
          aria-label="放大"
          @click="onZoomBy(0.1)"
        >＋</MButton>
      </div>
      <MTooltip placement="bottom" content="适应画布">
        <MButton type="text" aria-label="适应画布" icon-only @click="onFit">
          <template #icon>
            <SvgIcon name="grid" :px="15" />
          </template>
        </MButton>
      </MTooltip>

      <span class="topbar-divider" />

      <MButton type="default" @click="emit('preview')">预览</MButton>
      <MButton type="default" @click="onImportClick">导入</MButton>
      <MButton type="default" @click="onScreenshot">截图</MButton>
      <MButton type="default" @click="onExport">导出</MButton>
      <MButton type="default" @click="onShareClick">分享</MButton>
      <MButton type="primary" :loading="store.saving" @click="onSave">保存</MButton>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="topbar-file"
        @change="onFileChange"
      >
    </div>

    <!-- 分享对话框 -->
    <MDialog v-model="shareVisible" title="分享此看板" width="520px">
      <div v-if="!shareStatus.shared" class="share-panel">
        <p class="share-panel__desc">发布后生成只读分享链接，任何人无需登录即可查看该看板。</p>
        <div class="share-panel__actions">
          <MButton type="primary" :loading="shareLoading" @click="onPublish">发布分享</MButton>
        </div>
      </div>

      <div v-else class="share-panel">
        <div class="share-field">
          <p class="share-field__label">只读链接</p>
          <div class="share-field__row">
            <MInput :model-value="shareUrl" readonly fluid />
            <MButton type="default" @click="copy(shareUrl, '链接已复制')">复制</MButton>
            <MButton type="text" @click="openShareLink">打开</MButton>
          </div>
        </div>

        <div class="share-field">
          <p class="share-field__label">嵌入代码（iframe）</p>
          <div class="share-field__row">
            <MInput :model-value="embedCode" readonly fluid />
            <MButton type="default" @click="copy(embedCode, '嵌入代码已复制')">复制</MButton>
          </div>
        </div>

        <div class="share-panel__actions share-panel__actions--end">
          <MButton type="text" danger :loading="shareLoading" @click="onUnpublish">取消分享</MButton>
        </div>
      </div>
    </MDialog>
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

.draft-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-warning) 14%, transparent);
  color: var(--m-color-warning);
  flex-shrink: 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-file {
  display: none;
}

.topbar-divider {
  width: 1px;
  height: 20px;
  background: var(--m-color-border);
  margin: 0 4px;
}

/* 缩放控件 */
.zoom-box {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--m-radius-md);
  background: var(--m-color-fill-light);
}

.zoom-box :deep(.m-button) {
  min-width: 26px;
  height: 26px;
  padding: 0;
}

.zoom-box :deep(.m-button:disabled) {
  opacity: 0.35;
}

.zoom-box__label {
  font-size: 12px;
  min-width: 44px;
  text-align: center;
  color: var(--m-color-text-muted);
  font-variant-numeric: tabular-nums;
}

/* 分享面板 */
.share-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-panel__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.share-panel__actions {
  display: flex;
  justify-content: flex-start;
}

.share-panel__actions--end {
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--m-color-split);
}

.share-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  margin: 0;
}

.share-field__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
