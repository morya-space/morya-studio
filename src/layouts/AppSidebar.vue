<script setup lang="ts">
import { computed, h } from 'vue'
import { useRoute, RouterLink, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MMenu } from 'morya-ui'
import BrandMark from '../components/common/BrandMark.vue'
import SvgIcon from '../components/common/SvgIcon.vue'
import { navItems } from '../navigation'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const activeKey = computed(() => {
  // 精确匹配优先，其次按路径前缀（支持 /editor/:id 等子路由高亮所属模块）
  const exact = navItems.find(item => item.to === route.path)
  if (exact) return exact.key
  const prefix = navItems.find(item => item.to !== '/' && route.path.startsWith(item.to))
  if (prefix) return prefix.key
  // 编辑器/预览路由归到面板模块
  if (route.path.startsWith('/editor') || route.path.startsWith('/preview')) return 'panels'
  return 'dashboard'
})

const menuModel = computed(() =>
  navItems.map(item => ({
    key: item.key,
    label: t(item.labelKey),
    // MMenu 支持自定义图标组件：用本地 SVG sprite 图标，保持与其余界面一致
    icon: () => h(SvgIcon, { name: item.icon, px: 16 }),
  })),
)

function onSelect(item: { key?: string }) {
  const target = navItems.find(nav => nav.key === item.key)
  if (target) router.push(target.to)
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="sidebar-header">
      <RouterLink to="/" class="sidebar-logo" aria-label="Morya Studio">
        <BrandMark :size="38" />
      </RouterLink>
    </div>

    <nav class="sidebar-nav" :aria-label="t('nav.primary')">
      <MMenu
        :selected-key="activeKey"
        :model="menuModel"
        collapsed
        embedded
        :collapsed-width="44"
        @select="onSelect"
      />
    </nav>
  </aside>
</template>

<style lang="scss" scoped>
.app-sidebar {
  width: 76px;
  height: 100vh;
  background: var(--m-color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.sidebar-header {
  margin-bottom: 40px;
}

.sidebar-logo {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-sm);

  &:focus-visible {
    outline: 2px solid var(--m-color-primary);
    outline-offset: 2px;
  }
}

.sidebar-nav {
  flex: 1;
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;

  /* Keep the current rail look on top of MMenu (morya-ui ≥ 0.5.5).
     The library now renders collapsed items as grid with an inline
     `padding-inline-start: collapsedWidth/2 - 10` for icon centering —
     we keep that mechanism and only adjust geometry / colors. */
  :deep(.m-menu) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0;
  }

  :deep(.m-menu__item) {
    width: 44px;
    height: 44px;
    margin: 0 auto;
    padding: 0;
  }

  :deep(.m-menu__item-content) {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    cursor: pointer;
    color: var(--m-color-text-muted);
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  /* Library-inline padding-inline-start would double-center the icon;
     zero it out and let grid place the icon dead-center instead. */
  :deep(.m-menu--collapsed .m-menu__item-content) {
    padding-inline-start: 0 !important;
    grid-template-columns: 1fr;
    justify-items: center;
  }

  /* Make the library-painted background surface fill the full 44×44 rail slot,
     so hover / focus / active / selected all render with identical geometry. */
  :deep(.m-menu__item-content::before) {
    inset: 0;
    border-radius: 12px;
  }

  :deep(.m-menu__item-content:hover:not(.m-menu__item-content--disabled)) {
    color: var(--m-color-text);
  }

  :deep(.m-menu__item-content:hover:not(.m-menu__item-content--disabled)::before),
  :deep(.m-menu__item-content--active:not(.m-menu__item-content--disabled)::before) {
    background: var(--m-color-split) !important;
  }

  :deep(.m-menu__item-content:focus-visible) {
    outline: 2px solid var(--m-color-primary);
    outline-offset: 2px;
  }

  :deep(.m-menu__item-content--selected) {
    color: var(--m-color-surface);
  }

  :deep(.m-menu__item-content--selected::before) {
    background: var(--m-color-text) !important;
  }

  :deep(.m-menu__item-content--selected:hover:not(.m-menu__item-content--disabled)::before) {
    /* Keep dark bg on selected hover, just slightly lighter for feedback */
    background: color-mix(in srgb, var(--m-color-text) 85%, var(--m-color-surface)) !important;
  }

  :deep(.m-menu__item-content--selected .m-menu__icon) {
    color: var(--m-color-surface);
  }

  /* Collapsed rail: kill the icon's inline-end margin (label is hidden),
     otherwise the icon gets pushed off-center. */
  :deep(.m-menu--collapsed .m-menu__icon) {
    margin: 0;
    margin-inline-end: 0;
  }
}
</style>
