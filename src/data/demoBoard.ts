/**
 * 示例看板 Schema + 数据源
 * 供 AnalyticsDemoView 展示引擎能力，也可作为模板中心的模板。
 */

import type { DataSourceConfig, PageSchema } from '../types/schema'

export const DEMO_PAGE_ID = 'demo-analytics'

export const demoDataSources: DataSourceConfig[] = [
  {
    id: 'ds-kpi',
    name: 'KPI 指标',
    type: 'static',
    staticData: [{ revenue: 128430, trend: '+12.5%', orders: 1284, ordersTrend: '+8.2%', users: 8943, usersTrend: '-2.4%' }],
  },
  {
    id: 'ds-sales',
    name: '销售趋势',
    type: 'static',
    staticData: [
      { month: '1月', sales: 4200 }, { month: '2月', sales: 3800 }, { month: '3月', sales: 5600 },
      { month: '4月', sales: 4900 }, { month: '5月', sales: 7200 }, { month: '6月', sales: 6800 },
    ],
  },
  {
    id: 'ds-category',
    name: '品类占比',
    type: 'static',
    staticData: [
      { name: '电子产品', value: 4200 }, { name: '服装', value: 3100 },
      { name: '食品', value: 2400 }, { name: '家居', value: 1800 },
    ],
  },
  {
    id: 'ds-orders',
    name: '最近订单',
    type: 'static',
    staticData: [
      { id: 'ORD-001', customer: '张三', amount: 1299, status: 'paid' },
      { id: 'ORD-002', customer: '李四', amount: 599, status: 'pending' },
      { id: 'ORD-003', customer: '王五', amount: 2899, status: 'paid' },
      { id: 'ORD-004', customer: '赵六', amount: 199, status: 'failed' },
      { id: 'ORD-005', customer: '钱七', amount: 899, status: 'paid' },
    ],
  },
  {
    id: 'ds-products',
    name: '热销产品',
    type: 'static',
    staticData: [
      { name: '无线耳机', category: '电子', sales: 1234, trend: '+15%' },
      { name: '智能手表', category: '电子', sales: 986, trend: '+8%' },
      { name: '运动鞋', category: '服装', sales: 765, trend: '-3%' },
      { name: '咖啡机', category: '家居', sales: 543, trend: '+5%' },
    ],
  },
]

export function buildDemoPage(): PageSchema {
  return {
    id: DEMO_PAGE_ID,
    title: '销售分析看板',
    layout: 'grid',
    grid: { cols: 12, gap: 24 },
    cards: [
      {
        id: 'kpi-revenue', type: 'stat', title: '总收入', span: 4, order: 0, dataSourceId: 'ds-kpi',
        stat: { valueField: 'revenue', prefix: '$', trendField: 'trend', trendType: 'auto' },
      },
      {
        id: 'kpi-orders', type: 'stat', title: '订单数', span: 4, order: 1, dataSourceId: 'ds-kpi',
        stat: { valueField: 'orders', trendField: 'ordersTrend', trendType: 'auto' },
      },
      {
        id: 'kpi-users', type: 'stat', title: '活跃用户', span: 4, order: 2, dataSourceId: 'ds-kpi',
        stat: { valueField: 'users', trendField: 'usersTrend', trendType: 'auto' },
      },
      {
        id: 'sales-chart', type: 'chart', title: '销售趋势', span: 8, order: 3, dataSourceId: 'ds-sales',
        chart: { chartType: 'area', xField: 'month', yField: 'sales', smooth: true, height: 300 },
      },
      {
        id: 'category-pie', type: 'chart', title: '品类占比', span: 4, order: 4, dataSourceId: 'ds-category',
        chart: { chartType: 'pie', xField: 'name', yField: 'value', showLegend: true, height: 300 },
      },
      {
        id: 'recent-table', type: 'table', title: '最近订单', span: 8, order: 5, dataSourceId: 'ds-orders',
        table: {
          columns: [
            { key: 'id', title: '订单号', width: 120 },
            { key: 'customer', title: '客户' },
            { key: 'amount', title: '金额', render: 'currency', align: 'right' },
            { key: 'status', title: '状态', render: 'status', statusMap: {
              paid: { type: 'success', label: '已支付' },
              pending: { type: 'warning', label: '待处理' },
              failed: { type: 'danger', label: '失败' },
            } },
          ],
          showPagination: false,
        },
      },
      {
        id: 'top-list', type: 'list', title: '热销产品', span: 4, order: 6, dataSourceId: 'ds-products',
        list: { titleField: 'name', subtitleField: 'category', valueField: 'sales', valueType: 'number', trendField: 'trend' },
      },
    ],
  }
}
