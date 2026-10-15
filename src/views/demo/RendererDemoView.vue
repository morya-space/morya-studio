<script setup lang="ts">
/**
 * SchemaRenderer 集成验证页
 * 用渲染器渲染一个示例 PageSchema（含 5 种卡片），验证引擎端到端可用。
 */

import SchemaRenderer from '../engine/SchemaRenderer.vue'
import { useDataStore } from '../data/store'
import type { PageSchema } from '../types/schema'

const dataStore = useDataStore()

const demoPage: PageSchema = {
  id: 'renderer-demo',
  title: 'Renderer Demo',
  layout: 'grid',
  grid: { cols: 12, gap: 24 },
  cards: [
    {
      id: 'kpi-revenue',
      type: 'stat',
      title: '总收入',
      span: 4,
      order: 0,
      dataSourceId: 'ds-kpi',
      stat: { valueField: 'revenue', prefix: '$', trendField: 'trend', trendType: 'auto' },
    },
    {
      id: 'kpi-orders',
      type: 'stat',
      title: '订单数',
      span: 4,
      order: 1,
      dataSourceId: 'ds-kpi',
      stat: { valueField: 'orders', trendField: 'ordersTrend', trendType: 'auto' },
    },
    {
      id: 'kpi-users',
      type: 'stat',
      title: '活跃用户',
      span: 4,
      order: 2,
      dataSourceId: 'ds-kpi',
      stat: { valueField: 'users', trendField: 'usersTrend', trendType: 'auto' },
    },
    {
      id: 'sales-chart',
      type: 'chart',
      title: '销售趋势',
      span: 8,
      order: 3,
      dataSourceId: 'ds-sales',
      chart: { chartType: 'area', xField: 'month', yField: 'sales', smooth: true, height: 300 },
    },
    {
      id: 'category-pie',
      type: 'chart',
      title: '品类占比',
      span: 4,
      order: 4,
      dataSourceId: 'ds-category',
      chart: { chartType: 'pie', xField: 'name', yField: 'value', showLegend: true, height: 300 },
    },
    {
      id: 'recent-table',
      type: 'table',
      title: '最近订单',
      span: 8,
      order: 5,
      dataSourceId: 'ds-orders',
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
        showPagination: true,
        pageSize: 5,
      },
    },
    {
      id: 'top-list',
      type: 'list',
      title: '热销产品',
      span: 4,
      order: 6,
      dataSourceId: 'ds-products',
      list: { titleField: 'name', subtitleField: 'category', valueField: 'sales', valueType: 'number', trendField: 'trend' },
    },
    {
      id: 'promo-banner',
      type: 'banner',
      span: 12,
      order: 7,
      dataSource: { type: 'static', staticData: [] },
      banner: {
        title: '升级到专业版',
        description: '解锁全部图表类型与无限数据源',
        buttonText: '立即升级',
        buttonAction: 'upgrade',
      },
    },
  ],
}

// 数据源注册放在 setup 同步执行，确保 SchemaRenderer 挂载加载数据前已就绪
function registerDemoDataSources() {
  dataStore.registerDataSource({
    id: 'ds-kpi',
    type: 'static',
    staticData: [{ revenue: 128430, trend: '+12.5%', orders: 1284, ordersTrend: '+8.2%', users: 8943, usersTrend: '-2.4%' }],
  })
  dataStore.registerDataSource({
    id: 'ds-sales',
    type: 'static',
    staticData: [
      { month: '1月', sales: 4200 }, { month: '2月', sales: 3800 }, { month: '3月', sales: 5600 },
      { month: '4月', sales: 4900 }, { month: '5月', sales: 7200 }, { month: '6月', sales: 6800 },
    ],
  })
  dataStore.registerDataSource({
    id: 'ds-category',
    type: 'static',
    staticData: [
      { name: '电子产品', value: 4200 }, { name: '服装', value: 3100 },
      { name: '食品', value: 2400 }, { name: '家居', value: 1800 },
    ],
  })
  dataStore.registerDataSource({
    id: 'ds-orders',
    type: 'static',
    staticData: [
      { id: 'ORD-001', customer: '张三', amount: 1299, status: 'paid' },
      { id: 'ORD-002', customer: '李四', amount: 599, status: 'pending' },
      { id: 'ORD-003', customer: '王五', amount: 2899, status: 'paid' },
      { id: 'ORD-004', customer: '赵六', amount: 199, status: 'failed' },
      { id: 'ORD-005', customer: '钱七', amount: 899, status: 'paid' },
      { id: 'ORD-006', customer: '孙八', amount: 1599, status: 'pending' },
    ],
  })
  dataStore.registerDataSource({
    id: 'ds-products',
    type: 'static',
    staticData: [
      { name: '无线耳机', category: '电子', sales: 1234, trend: '+15%' },
      { name: '智能手表', category: '电子', sales: 986, trend: '+8%' },
      { name: '运动鞋', category: '服装', sales: 765, trend: '-3%' },
      { name: '咖啡机', category: '家居', sales: 543, trend: '+5%' },
    ],
  })
}

registerDemoDataSources()

function onCardAction(cardId: string, action: { label: string; action: string }) {
  console.log('[demo] card action', cardId, action)
}
</script>

<template>
  <div class="renderer-demo">
    <SchemaRenderer :page="demoPage" @card-action="onCardAction" />
  </div>
</template>

<style scoped>
.renderer-demo {
  padding: 24px 32px;
  background: var(--m-color-page-bg);
  min-height: 100%;
}
</style>
