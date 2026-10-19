import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import EditorLeftPanel from '../components/EditorLeftPanel.vue'
import { registerBuiltinCards } from '../../components/cards'

describe('EditorLeftPanel tabs', () => {
  beforeAll(() => {
    setActivePinia(createPinia())
    registerBuiltinCards()
  })

  it('switches panels when a tab is clicked', async () => {
    const wrapper = mount(EditorLeftPanel, {
      global: { plugins: [createPinia()] },
    })

    const visible = (sel: string) =>
      (wrapper.find(sel).element as HTMLElement).style.display !== 'none'

    expect(wrapper.find('.component-library').exists()).toBe(true)
    expect(visible('.component-library')).toBe(true)

    const tabs = wrapper.findAll('.panel-tabs__item')
    expect(tabs.length).toBe(3)

    await tabs[1].trigger('click')
    await nextTick()
    expect(visible('.component-library')).toBe(false)
    expect(visible('.datasource-panel')).toBe(true)

    await wrapper.findAll('.panel-tabs__item')[2].trigger('click')
    await nextTick()
    expect(visible('.outline-panel')).toBe(true)
  })
})
