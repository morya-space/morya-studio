<script setup lang="ts">
import {
  MLayout,
  MLayoutContent,
  MLayoutHeader,
  MLayoutSider,
  MMenu,
} from 'morya-ui'
import { ref } from 'vue'

const collapsed = ref(false)
const selectedKey = ref('dashboard')
const model = [
  { key: 'workbanch', label: '工作台', icon: 'layout-dashboard' },
  { key: 'dashboard', label: '仪表盘', icon: 'layout-dashboard' },
  { key: 'dataset', label: '数据集', icon: 'info' },
  { key: 'users', label: '用户管理', icon: 'user' },
  { key: 'settings', label: '设置', icon: 'info' },
]
</script>

<template>
  <MLayout class="w-full h-full">
    <MLayoutHeader>
      <strong style="color: var(--m-color-primary); font-size: var(--m-font-size-md)">头部菜单</strong>
    </MLayoutHeader>
    <MLayout has-sider>
      <MLayoutSider
        v-model:collapsed="collapsed" bordered show-trigger="bar" collapse-mode="width"
        :collapsed-width="80"
        content-class="px-1! py-2!"
      >
        <MMenu v-model:selected-key="selectedKey" :model="model" :collapsed="collapsed" :collapsed-width="64" />
      </MLayoutSider>
      <MLayoutContent embedded content-style="padding: var(--m-space-4)">
        <p style="margin: 0; color: var(--m-color-text-muted); font-size: var(--m-font-size-sm)">
          当前选中：<strong style="color: var(--m-color-text)">{{ selectedKey }}</strong>
        </p>
      </MLayoutContent>
    </MLayout>
  </MLayout>
</template>