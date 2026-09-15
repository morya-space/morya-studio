export type UserStatus = 'active' | 'disabled'

export interface PermissionDefinition {
  code: string
  name: string
  group: string
  description: string
}

export interface RoleSummary {
  id: string
  name: string
  isSystem: boolean
}

export interface Role {
  id: string
  name: string
  description: string
  isSystem: boolean
  permissions: string[]
  userCount: number
  createdAt: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  status: UserStatus
  roles: RoleSummary[]
  permissions: string[]
  createdAt: string
}

export interface UserRecord extends AuthUser {}

export interface AuthSession {
  id: string
  current: boolean
  ip: string | null
  userAgent: string | null
  createdAt: string
  lastSeenAt: string
  expiresAt: string
}

export interface LoginEvent {
  id: string
  email: string
  success: boolean
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface Paginated<T> {
  items: T[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}

export interface HealthResponse {
  status: 'ok'
  service: string
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { code: 'users.read', name: '查看用户', group: '用户与权限', description: '查看用户列表和账号状态' },
  { code: 'users.write', name: '管理用户', group: '用户与权限', description: '创建、编辑、禁用或删除用户，并分配角色' },
  { code: 'roles.read', name: '查看角色', group: '用户与权限', description: '查看角色及其权限配置' },
  { code: 'roles.write', name: '管理角色', group: '用户与权限', description: '创建、编辑、删除角色并调整权限' },
  { code: 'permissions.read', name: '查看权限目录', group: '用户与权限', description: '查看系统权限清单' },
  { code: 'profile.read', name: '查看资料', group: '个人设置', description: '查看自己的个人资料' },
  { code: 'profile.write', name: '编辑资料', group: '个人设置', description: '修改自己的显示名称' },
  { code: 'security.read', name: '查看安全信息', group: '个人设置', description: '查看登录会话和登录记录' },
  { code: 'security.write', name: '管理安全设置', group: '个人设置', description: '修改密码并管理登录会话' },
  { code: 'workbench.read', name: '访问工作台', group: '工作空间', description: '打开工作台页面' },
  { code: 'workbench.write', name: '编辑工作台', group: '工作空间', description: '后续自定义工作台能力预留' },
  { code: 'dashboard.read', name: '访问仪表盘', group: '工作空间', description: '打开仪表盘页面' },
  { code: 'dashboard.write', name: '编辑仪表盘', group: '工作空间', description: '后续自定义仪表盘能力预留' },
  { code: 'dataset.read', name: '访问数据集', group: '工作空间', description: '打开数据集页面' },
  { code: 'dataset.write', name: '编辑数据集', group: '工作空间', description: '后续自定义数据集能力预留' },
]

export const ALL_PERMISSION_CODES = PERMISSION_CATALOG.map(item => item.code)

export const SYSTEM_ROLE_IDS = {
  admin: 'role_admin',
  editor: 'role_editor',
  viewer: 'role_viewer',
} as const

export const SEED_SUPER_ADMIN = {
  name: '超级管理员',
  email: 'admin@morya.local',
  password: 'admin123',
} as const

export const SYSTEM_ROLE_DEFS = {
  admin: {
    id: SYSTEM_ROLE_IDS.admin,
    name: '超级管理员',
    description: '内置最高权限角色，拥有全部平台能力，不可删除或改权限',
  },
  editor: {
    id: SYSTEM_ROLE_IDS.editor,
    name: '编辑者',
    description: '可使用工作空间并维护个人设置',
  },
  viewer: {
    id: SYSTEM_ROLE_IDS.viewer,
    name: '访客',
    description: '可访问工作空间并维护个人设置',
  },
} as const

export const VIEWER_PERMISSIONS = [
  'profile.read',
  'profile.write',
  'security.read',
  'security.write',
  'workbench.read',
  'dashboard.read',
  'dataset.read',
] as const

export const EDITOR_PERMISSIONS = [
  ...VIEWER_PERMISSIONS,
  'workbench.write',
  'dashboard.write',
  'dataset.write',
] as const
