import { describe, expect, it } from 'vitest'
import { normalizeTableColumns } from '../table-columns'

describe('normalizeTableColumns（表格列规格化）', () => {
  const rows = [{ city: '北京', sales: 100, qty: 2 }]

  it('装配写入的字段名数组 → 列对象（key/title 同名）', () => {
    expect(normalizeTableColumns(['city', 'sales'], rows)).toEqual([
      { key: 'city', title: 'city' },
      { key: 'sales', title: 'sales' },
    ])
  })

  it('手工对象列原样保留（title / width / render 等）', () => {
    const cols = [{ key: 'sales', title: '销售额', width: 120, render: 'currency' as const }]
    expect(normalizeTableColumns(cols, rows)).toEqual(cols)
  })

  it('混合形态逐列处理', () => {
    expect(normalizeTableColumns(['city', { key: 'sales', title: '销售额' }], rows)).toEqual([
      { key: 'city', title: 'city' },
      { key: 'sales', title: '销售额' },
    ])
  })

  it('未配置列时回退数据首行全部字段', () => {
    expect(normalizeTableColumns([], rows)).toEqual([
      { key: 'city', title: 'city' },
      { key: 'sales', title: 'sales' },
      { key: 'qty', title: 'qty' },
    ])
    expect(normalizeTableColumns(undefined, rows)).toHaveLength(3)
  })

  it('无配置且无数据 → 空列', () => {
    expect(normalizeTableColumns(undefined, [])).toEqual([])
  })
})
