<script setup lang="ts">
import type { DropdownItem, MenuItem } from 'morya-ui'
import {
  MAvatar,
  MBreadcrumb,
  MButton,
  MDropdown,
  MLayout,
  MLayoutContent,
  MLayoutHeader,
  MLayoutSider,
  MMenu,
  useTheme,
} from 'morya-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Brand from '../../components/brand/Brand.vue'
import { usePermission } from '../../composables/usePermission'
import { logout, useAuth } from '../../services/auth'

const router = useRouter()
const route = useRoute()
const { user } = useAuth()
const { can } = usePermission()
const { isDark, toggleTheme } = useTheme()

const collapsed = ref(false)
const selectedKey = ref(String(route.name ?? 'dashboard'))

const menuPathMap: Record<string, string> = {
  workbanch: '/workbanch',
  dashboard: '/dashboard',
  dataset: '/dataset',
  users: '/settings/users',
  roles: '/settings/roles',
  permissions: '/settings/permissions',
  profile: '/settings/profile',
  security: '/settings/security',
}

const breadcrumbLabels: Record<string, string> = {
  workbanch: '工作台',
  dashboard: '仪表盘',
  dataset: '数据集',
  users: '用户管理',
  roles: '角色管理',
  permissions: '权限管理',
  profile: '个人资料',
  security: '安全设置',
  'no-access': '暂无权限',
}

const model = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  if (can('workbench.read'))
    items.push({ key: 'workbanch', label: '工作台', icon: 'home' })
  if (can('dashboard.read'))
    items.push({ key: 'dashboard', label: '仪表盘', icon: 'chart-bar' })
  if (can('dataset.read'))
    items.push({ key: 'dataset', label: '数据集', icon: 'database' })

  const settingsItems: MenuItem[] = []
  if (can('users.read'))
    settingsItems.push({ key: 'users', label: '用户管理', icon: 'user' })
  if (can('roles.read'))
    settingsItems.push({ key: 'roles', label: '角色管理', icon: 'shield' })
  if (can('permissions.read'))
    settingsItems.push({ key: 'permissions', label: '权限管理', icon: 'book' })
  if (can('profile.read'))
    settingsItems.push({ key: 'profile', label: '个人资料', icon: 'user' })
  if (can('security.read'))
    settingsItems.push({ key: 'security', label: '安全设置', icon: 'lock' })
  if (settingsItems.length)
    items.push({ key: 'settings', label: '设置', icon: 'settings', items: settingsItems })
  return items
})

const accountItems = computed<DropdownItem[]>(() => {
  const items: DropdownItem[] = []
  if (can('profile.read'))
    items.push({ value: 'profile', label: '个人资料', icon: 'user' })
  if (can('security.read'))
    items.push({ value: 'security', label: '安全设置', icon: 'lock' })
  if (items.length)
    items.push({ separator: true })
  items.push({ value: 'logout', label: '退出登录', icon: 'external-link' })
  return items
})

const breadcrumbModel = computed(() => {
  const name = typeof route.name === 'string' ? route.name : ''
  if (!name || name === 'home' || name === 'settings-home')
    return []

  const label = breadcrumbLabels[name] ?? String(route.meta.title ?? name)
  const isSettingsChild = ['users', 'roles', 'permissions', 'profile', 'security'].includes(name)
  if (isSettingsChild) {
    return [
      { label: '设置', to: '/settings' },
      { label },
    ]
  }
  return [{ label }]
})

watch(
  () => route.name,
  (name) => {
    if (typeof name !== 'string' || name === 'home' || name === 'settings-home')
      return
    selectedKey.value = name
  },
  { immediate: true },
)

function goMenuPath(item: MenuItem) {
  if (item.items?.length)
    return
  const path = menuPathMap[String(item.key)]
  if (path)
    void router.push(path)
  else
    void router.push({ name: String(item.key) })
}

function onAccountSelect(item: DropdownItem) {
  if (item.value === 'logout') {
    void logout().finally(() => router.replace({ name: 'login' }))
    return
  }
  if (item.value === 'profile' || item.value === 'security') {
    const path = menuPathMap[item.value]
    if (path)
      void router.push(path)
  }
}

const initials = computed(() => (user.value?.name?.slice(0, 1) || 'M').toUpperCase())
</script>

<template>
  <MLayout class="app-shell-layout">
    <MLayoutHeader bordered class="app-header">
      <div class="app-header__start">
        <Brand />
        <MBreadcrumb
          class="app-breadcrumb"
          :home="{ label: '首页', to: '/' }"
          :model="breadcrumbModel"
          separator="/"
        />
      </div>
      <div class="app-header__end">
        <MButton
          text
          icon-only
          :aria-label="isDark ? '切换到浅色主题' : '切换到深色主题'"
          @click="toggleTheme()"
        >
          <template #icon>
            <svg
              v-if="isDark"
              viewBox="0 0 24 24"
              width="1em"
              height="1em"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              width="1em"
              height="1em"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z" />
            </svg>
          </template>
        </MButton>
        <div class="account">
          <span class="account-name">{{ user?.name }}</span>
          <MDropdown :items="accountItems" placement="bottom-end" @select="onAccountSelect">
            <template #trigger>
              <MButton text aria-label="账户菜单">
                <MAvatar :label="initials" size="sm" />
              </MButton>
            </template>
          </MDropdown>
        </div>
      </div>
    </MLayoutHeader>

    <MLayout has-sider class="app-body">
      <MLayoutSider
        v-model:collapsed="collapsed"
        bordered
        show-trigger="bar"
        collapse-mode="width"
        :width="220"
        :collapsed-width="80"
        :padding="0"
        content-class="app-sider-content"
      >
        <MMenu
          v-model:selected-key="selectedKey"
          :model="model"
          :collapsed="collapsed"
          :collapsed-width="64"
          :default-expanded-keys="['settings']"
          embedded
          @select="goMenuPath"
        />
      </MLayoutSider>

      <MLayoutContent
        embedded
        :padding="0"
        content-class="app-content"
      >
        <RouterView />
      </MLayoutContent>
    </MLayout>
  </MLayout>
</template>

<style scoped>
.app-shell-layout {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--m-space-4);
  min-height: var(--m-layout-header-height, 3.5rem);
  padding: 0 var(--m-space-4);
}

.app-header__start,
.app-header__end,
.account {
  display: flex;
  align-items: center;
  gap: var(--m-space-3);
  min-width: 0;
}

.app-header__start {
  flex: 1 1 auto;
}

.app-breadcrumb {
  min-width: 0;
}

.app-body {
  /* Nested MLayout defaults to height:100%; override so the column flex can size it. */
  --m-layout-height: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.account-name {
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-sm);
  white-space: nowrap;
}

:deep(.app-sider-content) {
  /* Single padding layer for sider content */
  padding: var(--m-space-2) var(--m-space-1);
  height: 100%;
}

/*
 * morya-ui 0.2.4 quirk:
 * `.m-layout-sider__scroll` defaults to opacity:0, but `--show-content`
 * only restores `.m-layout-sider__scrollbar`. Menu sits in the wrap, so it
 * stays invisible even though layout/geometry are correct.
 */
:deep(.m-layout-sider--show-content .m-layout-sider__scroll) {
  opacity: 1;
}

:deep(.app-content) {
  /* Single padding layer for page content */
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: var(--m-space-4);
}

@media (max-width: 48rem) {
  .account-name {
    display: none;
  }

  :deep(.app-content) {
    padding: var(--m-space-3);
  }
}
</style>
