import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import SettingsView from '../views/SettingsView.vue'
import RendererDemoView from '../views/RendererDemoView.vue'
import EditorView from '../views/EditorView.vue'
import PreviewView from '../views/PreviewView.vue'
import WorkbenchView from '../views/WorkbenchView.vue'
import PanelListView from '../views/PanelListView.vue'
import DatasourcesView from '../views/DatasourcesView.vue'
import ConnectorsView from '../views/ConnectorsView.vue'
import ComponentsView from '../views/ComponentsView.vue'
import AnalyticsView from '../views/AnalyticsView.vue'
import TemplatesView from '../views/TemplatesView.vue'
import { useSession } from '../composables/useSession'
import { initPages, resetPages } from '../services/page'
import { initDataSources, resetDataSources } from '../services/datasource'
import { initComponents, resetComponents } from '../services/component'
import { initTemplates, resetTemplates } from '../services/template'

const { isAuthenticated, token } = useSession()

// 会话建立后拉取业务数据；登出后清空
watch(token, (t) => {
  if (t) {
    void initPages()
    void initDataSources()
    void initComponents()
    void initTemplates()
  } else {
    resetPages()
    resetDataSources()
    resetComponents()
    resetTemplates()
  }
}, { immediate: true })

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    // 工作台：项目概况总览
    {
      path: '/',
      name: 'dashboard',
      component: WorkbenchView,
    },
    // 面板：可视化面板列表（CRUD），内容编辑进入编辑器
    {
      path: '/panels',
      name: 'panels',
      component: PanelListView,
    },
    // 数据源：数据存储与展示（CRUD + 常规操作）
    {
      path: '/datasources',
      name: 'datasources',
      component: DatasourcesView,
    },
    // 连接器：上传文件 / 连接数据库导入数据
    {
      path: '/connectors',
      name: 'connectors',
      component: ConnectorsView,
    },
    // 组件库：内置 + 自定义组件（CRUD）
    {
      path: '/components',
      name: 'components',
      component: ComponentsView,
    },
    // 分析：跨面板洞察（占位）
    {
      path: '/analytics',
      name: 'analytics',
      component: AnalyticsView,
    },
    // 模板：面板模板，可从模板创建面板
    {
      path: '/templates',
      name: 'templates',
      component: TemplatesView,
    },
    // 设置：管理后台常规配置
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
