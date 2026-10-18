/**
 * 卡片注册表（v0.2）
 * CardType → 组件 + 编辑器表单 Schema + 默认配置。
 * 开放扩展：业务方/插件可用 registerCard 注册自定义卡片。
 * 契约见 docs/DESIGN-DEV.md §7.3。
 */

import type { Component } from 'vue'
import type { CardSchema, CardType } from '../types/schema'

/** 编辑器属性面板的表单字段 Schema（自动生成表单） */
export interface EditorFieldSchema {
  /** lodash 路径，如 'chart.chartType' */
  field: string
  label: string
  component: 'MInput' | 'MSelect' | 'MSwitch' | 'MInputNumber' | 'MTextarea' | 'MTableColumns'
  /** 静态选项，或 'auto:*' 表示从绑定数据源当前数据推断字段 */
  options?:
    | { label: string; value: unknown }[]
    | 'auto:dataFields'
    | 'auto:dimensionFields'
    | 'auto:metricFields'
  /** 透传给控件的 props */
  props?: Record<string, unknown>
  /** 帮助文案 */
  help?: string
}

export interface CardRegistration {
  type: CardType
  component: Component
  /** 编辑器右侧属性面板的表单 Schema */
  editorSchema?: EditorFieldSchema[]
  /** 新建卡片时的默认配置（编辑器 addCard 用） */
  defaultConfig: () => Partial<CardSchema>
  /** 组件库展示名 */
  label?: string
  /** 组件库展示图标（SvgIcon name） */
  icon?: string
  /** 组件库展示描述 */
  description?: string
  /** 组件库分组：图表 / 基础 / 布局 */
  category?: 'chart' | 'basic' | 'layout'
}

const registry = new Map<CardType, CardRegistration>()

export function registerCard(reg: CardRegistration): void {
  registry.set(reg.type, reg)
}

export function getCardRegistration(type: CardType): CardRegistration | undefined {
  return registry.get(type)
}

export function getCardComponent(type: CardType): Component | undefined {
  return registry.get(type)?.component
}

export function getAllCardTypes(): CardType[] {
  return [...registry.keys()]
}

export function getAllRegistrations(): CardRegistration[] {
  return [...registry.values()]
}

export function hasCard(type: CardType): boolean {
  return registry.has(type)
}
