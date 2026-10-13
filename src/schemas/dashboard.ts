import type { PageSchema } from '../types/schema'

/**
 * Dashboard Schema — 基于 demos/home2.png 设计图
 * SaaS 金融数据看板
 */
export const dashboardSchema: PageSchema = {
  id: 'dashboard-home',
  title: 'Good Evening Team!',
  layout: 'grid',
  grid: {
    cols: 12,
    gap: 24,
  },
  cards: [
    // 顶部渐变 KPI Banner（3 个指标）
    {
      id: 'kpi-banner',
      type: 'banner',
      order: 0,
      span: 12,
      dataSource: {
        type: 'static',
        staticData: [
          { label: 'Opening balance', value: 3700, trend: '+5.4%', trendDirection: 'up', lastYear: '$2.7K', icon: 'wallet' },
          { label: 'Credit for period', value: 2660, trend: '+2.2%', trendDirection: 'up', lastYear: '$1.7K', icon: 'credit-card' },
          { label: 'Debits for period', value: 10800, trend: '-7.4%', trendDirection: 'down', lastYear: '$8.7K', icon: 'pie-chart' },
        ],
      },
      banner: {
        title: 'KPI Summary',
        gradient: 'linear-gradient(135deg, #7C6AEF 0%, #8B5CF6 100%)',
      },
    },
    // 交易时间线（日期 + 胶囊项 + 仪表盘）
    {
      id: 'transactions-panel',
      type: 'custom',
      title: 'All Transactions',
      order: 1,
      span: 12,
      dataSource: {
        type: 'static',
        staticData: [
          { name: 'Dribbble subscription', amount: -60.00, date: 'October 24', time: '5:30 Am', day: 27, color: '#EC4899' },
          { name: 'Figma pro plan', amount: -32.00, date: 'October 28', time: '8:00 Am', day: 28, color: '#6366F1' },
        ],
      },
    },
  ],
}

/**
 * 右侧边栏 Schema
 */
export const sidebarSchema: PageSchema = {
  id: 'right-sidebar',
  title: '',
  layout: 'free',
  cards: [
    // Active Members
    {
      id: 'active-members',
      type: 'custom',
      title: 'Active Members',
      order: 0,
      dataSource: {
        type: 'static',
        staticData: [
          { role: 'UI Designer', percent: 60, color: '#7C6AEF' },
          { role: 'Illustrator', percent: 30, color: '#F59E0B' },
          { role: 'Leader', percent: 10, color: '#EC4899' },
        ],
      },
    },
    // Upgrade account
    {
      id: 'upgrade-account',
      type: 'banner',
      title: 'Upgrade account',
      order: 1,
      dataSource: { type: 'static', staticData: [] },
      banner: {
        title: 'Upgrade account',
        description: 'Unlock our all-in-one suite for surfacing unlimited frature',
        buttonText: 'Upgrade Now',
        buttonAction: 'upgrade',
      },
    },
  ],
}

/**
 * 交易时间线的日期标签
 */
export const weekDays = [
  { day: 'Mon', date: 27 },
  { day: 'Tue', date: 28 },
  { day: 'Wed', date: 29 },
  { day: 'Thu', date: 30 },
]
