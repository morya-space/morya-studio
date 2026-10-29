<script setup lang="ts">
/**
 * 属性面板（内容 / 定制）
 * 标题 + 注册表 editorSchema 自动生成表单。
 */

import { computed, ref } from 'vue'
import { MDialog, MForm, MFormItem, MInput, message } from 'morya-ui'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { getByPath } from '../../data/adapters/base'
import { getCardRegistration, type EditorFieldSchema } from '../../engine/registry'
import { cardUsesData } from '../../engine/utils'
import FieldRenderer from '../components/FieldRenderer.vue'
import DataConfigCard from './DataConfigCard.vue'
import DataPanel from './DataPanel.vue'
import { plain } from '../plain'
import type { DataConfigDraft } from './dataDraft'

const props = withDefaults(defineProps<{
  mode?: 'content' | 'data'
}>(), {
  mode: 'content',
})

const store = useEditorStore()
const dataStore = useDataStore()

const card = computed(() => store.selectedCard)
const registration = computed(() => (card.value ? getCardRegistration(card.value.type) : undefined))
const editorSchema = computed<EditorFieldSchema[]>(() => registration.value?.editorSchema ?? [])
/** 「内容」页展示的字段：标题单独渲染；数据字段绑定（auto:dataFields）归数据配置弹窗管理 */
const contentFields = computed(() =>
  editorSchema.value.filter(field => field.field !== 'title' && field.options !== 'auto:dataFields'),
)
const supportsDataConfig = computed(() => Boolean(card.value && (
  cardUsesData(card.value) || (registration.value?.dataContract?.roles.length ?? 0) > 0
)))

function fieldValue(field: EditorFieldSchema): unknown {
  if (!card.value) return undefined
  return getByPath(card.value, field.field)
}

function onFieldChange(field: EditorFieldSchema, value: unknown) {
  if (!card.value) return
  store.updateCardField(card.value.id, field.field, value)
}

// 数据配置弹窗（草稿模式：编辑只写草稿，点「完成」才提交生效）
const dataDialogFullscreen = ref(true)
const dataDialog = ref(false)
const draft = ref<DataConfigDraft | null>(null)
const dataPanelRef = ref<{ validate: () => string | null } | null>(null)

function openDataDialog() {
  const c = card.value
  if (!c) return
  draft.value = {
    dataSource: c.dataSource ? plain(c.dataSource) : undefined,
    dataSourceId: c.dataSourceId,
    bindings: {},
    computedFields: c.computedFields ? plain(c.computedFields) : [],
    transform: c.transform ? plain(c.transform) : [],
  }
  dataDialog.value = true
}

/**
 * 「完成」提交（预设页脚 onPositiveClick：返回 false 拦截关闭）。
 * 完成门槛：来源配置不完整时阻断提交并留在弹窗（绑定类问题由面板内健康条提示，不阻断）。
 */
function commitDataDialog(): false | void {
  const c = card.value
  const d = draft.value
  if (!c || !d) return
  const error = dataPanelRef.value?.validate() ?? null
  if (error) {
    message.error(error)
    return false
  }
  store.updateCardFields(c.id, {
    dataSource: d.dataSource,
    dataSourceId: d.dataSourceId,
    computedFields: d.computedFields?.length ? d.computedFields : undefined,
    transform: d.transform?.length ? d.transform : undefined,
    ...d.bindings,
  })
  // 提交后刷新卡片数据，画布即时生效
  const committed = store.selectedCard
  if (committed) void dataStore.refreshCard(committed)
  message.success('数据配置已生效')
}

/**
 * 弹窗关闭动画结束后丢弃草稿（取消 / Esc / 提交成功均经此路径）。
 * 故意在 hide 而非 modelValue 置 false 时清理：关闭动画期间 DataPanel 保持渲染，内容不闪空。
 */
function onDataDialogHide(): void {
  draft.value = null
}
</script>

<template>
  <div v-if="card" class="pp">
    <template v-if="mode === 'data' && supportsDataConfig">
      <p class="section-title">数据</p>
      <p class="pp__hint">配置数据源、转换规则和字段映射。</p>
      <DataConfigCard @edit="openDataDialog" />
    </template>

    <template v-else-if="mode === 'content'">
      <p class="pp__section">内容</p>
      <MForm>
        <MFormItem label="标题">
          <MInput
            :model-value="card.title ?? ''"
            placeholder="组件标题"
            fluid
            @update:model-value="store.updateCardField(card.id, 'title', $event || undefined)"
          />
        </MFormItem>
        <MFormItem
          v-for="field in contentFields"
          :key="field.field"
          :label="field.label"
          :help="field.help"
        >
          <FieldRenderer
            :field="field"
            :model-value="fieldValue(field)"
            @update:model-value="onFieldChange(field, $event)"
          />
        </MFormItem>
      </MForm>
      <p v-if="!editorSchema.length" class="pp__empty">该组件无可配置内容</p>
    </template>

    <MDialog
      v-model="dataDialog"
      class="data-dialog"
      maximizable
      v-model:fullscreen="dataDialogFullscreen"
      title="数据配置"
      width="min(96vw, 100rem)"
      negative-text="取消"
      positive-text="完成"
      :on-positive-click="commitDataDialog"
      @hide="onDataDialogHide"
    >
      <DataPanel v-if="draft" ref="dataPanelRef" :draft="draft" />
    </MDialog>
  </div>
</template>

<style lang="scss" scoped>
.pp {
  display: flex;
  flex-direction: column;

  &__hint {
    margin: -0.125rem 0 0.75rem;
    line-height: 1.5;
  }

  &__section {
    margin: 1rem 0 0.625rem;
  }

  &__empty {
    padding: 1.25rem 0;
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text-muted);
  }
}
</style>

<!--
  非 scoped：MDialog Teleport 到 body，scoped 选择器无法命中面板内部。
  class="data-dialog" 落在遮罩层（文档约定的 attrs 行为），宽度由 width prop 管理；
  这里只负责高度与内容区布局。
-->
<style lang="scss">
.data-dialog {

  .m-dialog {
    --m-dialog-max-height: 92vh;
    /* 固定高度（非仅上限）：内容区由此获得确定高度，左右列才能各自内部滚动 */
    height: min(92vh, 100%);
  }

  /* 最大化时恢复全屏（覆盖上面的 92vh） */
  .m-dialog--maximized {
    height: 100%;
  }

  /* 内容区不再整体滚动：作为 flex 容器把确定高度传递给 DataPanel，滚动由各列 MScrollbar 承担 */
  .m-dialog__body {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}
</style>
