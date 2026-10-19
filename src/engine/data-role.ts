/**
 * 数据角色契约。
 *
 * 注册表用它描述卡片可从绑定数据源中选择的字段语义；它只提供元数据，
 * 不改变既有 editorSchema、数据绑定或运行时渲染行为。
 */

/** 数据源字段可推断出的基础类型。 */
export type DataFieldType = 'string' | 'number' | 'boolean' | 'date' | 'unknown'

/** 单个数据字段在卡片中的语义及约束。 */
export interface DataRole {
  /** 稳定的机器可读角色名，例如 category、metric、series。 */
  name: string
  /** 面向编辑器的角色名称。 */
  label: string
  /** 对应卡片配置内的字段路径；没有固定配置路径时省略。 */
  field?: string
  /** 可接受的数据源字段类型。 */
  acceptedTypes: readonly DataFieldType[]
  /** 未提供时默认为 false。 */
  required?: boolean
  /** 该角色是否可同时绑定多个字段；未提供时默认为 false。 */
  multiple?: boolean
}

/** 卡片的数据字段角色集合。 */
export interface DataRoleContract {
  roles: DataRole[]
}
