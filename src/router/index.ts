import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/auth/LoginView.vue'
import RegisterView from '../views/auth/RegisterView.vue'
import ForgotPasswordView from '../views/auth/ForgotPasswordView.vue'
import SettingsView from '../views/settings/SettingsView.vue'
import RendererDemoView from '../views/demo/RendererDemoView.vue'
import EditorView from '../views/editor/EditorView.vue'
import PreviewView from '../views/preview/PreviewView.vue'
import PublicViewerView from '../views/preview/PublicViewerView.vue'
import WorkbenchView from '../views/dashboard/WorkbenchView.vue'
import PanelListView from '../views/panels/PanelListView.vue'
import DatasourcesView from '../views/datasources/DatasourcesView.vue'
import DatasourceDetailView from '../views/datasources/DatasourceDetailView.vue'
import ConnectorsView from '../views/connectors/ConnectorsView.vue'
import ComponentsView from '../views/components/ComponentsView.vue'
import AnalyticsView from '../views/analytics/AnalyticsView.vue'
import TemplatesView from '../views/templates/TemplatesView.vue'
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
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
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
    // 数据源详情：单个数据源的数据预览（全屏独立页，无侧栏/顶栏）
    {
      path: '/datasources/:id',
      name: 'datasource-detail',
      component: DatasourceDetailView,
      meta: { bare: true },
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
      meta: { bare: true },
    },
    // 公开只读看板（分享链接，免登录）
    {
      path: '/view/:id',
      name: 'viewer',
      component: PublicViewerView,
      meta: { public: true },
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
