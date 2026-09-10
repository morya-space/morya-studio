# Morya 设计系统（AI 第一信源）

> 基于 `morya-ui`。生成或审查业务页面时，**必须先遵守本文**，再查阅 `docs/components.md`。

## 1. 设计原则

1. **组件优先**：布局、表单、表格、浮层一律使用库内 `M*` 组件，不手写等价 DOM 结构。
2. **令牌优先**：颜色、间距、圆角、阴影、动效使用 `--m-*` CSS 变量；禁止裸 `#hex` / `rgb()`（`scripts/check-raw-colors.mjs` 会扫描）。
3. **语义一致**：主操作 `MButton` `severity="primary"`；危险操作用 `severity="danger"` 或 `MConfirmDialog`。
4. **可访问性**：表单控件带 `label`；图标按钮带 `aria-label`；浮层可 Esc 关闭（组件默认支持）。
5. **ConfigProvider 包裹**：应用根节点使用 `MConfigProvider`，统一 locale、主题、密度、浮层挂载。

## 2. 应用骨架

```vue
<script setup lang="ts">
import { MConfigProvider, zhCN } from 'morya-ui'
</script>

<template>
  <MConfigProvider :locale="zhCN">
    <RouterView />
  </MConfigProvider>
</template>
```

当前仓库为空白占位，后续按产品需求扩展页面结构与路由。

## 3. 表单约定

- 使用 `MForm` + `MFormItem`，`name` 与校验规则对应。
- 字段组件自带 `label` / `invalid` / `helpText` 时优先用组件 prop。

## 4. 更多参考

- 组件选型索引：`docs/components.md`
- 组件库文档：morya-ui 文档站
