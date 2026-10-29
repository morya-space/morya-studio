<script setup lang="ts">
/**
 * 画布右键菜单（对齐 go-view useContextMenu）
 * 组件菜单 / 画布菜单。
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MConfirmDialog } from 'morya-ui'
import { useEditorStore } from '../store'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()

const menu = computed(() => store.contextMenu)
const menuElement = ref<HTMLElement | null>(null)
const menuPosition = ref({ x: 0, y: 0 })
const restoreFocusTo = ref<HTMLElement | null>(null)
const confirmClearVisible = ref(false)

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
      { label: '清空画布', icon: 'x', danger: true, disabled: store.page.cards.length === 0, run: () => { confirmClearVisible.value = true } },
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

const style = computed(() => ({ left: `${menuPosition.value.x}px`, top: `${menuPosition.value.y}px` }))

function run(item: MenuItem) {
  if (item.disabled) return
  item.run()
  store.closeContextMenu()
}

function enabledIndices(): number[] {
  return items.value.flatMap((item, index) => item.disabled ? [] : [index])
}

function focusItem(index: number) {
  menuElement.value?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus()
}

function onMenuKeydown(e: KeyboardEvent) {
  const enabled = enabledIndices()
  if (!enabled.length) return
  const current = [...(menuElement.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .findIndex(button => button === document.activeElement)
  if (e.key === 'Escape') {
    e.preventDefault()
    store.closeContextMenu()
    return
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    const item = items.value[current]
    if (item) run(item)
    return
  }
  let target: number | undefined
  if (e.key === 'ArrowDown') target = enabled[(enabled.indexOf(current) + 1) % enabled.length]
  if (e.key === 'ArrowUp') target = enabled[(enabled.indexOf(current) - 1 + enabled.length) % enabled.length]
  if (e.key === 'Home') target = enabled[0]
  if (e.key === 'End') target = enabled[enabled.length - 1]
  if (target === undefined) return
  e.preventDefault()
  focusItem(target)
}

watch(menu, async (next) => {
  if (!next) {
    restoreFocusTo.value?.focus()
    restoreFocusTo.value = null
    return
  }
  restoreFocusTo.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  menuPosition.value = { x: next.x, y: next.y }
  await nextTick()
  const rect = menuElement.value?.getBoundingClientRect()
  if (rect) {
    menuPosition.value = {
      x: Math.max(8, Math.min(next.x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(next.y, window.innerHeight - rect.height - 8)),
    }
  }
  await nextTick()
  focusItem(enabledIndices()[0] ?? 0)
})

function onGlobalDown(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('.canvas-context-menu')) return
  store.closeContextMenu()
}
onMounted(() => {
  window.addEventListener('mousedown', onGlobalDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onGlobalDown)
})
</script>

<template>
  <div
    v-if="menu"
    ref="menuElement"
    class="canvas-context-menu"
    :style="style"
    role="menu"
    aria-label="画布操作"
    @keydown="onMenuKeydown"
  >
    <button
      v-for="(item, i) in items"
      :key="i"
      type="button"
      class="canvas-context-menu__item"
      :class="{ 'is-danger': item.danger, 'is-disabled': item.disabled }"
      role="menuitem"
      :disabled="item.disabled"
      :aria-disabled="item.disabled || undefined"
      @click="run(item)"
    >
      <SvgIcon v-if="item.icon" :name="item.icon" :px="13" />
      <span>{{ item.label }}</span>
    </button>
  </div>
  <MConfirmDialog
    v-model="confirmClearVisible"
    header="清空画布"
    message="确定清空画布中的全部组件吗？此操作可以在清空后撤销。"
    accept-label="清空"
    reject-label="取消"
    accept-color="danger"
    type="warning"
    @accept="store.clearAll()"
  />
</template>

<style lang="scss" scoped>
.canvas-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 160px;
  padding: 4px;
  background: var(--m-color-surface);
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  box-shadow: var(--m-shadow-card-hover);

  &__item {
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

    &:hover {
      background: color-mix(in srgb, var(--m-color-primary) 8%, transparent);
    }

    &.is-danger {
      color: var(--m-color-danger);
    }

    &.is-disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>
