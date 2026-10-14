<script setup lang="ts">
/**
 * 编辑器左侧面板
 * Tab 切换：组件库 / 数据源 / 大纲
 */

import { ref } from 'vue'
import { MScrollbar } from 'morya-ui'
import ComponentLibrary from '../panels/ComponentLibrary.vue'
import DataSourcePanel from '../panels/DataSourcePanel.vue'
import OutlinePanel from '../panels/OutlinePanel.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'

type TabKey = 'components' | 'datasource' | 'outline'

const activeTab = ref<TabKey>('components')

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'components', label: '组件', icon: 'grid' },
  { key: 'datasource', label: '数据源', icon: 'wallet' },
  { key: 'outline', label: '大纲', icon: 'file' },
]
</script>

<template>
  <aside class="editor-left">
    <div class="panel-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="panel-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <SvgIcon :name="tab.icon" :px="16" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <MScrollbar class="panel-body" view-class="panel-body__view">
      <ComponentLibrary v-show="activeTab === 'components'" />
      <DataSourcePanel v-show="activeTab === 'datasource'" />
      <OutlinePanel v-show="activeTab === 'outline'" />
    </MScrollbar>
  </aside>
</template>

<style scoped>
.editor-left {
  width: 264px;
  flex-shrink: 0;
  background: var(--m-color-surface);
  border-right: 1px solid var(--m-color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--m-color-border);
  flex-shrink: 0;
}

.panel-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--m-color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.panel-tab:hover {
  color: var(--m-color-text);
}

.panel-tab.active {
  color: var(--m-color-primary);
  border-bottom-color: var(--m-color-primary);
}

.panel-body {
  flex: 1;
  min-height: 0;
}

.panel-body__view {
  padding: 16px;
}
</style>
