import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import SettingsView from '../views/SettingsView.vue'
import RendererDemoView from '../views/RendererDemoView.vue'
import EditorView from '../views/EditorView.vue'
import PreviewView from '../views/PreviewView.vue'
import WorkbenchView from '../views/WorkbenchView.vue'
import ComponentGalleryView from '../views/ComponentGalleryView.vue'
import DataSourceMonitorView from '../views/DataSourceMonitorView.vue'
import AnalyticsDemoView from '../views/AnalyticsDemoView.vue'
import TemplateCenterView from '../views/TemplateCenterView.vue'
import { useSession } from '../composables/useSession'

const { isAuthenticated } = useSession()

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    // 工作台：看板管理主入口
    {
      path: '/',
      name: 'dashboard',
      component: WorkbenchView,
    },
    // 组件库画廊
    {
      path: '/layers',
      name: 'layers',
      component: ComponentGalleryView,
    },
    // 数据源管理
    {
      path: '/monitor',
      name: 'monitor',
      component: DataSourceMonitorView,
    },
    // 示例分析看板
    {
      path: '/analytics',
      name: 'analytics',
      component: AnalyticsDemoView,
    },
    // 模板中心
    {
      path: '/reports',
      name: 'reports',
      component: TemplateCenterView,
    },
    // 设置
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    // 引擎演示（保留，作开发参考）
    {
      path: '/demo/renderer',
      name: 'renderer-demo',
      component: RendererDemoView,
    },
    // 旧路由兼容
    {
      path: '/pages',
      redirect: '/',
    },
    // 低代码编辑器（全屏沉浸）
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
