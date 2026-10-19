/**
 * 组件默认 Mock 模板
 * 每个数据型组件新建时默认绑定一份可立即渲染的 Mock 模板，
 * 字段与组件默认配置（chart.xField/yField 等）对应，开箱即用。
 * 模板语法见 data/mockgen.ts（{{int}} / {{date}} / {{inc}} / 顶层 {{repeat N}}）。
 */

import type { CardType } from '../../types/schema'
import { formatMockTemplate } from '../../data/mockgen'

/** 时间序列（日期 x + 数值 y），柱/线/面等笛卡尔图表共用 */
const SERIES = '{{repeat 6}}{"x":"{{date 2024-01-01 2024-06-30}}","y":"{{int 100 400}}"}'

const TEMPLATES: Partial<Record<CardType, string>> = {
  // 图表
  chart: SERIES,
  bar: SERIES,
  line: SERIES,
  area: SERIES,
  scatter: SERIES,
  barH: SERIES,
  barLine: '{{repeat 6}}{"x":"{{date 2024-01-01 2024-06-30}}","y":"{{int 100 400}}","line":"{{int 60 260}}"}',
  pie: '{{repeat 5}}{"x":"分类{{inc}}","y":"{{int 10 80}}"}',
  radar: '{{repeat 5}}{"x":"指标{{inc}}","y":"{{int 60 95}}"}',
  funnel: '{{repeat 5}}{"x":"阶段{{inc}}","y":"{{int 20 100}}"}',
  gauge: '{"x":"完成度","y":72}',
  sankey: '[{"x":"访问","target":"注册","y":120},{"x":"注册","target":"下单","y":80},{"x":"下单","target":"支付","y":60}]',
  graph: '[{"x":"A","target":"B","y":1},{"x":"B","target":"C","y":1},{"x":"A","target":"C","y":2}]',
  heatmap: '[{"x":"周一","row":"上午","value":12},{"x":"周一","row":"下午","value":20},{"x":"周二","row":"上午","value":8},{"x":"周二","row":"下午","value":26},{"x":"周三","row":"上午","value":15},{"x":"周三","row":"下午","value":18}]',
  treeMap: '{{repeat 4}}{"name":"分类{{inc}}","value":"{{int 15 60}}"}',
  wordCloud: '{{repeat 8}}{"name":"词{{inc}}","value":"{{int 10 100}}"}',
  waterPolo: '{"value":62}',

  // 数据卡
  stat: '{"value":"{{int 800 2000}}","label":"今日营收","trend":"{{int -20 20}}"}',
  number: '{"value":"{{int 5000 9999}}"}',
  table: '{{repeat 6}}{"月份":"{{date 2024-01-01 2024-06-30}}","销售额":"{{int 1000 3000}}","订单数":"{{int 20 80}}","同比":"{{int 1 20}}%"}',
  scrollTable: '{{repeat 6}}{"月份":"{{date 2024-01-01 2024-06-30}}","销售额":"{{int 1000 3000}}","订单数":"{{int 20 80}}"}',
  list: '{{repeat 5}}{"name":"项目{{inc}}","value":"{{int 100 600}}","trend":"{{int -10 10}}"}',
}

/** 返回该组件的默认 Mock 模板（已格式化；数据型组件），非数据型返回空串 */
export function defaultMockTemplateFor(type: CardType): string {
  const template = TEMPLATES[type]
  return template ? formatMockTemplate(template) : ''
}
