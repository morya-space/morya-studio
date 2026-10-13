export interface NavItem {
  key: string
  icon: string
  labelKey: string
  to: string
}

export const navItems: NavItem[] = [
  { key: 'dashboard', icon: 'grid', labelKey: 'nav.dashboard', to: '/' },
  { key: 'layers', icon: 'layers', labelKey: 'nav.layers', to: '/layers' },
  { key: 'monitor', icon: 'activity', labelKey: 'nav.monitor', to: '/monitor' },
  { key: 'chart', icon: 'chart-bar', labelKey: 'nav.analytics', to: '/analytics' },
  { key: 'file', icon: 'file', labelKey: 'nav.reports', to: '/reports' },
  { key: 'settings', icon: 'settings', labelKey: 'nav.settings', to: '/settings' },
]
