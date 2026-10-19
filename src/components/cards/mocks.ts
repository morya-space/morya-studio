/**
 * 组件默认 Mock 数据（v0.4）
 * 每个数据型组件新建时默认绑定一份可立即渲染的 Mock 数据，
 * 字段与组件默认配置（chart.xField/yField 等）对应，开箱即用。
 */

import type { CardType } from '../../types/schema'

type Row = Record<string, unknown>

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月']
const CATEGORIES = ['A', 'B', 'C', 'D', 'E']

const CARTESIAN: Row[] = MONTHS.map((m, i) => ({ x: m, y: 120 + i * 45 }))
const PIE: Row[] = CATEGORIES.map((c, i) => ({ x: `分类${c}`, y: (i + 1) * 12 }))

const MOCKS: Partial<Record<CardType, () => Row[]>> = {
  // 图表
  chart: () => CARTESIAN,
  bar: () => CARTESIAN,
  line: () => CARTESIAN,
  area: () => CARTESIAN,
  scatter: () => CARTESIAN,
  barH: () => CARTESIAN,
  barLine: () => MONTHS.map((m, i) => ({ x: m, y: 120 + i * 45, line: 80 + i * 30 })),
  pie: () => PIE,
  radar: () => [
    { x: '性能', y: 80 }, { x: '可用性', y: 92 }, { x: '安全', y: 70 },
    { x: '成本', y: 60 }, { x: '体验', y: 88 },
  ],
  funnel: () => CATEGORIES.map((c, i) => ({ x: `${c} 阶段`, y: 100 - i * 18 })),
  gauge: () => [{ x: '完成度', y: 72 }],
  sankey: () => [
    { x: '访问', target: '注册', y: 120 },
    { x: '注册', target: '下单', y: 80 },
    { x: '下单', target: '支付', y: 60 },
  ],
  graph: () => [
    { x: 'A', target: 'B', y: 1 },
    { x: 'B', target: 'C', y: 1 },
    { x: 'A', target: 'C', y: 2 },
  ],
  heatmap: () => [
    { x: '周一', row: '上午', value: 12 }, { x: '周一', row: '下午', value: 20 },
    { x: '周二', row: '上午', value: 8 }, { x: '周二', row: '下午', value: 26 },
    { x: '周三', row: '上午', value: 15 }, { x: '周三', row: '下午', value: 18 },
  ],
  treeMap: () => [
    { name: '前端', value: 40 }, { name: '后端', value: 55 },
    { name: '数据', value: 25 }, { name: '运维', value: 15 },
  ],
  wordCloud: () => ['数据', '图表', '看板', '大屏', '指标', '趋势', '占比', '实时']
    .map((w, i) => ({ name: w, value: 100 - i * 9 })),
  waterPolo: () => [{ value: 62 }],

  // 数据卡
  stat: () => [{ value: 1234, label: '今日营收', trend: 12 }],
  number: () => [{ value: 8888 }],
  table: () => MONTHS.map((m, i) => ({ 月份: m, 销售额: 1200 + i * 320, 订单数: 30 + i * 7, 同比: `${5 + i}%` })),
  scrollTable: () => MONTHS.map((m, i) => ({ 月份: m, 销售额: 1200 + i * 320, 订单数: 30 + i * 7 })),
  list: () => CATEGORIES.map((c, i) => ({ name: `项目 ${c}`, value: (i + 1) * 120, trend: (i % 2 ? -1 : 1) * (i + 1) * 3 })),
}

/** 返回该组件的默认 Mock 行（数据型组件）；非数据型返回空数组 */
export function defaultMockFor(type: CardType): Row[] {
  const fn = MOCKS[type]
  return fn ? fn() : []
}
