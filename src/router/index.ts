import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import LoginView from '../views/LoginView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'
import SettingsView from '../views/SettingsView.vue'
import RendererDemoView from '../views/RendererDemoView.vue'
import PageListView from '../views/PageListView.vue'
import EditorView from '../views/EditorView.vue'
import PreviewView from '../views/PreviewView.vue'
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
    {
      path: '/demo/renderer',
      name: 'renderer-demo',
      component: RendererDemoView,
    },
    {
      path: '/pages',
      name: 'page-list',
      component: PageListView,
    },
    {
      path: '/editor',
      name: 'editor-new',
      component: EditorView,
      meta: { bare: true },
    },
    {
      path: '/editor/:id',
      name: 'editor',
      component: EditorView,
      meta: { bare: true },
    },
    {
      path: '/preview/:id',
      name: 'preview',
      component: PreviewView,
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
    /** 沉浸式全屏（无侧栏/顶栏），如低代码编辑器 */
    bare?: boolean
  }
}
