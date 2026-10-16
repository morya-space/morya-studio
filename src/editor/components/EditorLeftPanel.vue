<script setup lang="ts">
/**
 * 编辑器左侧面板
 * Tab 切换：组件库 / 数据源 / 图层（MSegmented 分段控制器）
 */

import { ref } from 'vue'
import { MSegmented, MScrollbar } from 'morya-ui'
import ComponentLibrary from '../panels/ComponentLibrary.vue'
import DataSourcePanel from '../panels/DataSourcePanel.vue'
import OutlinePanel from '../panels/OutlinePanel.vue'

type TabKey = 'components' | 'datasource' | 'outline'

const activeTab = ref<TabKey>('components')

const tabs: { label: string; value: TabKey }[] = [
  { label: '组件', value: 'components' },
  { label: '数据源', value: 'datasource' },
  { label: '图层', value: 'outline' },
]
</script>

<template>
  <aside class="editor-left">
    <div class="panel-tabs">
      <MSegmented v-model="activeTab" :options="tabs" block />
    </div>

    <MScrollbar class="panel-body" view-class="panel-body__view">
      <ComponentLibrary v-show="activeTab === 'components'" />
      <DataSourcePanel v-show="activeTab === 'datasource'" />
      <OutlinePanel v-show="activeTab === 'outline'" />
    </MScrollbar>
  </aside>
</template>

<style scoped lang="scss">
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
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--m-color-border);
}

.panel-body {
  flex: 1;
  min-height: 0;

  :deep(.panel-body__view) {
    padding: 16px 14px 24px;
  }
}
</style>
