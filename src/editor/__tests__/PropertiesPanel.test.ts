import { beforeEach, describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import PropertiesPanel from '../panels/PropertiesPanel.vue'
import { useDataStore } from '../../data/store'
import { useEditorStore } from '../store'
import { registerBuiltinCards } from '../../components/cards'

const FieldRendererStub = {
  name: 'FieldRenderer',
  props: ['field', 'modelValue', 'dataFieldOptions', 'dataFieldHint'],
  template: '<div class="field-renderer-stub" />',
}

describe('PropertiesPanel data field integration', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    registerBuiltinCards()
  })

  function mountStatPanel(rows: Record<string, unknown>[], selectedField = 'sales', mode: 'content' | 'data' = 'content') {
    const editorStore = useEditorStore()
    editorStore.newPage('test')
    const cardId = editorStore.addCard('stat')
    editorStore.updateCardField(cardId, 'stat.valueField', selectedField)
    useDataStore().cardData.set(cardId, rows)

    return shallowMount(PropertiesPanel, {
      props: { mode },
      global: {
        plugins: [pinia],
        stubs: {
          Form: { template: '<form><slot /></form>' },
          FormItem: { template: '<div><slot /></div>' },
          FieldRenderer: FieldRendererStub,
        },
      },
    })
  }

  it('keeps data field mappings out of the content panel', () => {
    const wrapper = mountStatPanel([{ name: 'North', sales: 42 }])
    const valueRenderer = wrapper.findAllComponents(FieldRendererStub)
      .find(renderer => renderer.props('field').field === 'stat.valueField')

    expect(valueRenderer, wrapper.html()).toBeUndefined()
    expect(wrapper.text()).not.toContain('标题字段')
  })

  it('shows the data configuration entry only in data mode', () => {
    const wrapper = mountStatPanel([{ name: 'North', sales: 42 }], 'sales', 'data')

    expect(wrapper.text()).toContain('数据')
    expect(wrapper.text()).toContain('配置数据源、转换规则和字段映射。')
  })

  it('does not expose data configuration for display-only cards', () => {
    const editorStore = useEditorStore()
    editorStore.newPage('test')
    editorStore.addCard('text')

    const wrapper = shallowMount(PropertiesPanel, {
      props: { mode: 'data' },
      global: {
        plugins: [pinia],
        stubs: { Form: { template: '<form><slot /></form>' }, FormItem: { template: '<div><slot /></div>' } },
      },
    })

    expect(wrapper.find('.data-card').exists()).toBe(false)
  })
})
