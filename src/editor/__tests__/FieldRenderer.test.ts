import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import FieldRenderer from '../components/FieldRenderer.vue'

function mountSelect(overrides: Record<string, unknown> = {}) {
  return shallowMount(FieldRenderer, {
    props: {
      field: { field: 'stat.valueField', label: '数值字段', component: 'MSelect', options: 'auto:dataFields' },
      modelValue: undefined,
      dataFieldOptions: [],
      ...overrides,
    },
  })
}

describe('FieldRenderer data field select', () => {
  it('passes profiled options to the select', () => {
    const wrapper = mountSelect({
      dataFieldOptions: [{ label: 'Sales（sales · number，样例：42）', value: 'sales' }],
    })

    expect(wrapper.getComponent({ name: 'Select' }).props('options')).toEqual([
      { label: 'Sales（sales · number，样例：42）', value: 'sales' },
    ])
  })

  it('shows the no-compatible-field hint and empty option content', () => {
    const wrapper = mountSelect({ dataFieldHint: '当前数据源没有适用于此角色的字段。' })

    expect(wrapper.text()).toContain('当前数据源没有适用于此角色的字段。')
    expect(wrapper.getComponent({ name: 'Select' }).props('notFoundContent')).toBe('当前数据源没有适用于此角色的字段。')
  })
})
