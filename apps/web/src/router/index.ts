import type { AuthUser } from '@morya-studio/shared'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../services/auth'

const HOME_CANDIDATES = [
  { name: 'workbanch', permission: 'workbench.read' },
  { name: 'dashboard', permission: 'dashboard.read' },
  { name: 'dataset', permission: 'dataset.read' },
  { name: 'profile', permission: 'profile.read' },
  { name: 'security', permission: 'security.read' },
] as const

const SETTINGS_CANDIDATES = [
  { name: 'users', permission: 'users.read' },
  { name: 'roles', permission: 'roles.read' },
  { name: 'permissions', permission: 'permissions.read' },
  { name: 'profile', permission: 'profile.read' },
  { name: 'security', permission: 'security.read' },
] as const

function hasPermission(user: AuthUser | null | undefined, code: string) {
  return Boolean(user?.permissions?.includes(code))
}

export function resolveHomeRoute(user: AuthUser | null | undefined) {
  const match = HOME_CANDIDATES.find(item => hasPermission(user, item.permission))
  return { name: match?.name ?? 'no-access' }
}

function resolveSettingsRoute(user: AuthUser | null | undefined) {
  const match = SETTINGS_CANDIDATES.find(item => hasPermission(user, item.permission))
  return { name: match?.name ?? 'no-access' }
}

function stayOrRedirect(toName: unknown, target: { name: string }) {
  return toName === target.name ? true : target
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'layout',
      component: () => import('../layouts/Layout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          redirect: () => resolveHomeRoute(useAuth().user.value),
        },
        {
          path: 'workbanch',
          name: 'workbanch',
          component: () => import('../views/workbanch/Workbanch.vue'),
          meta: { permission: 'workbench.read' },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('../views/dashboard/Dashboard.vue'),
          meta: { permission: 'dashboard.read' },
        },
        {
          path: 'dataset',
          name: 'dataset',
          component: () => import('../views/dataset/Dataset.vue'),
          meta: { permission: 'dataset.read' },
        },
        {
          path: 'no-access',
          name: 'no-access',
          component: () => import('../views/NoAccess.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/settings/Settings.vue'),
          children: [
            {
              path: '',
              name: 'settings-home',
              redirect: () => resolveSettingsRoute(useAuth().user.value),
            },
            {
              path: 'users',
              name: 'users',
              component: () => import('../views/settings/users/Users.vue'),
              meta: { permission: 'users.read' },
            },
            {
              path: 'roles',
              name: 'roles',
              component: () => import('../views/settings/roles/Roles.vue'),
              meta: { permission: 'roles.read' },
            },
            {
              path: 'permissions',
              name: 'permissions',
              component: () => import('../views/settings/permissions/Permissions.vue'),
              meta: { permission: 'permissions.read' },
            },
            {
              path: 'profile',
              name: 'profile',
              component: () => import('../views/settings/profile/Profile.vue'),
              meta: { permission: 'profile.read' },
            },
            {
              path: 'security',
              name: 'security',
              component: () => import('../views/settings/security/Security.vue'),
              meta: { permission: 'security.read' },
            },
          ],
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/login/three/Login.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/login/three/Login.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const { isAuthenticated, user } = useAuth()
  const home = resolveHomeRoute(user.value)

  if (to.matched.some(record => record.meta.requiresAuth) && !isAuthenticated.value) {
    if (to.name === 'login')
      return true
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if ((to.name === 'login' || to.name === 'register') && isAuthenticated.value)
    return stayOrRedirect(to.name, home)

  const permission = [...to.matched].reverse().map(record => record.meta.permission).find(Boolean) as string | undefined
  if (permission && isAuthenticated.value && !hasPermission(user.value, permission))
    return stayOrRedirect(to.name, home)
})

export default router
