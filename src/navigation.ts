export interface NavItem {
  key: string
  icon: string
  labelKey: string
  to: string
}

export const navItems: NavItem[] = [
  { key: 'dashboard', icon: 'grid', labelKey: 'nav.dashboard', to: '/' },
  { key: 'panels', icon: 'layout', labelKey: 'nav.panels', to: '/panels' },
  { key: 'datasources', icon: 'database', labelKey: 'nav.datasources', to: '/datasources' },
  { key: 'connectors', icon: 'plug', labelKey: 'nav.connectors', to: '/connectors' },
  { key: 'components', icon: 'layers', labelKey: 'nav.components', to: '/components' },
  { key: 'analytics', icon: 'bar-chart', labelKey: 'nav.analytics', to: '/analytics' },
  { key: 'templates', icon: 'file', labelKey: 'nav.templates', to: '/templates' },
  { key: 'settings', icon: 'settings', labelKey: 'nav.settings', to: '/settings' },
]
