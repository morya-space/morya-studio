import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import PanelListView from '../PanelListView.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  initPages: vi.fn(),
  listPages: vi.fn(),
  deletePage: vi.fn(),
  importPage: vi.fn(),
  listVersions: vi.fn(),
  restoreVersion: vi.fn(),
  initTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  pageToTemplate: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.routerPush }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../../services/page', () => ({
  initPages: mocks.initPages,
  listPages: mocks.listPages,
  deletePage: mocks.deletePage,
  exportPage: vi.fn(),
  importPage: mocks.importPage,
  genPageId: () => 'new-panel',
  listVersions: mocks.listVersions,
  restoreVersion: mocks.restoreVersion,
}))
vi.mock('../../../services/template', () => ({
  initTemplates: mocks.initTemplates,
  saveTemplate: mocks.saveTemplate,
  pageToTemplate: mocks.pageToTemplate,
}))

vi.mock('morya-ui', () => {
  const pass = (name: string) => defineComponent({ name, props: ['title', 'description'], template: '<div><slot /><slot name="extra" /><slot name="footer" /><slot name="trigger" /></div>' })
  const button = defineComponent({ name: 'MButton', emits: ['click'], template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' })
  const dropdown = defineComponent({ name: 'MDropdown', emits: ['select'], template: '<div><slot name="trigger" /></div>' })
  const confirmDialog = defineComponent({ name: 'MConfirmDialog', props: ['beforeAccept'], emits: ['accept', 'update:modelValue'], template: '<div><slot /></div>' })
  return {
    MButton: button,
    MCard: pass('MCard'),
    MConfirmDialog: confirmDialog,
    MDialog: pass('MDialog'),
    MDropdown: dropdown,
    MEmpty: pass('MEmpty'),
    MInput: pass('MInput'),
    MSkeleton: pass('MSkeleton'),
    message: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
})

vi.mock('../../../components/shell/WorkspacePage.vue', () => ({ default: defineComponent({ template: '<main><slot /></main>' }) }))
vi.mock('../../../components/common/SvgIcon.vue', () => ({ default: defineComponent({ template: '<span />' }) }))

const page = { id: 'panel-1', title: '销售看板', layout: 'grid' as const, grid: { cols: 12 }, cards: [] }

function mountView() {
  return mount(PanelListView)
}

describe('PanelListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.initPages.mockResolvedValue(undefined)
    mocks.initTemplates.mockResolvedValue(undefined)
    mocks.listPages.mockReturnValue([page])
    mocks.deletePage.mockResolvedValue(undefined)
    mocks.importPage.mockResolvedValue(page)
    mocks.listVersions.mockResolvedValue([])
    mocks.restoreVersion.mockResolvedValue(page)
  })

  it('shows a retry state when initial loading fails', async () => {
    mocks.initPages.mockRejectedValueOnce(new Error('网络不可用'))
    const wrapper = mountView()
    await flushPromises()

    const errorState = wrapper.findComponent({ name: 'MEmpty' })
    expect(errorState.props('title')).toBe('面板加载失败')
    expect(errorState.props('description')).toBe('网络不可用')

    const retry = wrapper.findAll('button').find(button => button.text() === '重试')
    await retry!.trigger('click')
    await flushPromises()
    expect(mocks.initPages).toHaveBeenLastCalledWith(true)
  })

  it('opens the editor from the card with Enter and Space', async () => {
    const wrapper = mountView()
    await flushPromises()
    const card = wrapper.get('.panel-card__body')

    await card.trigger('keydown', { key: 'Enter' })
    await card.trigger('keydown', { key: ' ' })

    expect(mocks.routerPush).toHaveBeenCalledTimes(2)
    expect(mocks.routerPush).toHaveBeenLastCalledWith('/editor/panel-1')
  })

  it('only deletes after the confirmation accepts', async () => {
    const wrapper = mountView()
    await flushPromises()

    const dropdown = wrapper.findComponent({ name: 'MDropdown' })
    await dropdown.vm.$emit('select', { value: 'delete' })
    expect(mocks.deletePage).not.toHaveBeenCalled()

    const confirmation = wrapper.findComponent({ name: 'MConfirmDialog' })
    await confirmation.props('beforeAccept')()
    await flushPromises()

    expect(mocks.deletePage).toHaveBeenCalledWith('panel-1')
  })

  it('surfaces a version history failure and retries it', async () => {
    mocks.listVersions.mockRejectedValueOnce(new Error('版本服务不可用'))
    const wrapper = mountView()
    await flushPromises()

    const dropdown = wrapper.findComponent({ name: 'MDropdown' })
    await dropdown.vm.$emit('select', { value: 'history' })
    await flushPromises()
    const errorStates = wrapper.findAllComponents({ name: 'MEmpty' })
    expect(errorStates.at(-1)?.props('title')).toBe('版本历史加载失败')
    expect(errorStates.at(-1)?.props('description')).toBe('版本服务不可用')

    const retry = wrapper.findAll('button').find(button => button.text() === '重试')
    await retry!.trigger('click')
    await flushPromises()
    expect(mocks.listVersions).toHaveBeenCalledTimes(2)
  })
})
