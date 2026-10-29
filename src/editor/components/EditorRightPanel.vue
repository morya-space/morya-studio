<script setup lang="ts">
/**
 * 编辑器右侧配置面板（对齐 go-view ContentConfigurations）
 * - 未选中：画布 / 页面 配置
 * - 选中：属性 / 布局 / 样式 / 动画 / 数据 / 事件
 * - 多选：批量操作面板
 */

import { computed, ref, watch } from 'vue'
import { MButton, MScrollbar, useConfirm } from 'morya-ui'
import { useEditorStore } from '../store'
import { getCardRegistration } from '../../engine/registry'
import { cardUsesData } from '../../engine/utils'
import SvgIcon from '../../components/common/SvgIcon.vue'
import PanelTabs from './PanelTabs.vue'
import CanvasPanel from '../panels/CanvasPanel.vue'
import PageSettings from '../panels/PageSettings.vue'
import PropertiesPanel from '../panels/PropertiesPanel.vue'
import AppearancePanel from '../panels/AppearancePanel.vue'
import EventPanel from '../panels/EventPanel.vue'

const store = useEditorStore()

const card = computed(() => store.selectedCard)
const hasSelection = computed(() => store.selectionCount === 1)
const isMulti = computed(() => store.selectionCount > 1)

type TabKey = 'canvas' | 'page' | 'content' | 'appearance' | 'data' | 'event'

const PAGE_TABS: { label: string; value: TabKey }[] = [
  { label: '画布', value: 'canvas' },
  { label: '页面', value: 'page' },
]
const CARD_TABS: { label: string; value: TabKey }[] = [
  { label: '内容', value: 'content' },
  { label: '外观', value: 'appearance' },
  { label: '事件', value: 'event' },
]

const tab = ref<string>('canvas')

const tabs = computed(() => {
  if (!hasSelection.value) return PAGE_TABS
  return card.value && cardUsesData(card.value)
    ? [CARD_TABS[0], CARD_TABS[1], { label: '数据', value: 'data' as const }, CARD_TABS[2]]
    : CARD_TABS
})

const confirm = useConfirm()

async function confirmRemoveSelection() {
  const ok = await confirm.require({
    header: '删除所选组件？',
    message: `将删除当前选中的 ${store.selectionCount} 个组件。`,
    acceptLabel: '删除',
    rejectLabel: '取消',
    acceptColor: 'danger',
  })
  if (ok) store.removeSelection()
}

// 选中态变化时，把 tab 归位到可用集合
watch(tabs, list => {
  if (!list.some(t => t.value === tab.value)) tab.value = list[0].value
}, { immediate: true })

const title = computed(() => {
  if (isMulti.value) return `已选中 ${store.selectionCount} 个组件`
  if (!card.value) return tab.value === 'page' ? '页面设置' : '画布设置'
  return card.value.title || getCardRegistration(card.value.type)?.label || card.value.type
})

const sub = computed(() => {
  if (isMulti.value) return '可拖动、成组、锁定或删除'
  if (!card.value) return tab.value === 'page' ? '页面信息、布局与筛选器' : '尺寸、背景与编辑辅助'
  const reg = getCardRegistration(card.value.type)
  if (store.page.layout === 'free') {
    return `${reg?.label ?? card.value.type} · ${card.value.w ?? 0} × ${card.value.h ?? 0}`
  }
  return `${reg?.label ?? card.value.type} · 跨 ${card.value.span ?? 6} 列`
})
</script>

<template>
  <aside class="editor-right">
    <div class="rp-head">
      <div>
        <h3 class="rp-title">{{ title }}</h3>
        <p class="rp-sub">{{ sub }}</p>
      </div>
    </div>

    <!-- 多选批量操作 -->
    <div v-if="isMulti" class="rp-multi">
      <div class="op-row">
        <MButton type="default" size="small" block @click="store.groupSelection()">
          <SvgIcon name="layers" :px="12" /> 成组
        </MButton>
        <MButton type="default" size="small" block @click="store.ungroupSelection()">解组</MButton>
      </div>
      <div class="op-row">
        <MButton type="default" size="small" block @click="store.toggleSelectionLock()">
          <SvgIcon name="lock" :px="12" /> 锁定/解锁
        </MButton>
        <MButton type="default" size="small" block @click="store.toggleSelectionHide()">隐藏/显示</MButton>
      </div>
      <MButton danger size="small" block @click="confirmRemoveSelection">
        <SvgIcon name="x" :px="12" /> 删除所选
      </MButton>
    </div>

    <template v-else>
      <div class="rp-tabs">
        <PanelTabs v-model="tab" :options="tabs" panel-id-prefix="editor-right" />
      </div>
      <div
        :id="`editor-right-panel-${tab}`"
        class="panel-region"
        role="tabpanel"
        :aria-labelledby="`editor-right-${tab}`"
      >
        <MScrollbar class="panel-body" view-class="panel-body__view" aria-label="配置内容">
          <CanvasPanel v-if="tab === 'canvas'" />
          <PageSettings v-else-if="tab === 'page'" />
          <PropertiesPanel v-else-if="tab === 'content'" />
          <AppearancePanel v-else-if="tab === 'appearance'" />
          <PropertiesPanel v-else-if="tab === 'data'" mode="data" />
          <EventPanel v-else-if="tab === 'event'" />
        </MScrollbar>
      </div>
    </template>
  </aside>
</template>

<style scoped lang="scss">
.editor-right {
  width: 300px;
  flex-shrink: 0;
  background: var(--m-color-surface);
  border-left: 1px solid var(--m-color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rp-head {
  flex: none;
  padding: 14px 16px;
  border-bottom: 1px solid var(--m-color-border);
}

.rp-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-sub {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 3px 0 0;
}

.rp-tabs {
  flex: none;
  padding: 8px 12px;
  border-bottom: 1px solid var(--m-color-split);
}

.rp-multi {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.op-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  :deep(.m-button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
}

.panel-region,
.panel-body {
  flex: 1;
  min-height: 0;
}

.panel-body {

  :deep(.panel-body__view) {
    padding: 12px 16px 24px;
  }
}

:deep(.field-2),
:deep(.field-3) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--m-space-3, 12px);
}
</style>
