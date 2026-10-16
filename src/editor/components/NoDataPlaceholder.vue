<script setup lang="ts">
/**
 * 未绑定数据源占位图（编辑态）
 * 数据型组件（stat/chart/table/list）未绑定数据源时显示，提示绑定。
 */

import SvgIcon from '../../components/common/SvgIcon.vue'
</script>

<template>
  <div class="no-data-placeholder" role="alert">
    <span class="no-data-placeholder__icon"><SvgIcon name="wallet" :px="26" /></span>
    <p class="no-data-placeholder__title">未绑定数据源</p>
    <span class="no-data-placeholder__hint">点击卡片，在右侧「数据绑定」中选择数据源</span>
  </div>
</template>

<style scoped>
.no-data-placeholder {
  height: 100%;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 12px;
  border: 1.5px dashed var(--m-color-border);
  border-radius: var(--m-radius-md);
  background: color-mix(in srgb, var(--m-color-fill-light) 55%, transparent);
  text-align: center;
}

.no-data-placeholder__icon {
  color: var(--m-color-text-muted);
  opacity: 0.7;
}

.no-data-placeholder__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text-muted);
  margin: 0;
}

.no-data-placeholder__hint {
  font-size: 11px;
  color: var(--m-color-text-muted);
  opacity: 0.75;
}
</style>
