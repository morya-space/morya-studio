<script setup lang="ts">
import LayoutPanel from './LayoutPanel.vue'
import StylePanel from './StylePanel.vue'
import AnimationPanel from './AnimationPanel.vue'
</script>

<template>
  <div class="appearance-panel">
    <section class="appearance-panel__section">
      <header class="appearance-panel__head">
        <h4>布局与层级</h4>
        <p>调整尺寸、位置、显示状态与叠放顺序。</p>
      </header>
      <LayoutPanel />
    </section>
    <section class="appearance-panel__section">
      <header class="appearance-panel__head">
        <h4>视觉样式</h4>
        <p>调整变换、图像效果与内容裁剪。</p>
      </header>
      <StylePanel />
    </section>
    <section class="appearance-panel__section">
      <header class="appearance-panel__head">
        <h4>动效</h4>
        <p>设置组件在预览中的入场方式。</p>
      </header>
      <AnimationPanel />
    </section>
  </div>
</template>

<style scoped>
.appearance-panel { display: flex; flex-direction: column; gap: var(--m-space-5, 20px); }
.appearance-panel__section { display: flex; flex-direction: column; gap: var(--m-space-3, 12px); }
.appearance-panel__head { padding-bottom: var(--m-space-2, 8px); border-bottom: 1px solid var(--m-color-split); }
.appearance-panel__head h4, .appearance-panel__head p { margin: 0; }
.appearance-panel__head h4 { color: var(--m-color-text); font-size: 13px; font-weight: 600; }
.appearance-panel__head p { margin-top: 3px; color: var(--m-color-text-muted); font-size: 12px; line-height: 1.45; }
</style>
