import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import LoginView from '../views/LoginView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'
import SettingsView from '../views/SettingsView.vue'
import { navItems } from '../navigation'
import { useSession } from '../composables/useSession'

const { isAuthenticated } = useSession()

const placeholderRoutes = navItems
  .filter(item => item.key !== 'dashboard' && item.key !== 'settings')
  .map(item => ({
    path: item.to,
    name: item.key,
    component: PlaceholderView,
  }))

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    ...placeholderRoutes,
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public) {
    if (to.name === 'login' && isAuthenticated.value) return { path: '/' }
    return true
  }
  if (!isAuthenticated.value) {
    return {
      name: 'login',
      query: to.fullPath === '/' ? {} : { redirect: to.fullPath },
    }
  }
  return true
})

export default router

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
  }
}
