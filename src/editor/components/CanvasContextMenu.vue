<script setup lang="ts">
/**
 * 画布右键菜单（对齐 go-view useContextMenu）
 * 组件菜单 / 画布菜单。
 */

import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useEditorStore } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()

const menu = computed(() => store.contextMenu)

interface MenuItem { label: string; icon?: string; danger?: boolean; disabled?: boolean; run: () => void }

const items = computed<MenuItem[]>(() => {
  const m = menu.value
  if (!m) return []
  const card = m.cardId ? store.page.cards.find(c => c.id === m.cardId) : null

  if (!card) {
    // 画布菜单
    return [
      { label: '全选', icon: 'grid', run: () => store.selectAll() },
      { label: '粘贴', icon: 'plus', disabled: !store.clipboard, run: () => resume(store.pasteCard) },
      { label: '清空画布', icon: 'x', danger: true, disabled: store.page.cards.length === 0, run: () => store.clearAll() },
    ]
  }

  // 组件菜单（多选时对所选生效）
  const multi = store.selectionCount > 1
  return [
    { label: '复制', icon: 'plus', run: () => store.duplicateCard(card.id) },
    { label: '上移一层', icon: 'arrow-up-right', run: () => store.bringForward(card.id) },
    { label: '下移一层', icon: 'arrow-down-right', run: () => store.sendBackward(card.id) },
    { label: '置顶', icon: 'arrow-up-right', run: () => store.bringTo(card.id, 'front') },
    { label: '置底', icon: 'arrow-down-right', run: () => store.bringTo(card.id, 'back') },
    { label: '成组', icon: 'layers', disabled: !multi, run: () => store.groupSelection() },
    { label: '解组', disabled: !store.selectedIds.some(id => store.page.cards.find(c => c.id === id)?.groupId), run: () => store.ungroupSelection() },
    { label: card.status?.lock ? '解锁' : '锁定', icon: 'lock', run: () => store.setCardStatus(card.id, { lock: !card.status?.lock }) },
    { label: card.status?.hide ? '显示' : '隐藏', icon: card.status?.hide ? 'eye-off' : 'eye', run: () => store.setCardStatus(card.id, { hide: !card.status?.hide }) },
    { label: '删除', icon: 'x', danger: true, run: () => (multi ? store.removeSelection() : store.removeCard(card.id)) },
  ]
})

function resume(fn: () => string | null) {
  fn()
}

const style = computed(() => ({ left: `${menu.value?.x ?? 0}px`, top: `${menu.value?.y ?? 0}px` }))

function run(item: MenuItem) {
  if (item.disabled) return
  item.run()
  store.closeContextMenu()
}

function onGlobalDown(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('.canvas-context-menu')) return
  store.closeContextMenu()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') store.closeContextMenu()
}

onMounted(() => {
  window.addEventListener('mousedown', onGlobalDown)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onGlobalDown)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="menu" class="canvas-context-menu" :style="style" role="menu">
    <button
      v-for="(item, i) in items"
      :key="i"
      type="button"
      class="canvas-context-menu__item"
      :class="{ 'is-danger': item.danger, 'is-disabled': item.disabled }"
      role="menuitem"
      @click="run(item)"
    >
      <SvgIcon v-if="item.icon" :name="item.icon" :px="13" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.canvas-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 160px;
  padding: 4px;
  background: var(--m-color-surface);
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  box-shadow: var(--m-shadow-card-hover);
}

.canvas-context-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--m-radius-sm);
  background: transparent;
  color: var(--m-color-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.canvas-context-menu__item:hover {
  background: color-mix(in srgb, var(--m-color-primary) 8%, transparent);
}

.canvas-context-menu__item.is-danger {
  color: var(--m-color-danger);
}

.canvas-context-menu__item.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
