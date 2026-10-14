<script setup lang="ts">
/**
 * 编辑器右侧属性面板
 */

import { MScrollbar } from 'morya-ui'
import PropertyForm from '../panels/PropertyForm.vue'
</script>

<template>
  <aside class="editor-right">
    <div class="panel-header">
      <h3 class="panel-title">属性配置</h3>
    </div>
    <MScrollbar class="panel-body" view-class="panel-body__view">
      <PropertyForm />
    </MScrollbar>
  </aside>
</template>

<style scoped>
.editor-right {
  width: 300px;
  flex-shrink: 0;
  background: var(--m-color-surface);
  border-left: 1px solid var(--m-color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 12px;
}

.panel-body {
  flex: 1;
  min-height: 0;
}

.panel-body__view {
  padding: 0 16px 16px;
}
</style>
