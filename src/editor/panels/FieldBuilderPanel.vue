<script setup lang="ts">
/**
 * 组件数据入参装配面板（自助取数）
 *
 * 拖放区 = 当前组件需要的数据入参（dataContract 角色）：
 * - 图表：维度 / 数值 / 系列；指标卡：数值 / 标签 / 趋势；表格：表格列 …
 * - 把字段拖入某个入参即完成配置；数值类入参可选聚合方式（求和/计数…，默认原始值）
 * - 附加「过滤条件」区：字段 + 操作符 + 值
 * 装配结果由外层推导为 transform（聚合 → groupBy）与字段绑定。
 * 高级用户可切「表达式」模式直接编辑 transform JSON（保留存量）。
 */

import { computed, ref } from 'vue'
import { MButton, MEmpty, MInput, MSelect, MSegmented, MTag, message, MCard, MFlex } from 'morya-ui'
import type { FieldProfile, FieldValueKind } from '../../data/field-profile'
import type { DataRole } from '../../engine/data-role'
import {
  roleIsMetric,
  type AssignedField,
  type FilterCondition,
  type MetricAgg,
  type RoleAssignment,
} from '../../engine/data-binding'
import type { TransformStep } from '../../types/schema'
import SvgIcon from '../../components/common/SvgIcon.vue'

const AGG_OPTIONS: { label: string; value: MetricAgg | 'none' }[] = [
  { label: '原始值', value: 'none' },
  { label: '求和', value: 'sum' },
  { label: '平均', value: 'avg' },
  { label: '计数', value: 'count' },
  { label: '最大', value: 'max' },
  { label: '最小', value: 'min' },
]

const FILTER_OPS = [
  { label: '=', value: '==' },
  { label: '≠', value: '!=' },
  { label: '>', value: '>' },
  { label: '≥', value: '>=' },
  { label: '<', value: '<' },
  { label: '≤', value: '<=' },
  { label: '包含', value: 'contains' },
]

const props = defineProps<{
  profiles: readonly FieldProfile[]
  /** 组件的数据入参（dataContract 角色，含字段路径） */
  roles: readonly (DataRole & { field: string })[]
  assignments: RoleAssignment[]
  filters: FilterCondition[]
  /** 当前 transform（表达式模式展示 / 编辑） */
  transform: TransformStep[]
}>()

const emit = defineEmits<{
  (e: 'update:assignments', v: RoleAssignment[]): void
  (e: 'update:filters', v: FilterCondition[]): void
  (e: 'update:transform', v: TransformStep[]): void
}>()

// ==================== 模式（可视化 / 表达式） ====================

const mode = ref<'visual' | 'expr'>('visual')
const MODE_OPTIONS = [
  { label: '可视化', value: 'visual' },
  { label: '表达式', value: 'expr' },
]

const exprText = computed({
  get: () => JSON.stringify(props.transform, null, 2),
  set: (v: string) => {
    try {
      const parsed = JSON.parse(v || '[]')
      if (Array.isArray(parsed)) emit('update:transform', parsed as TransformStep[])
    } catch { /* 编辑中非法 JSON 忽略 */ }
  },
})

// ==================== 字段列表 ====================

const keyword = ref('')
const filteredProfiles = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.profiles
  return props.profiles.filter(p => p.key.toLowerCase().includes(kw) || p.label.toLowerCase().includes(kw))
})

const labelMap = computed(() => new Map(props.profiles.map(p => [p.key, p.label])))
function labelOf(key: string): string {
  return labelMap.value.get(key) ?? key
}

const profileKeys = computed(() => new Set(props.profiles.map(p => p.key)))
/** 已绑字段在当前数据中不存在（仅在有数据时判定，避免未取数时误标） */
function isMissing(key: string): boolean {
  return props.profiles.length > 0 && !profileKeys.value.has(key)
}

function kindIcon(kind: FieldValueKind): string {
  switch (kind) {
    case 'number': return 'bar-chart'
    case 'date': return 'doc'
    case 'boolean': return 'sliders'
    default: return 'database'
  }
}

// ==================== 装配读写 ====================

function fieldsOf(role: DataRole & { field: string }): AssignedField[] {
  return props.assignments.find(a => a.path === role.field)?.fields ?? []
}

function setFields(role: DataRole & { field: string }, fields: AssignedField[]): void {
  const next = props.assignments.filter(a => a.path !== role.field)
  next.push({ path: role.field, multiple: Boolean(role.multiple), fields })
  emit('update:assignments', next)
}

function typeCompatible(role: DataRole, p: FieldProfile): boolean {
  return role.acceptedTypes.includes(p.valueKind)
}

function defaultAgg(role: DataRole, p: FieldProfile): MetricAgg | 'none' {
  if (!roleIsMetric(role)) return 'none'
  return p.valueKind === 'number' ? 'sum' : 'count'
}

function addToRole(role: DataRole & { field: string }, p: FieldProfile): boolean {
  if (!typeCompatible(role, p)) return false
  const current = fieldsOf(role)
  if (role.multiple) {
    if (current.some(f => f.field === p.key)) return true
    setFields(role, [...current, { field: p.key, agg: defaultAgg(role, p) }])
  } else {
    setFields(role, [{ field: p.key, agg: defaultAgg(role, p) }])
  }
  return true
}

function removeFromRole(role: DataRole & { field: string }, index: number): void {
  setFields(role, fieldsOf(role).filter((_, i) => i !== index))
}

function setAgg(role: DataRole & { field: string }, index: number, agg: MetricAgg | 'none'): void {
  setFields(role, fieldsOf(role).map((f, i) => (i === index ? { ...f, agg } : f)))
}

/** 点选「+」：优先填入第一个兼容且可放入的入参，否则加入过滤条件 */
function addFieldSmart(p: FieldProfile): void {
  const emptySingle = props.roles.find(r => !r.multiple && typeCompatible(r, p) && !fieldsOf(r).length)
  if (emptySingle && addToRole(emptySingle, p)) return
  const multi = props.roles.find(r => r.multiple && typeCompatible(r, p))
  if (multi && addToRole(multi, p)) return
  addFilter(p)
}

// ==================== 过滤条件 ====================

function addFilter(p: FieldProfile): void {
  if (props.filters.some(f => f.field === p.key)) return
  emit('update:filters', [...props.filters, { field: p.key, op: p.valueKind === 'number' ? '>' : '==', value: '' }])
}
function removeFilter(i: number): void {
  emit('update:filters', props.filters.filter((_, x) => x !== i))
}
function updateFilter(i: number, patch: Partial<FilterCondition>): void {
  emit('update:filters', props.filters.map((f, x) => (x === i ? { ...f, ...patch } : f)))
}

// ==================== 拖拽 ====================

type DropTarget = { kind: 'role'; role: DataRole & { field: string } } | { kind: 'filter' }
const dragField = ref<FieldProfile | null>(null)
const dropKey = ref<string | null>(null)

function targetKey(t: DropTarget): string {
  return t.kind === 'role' ? `role:${t.role.field}` : 'filter'
}

function onDragStart(p: FieldProfile, e: DragEvent): void {
  dragField.value = p
  e.dataTransfer?.setData('text/plain', p.key)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}
function onDragEnd(): void {
  dragField.value = null
  dropKey.value = null
}
function onDragOver(t: DropTarget, e: DragEvent): void {
  e.preventDefault()
  dropKey.value = targetKey(t)
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
function onDragLeave(t: DropTarget): void {
  if (dropKey.value === targetKey(t)) dropKey.value = null
}
function onDrop(t: DropTarget, e: DragEvent): void {
  e.preventDefault()
  const key = e.dataTransfer?.getData('text/plain') ?? dragField.value?.key
  const p = props.profiles.find(x => x.key === key) ?? dragField.value
  if (p) {
    if (t.kind === 'role') {
      if (!addToRole(t.role, p)) {
        message.warn(`「${p.label}」类型（${p.valueKind}）与「${t.role.label}」不匹配`)
      }
    } else {
      addFilter(p)
    }
  }
  onDragEnd()
}
</script>

<template>
  <MCard class="fb">
    <template #header>
      <MFlex align="center" justify="space-between">
        <span class="fb__title">数据绑定</span>
        <MSegmented v-model="mode" :options="MODE_OPTIONS" size="small" />
      </MFlex>
    </template>

    <div v-if="mode === 'expr'" class="fb__expr">
      <p class="text-helper">直接编辑 transform 步骤（JSON）。回到可视化后，按入参装配重新生成，表达式自定义步骤可能被覆盖。</p>
      <textarea
        v-model="exprText"
        class="fb__expr-input"
        rows="12"
        spellcheck="false"
      />
      <div v-if="$slots.default" class="fb__extra">
        <slot />
      </div>
    </div>

    <div v-else class="fb__visual">
      <!-- 左：字段列表 -->
      <aside class="fb__aside">
        <div class="fb__aside-head">
          <span class="fb__aside-title">字段</span>
        </div>
        <div class="fb__aside-search">
          <MInput v-model="keyword" placeholder="搜索字段…" fluid size="small" />
        </div>
        <div class="fb__list">
          <div
            v-for="p in filteredProfiles"
            :key="p.key"
            class="fb__field"
            :class="{ 'is-dragging': dragField?.key === p.key }"
            draggable="true"
            title="拖到右侧入参，或点击 + 自动放入"
            @dragstart="onDragStart(p, $event)"
            @dragend="onDragEnd"
            @dblclick="addFieldSmart(p)"
          >
            <span class="fb__field-icon" :data-kind="p.valueKind">
              <SvgIcon :name="kindIcon(p.valueKind)" :px="13" />
            </span>
            <span class="fb__field-info">
              <span class="fb__field-label">{{ p.label }}</span>
              <span class="fb__field-key">{{ p.key }}</span>
            </span>
            <button
              type="button"
              class="fb__field-add"
              aria-label="放入入参"
              @click.stop="addFieldSmart(p)"
            >
              <SvgIcon name="plus" :px="13" />
            </button>
          </div>
          <p v-if="!filteredProfiles.length" class="fb__empty">
            {{ profiles.length ? '无匹配字段' : '暂无字段 · 请先在左侧完成取数（Mock 自动加载，其他来源点「测试」）' }}
          </p>
        </div>
      </aside>

      <!-- 右：组件入参区 + 过滤条件 -->
      <div class="fb__main">
        <section
          v-for="role in roles"
          :key="role.field"
          class="fb__zone"
          :class="{ 'is-over': dropKey === `role:${role.field}` }"
          @dragover="onDragOver({ kind: 'role', role }, $event)"
          @dragleave="onDragLeave({ kind: 'role', role })"
          @drop="onDrop({ kind: 'role', role }, $event)"
        >
          <p class="fb__zone-title">
            {{ role.label }}
            <span v-if="role.required" class="fb__required">*</span>
            <span class="fb__zone-types">{{ role.acceptedTypes.join(' / ') }}</span>
          </p>
          <div v-if="fieldsOf(role).length" class="fb__chips">
            <div
              v-for="(f, i) in fieldsOf(role)"
              :key="`${f.field}_${i}`"
              class="fb__chip"
              :class="{ 'fb__chip--missing': isMissing(f.field) }"
              :title="isMissing(f.field) ? `字段 ${f.field} 不在当前数据中，请重新选择` : undefined"
            >
              <span class="fb__chip-label">{{ labelOf(f.field) }}</span>
              <MSelect
                v-if="roleIsMetric(role)"
                :model-value="f.agg"
                :options="AGG_OPTIONS"
                size="small"
                class="fb__chip-agg"
                @update:model-value="setAgg(role, i, $event as MetricAgg | 'none')"
              />
              <button
                type="button"
                class="fb__chip-x"
                aria-label="移除"
                @click="removeFromRole(role, i)"
              >
                <SvgIcon name="x" :px="12" />
              </button>
            </div>
          </div>
          <p v-else class="text-helper">拖拽字段到此处作为「{{ role.label }}」</p>
        </section>

        <!-- 过滤条件 -->
        <section
          class="fb__zone"
          :class="{ 'is-over': dropKey === 'filter' }"
          @dragover="onDragOver({ kind: 'filter' }, $event)"
          @dragleave="onDragLeave({ kind: 'filter' })"
          @drop="onDrop({ kind: 'filter' }, $event)"
        >
          <p class="fb__zone-title">
            过滤条件
            <span
              v-if="filters.some(f => !f.value.trim())"
              class="fb__filter-hint"
              title="值为空的过滤条件不会生成过滤步骤，填入值后生效"
            >· 有条件未填值，暂不会生效</span>
          </p>
          <div v-if="filters.length" class="fb__chips">
            <div v-for="(f, i) in filters" :key="i" class="fb__filter-row">
              <MTag size="small" class="fb__filter-tag">{{ labelOf(f.field) }}</MTag>
              <MSelect
                :model-value="f.op"
                :options="FILTER_OPS"
                size="small"
                class="fb__filter-op"
                @update:model-value="updateFilter(i, { op: $event as string })"
              />
              <MInput
                :model-value="f.value"
                size="small"
                placeholder="值（必填）"
                fluid
                :class="{ 'fb__filter-value--empty': !f.value.trim() }"
                @update:model-value="updateFilter(i, { value: $event as string })"
              />
              <button
                type="button"
                class="fb__chip-x"
                aria-label="移除过滤"
                @click="removeFilter(i)"
              >
                <SvgIcon name="x" :px="12" />
              </button>
            </div>
          </div>
          <p v-else class="text-helper">拖拽字段到此处添加过滤条件</p>
        </section>

        <MEmpty
          v-if="!assignments.some(a => a.fields.length) && !filters.length"
          title="从左侧拖入字段开始配置"
          description="字段放入组件需要的入参即可，数值入参可切换聚合方式"
        />

        <!-- 数据内容：紧跟右侧入参（维度 / 数值 / 系列 / 过滤条件等）之后 -->
        <div v-if="$slots.default" class="fb__extra">
          <slot />
        </div>
      </div>
    </div>
  </MCard>
</template>

<style lang="scss" scoped>
.fb {
  width: 100%;
  height: 100%;

  &__title {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--m-color-text-muted);
  }

  &__expr {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__expr-input {
    width: 100%;
    resize: vertical;
    border-radius: var(--m-radius-md);
    border: 1px solid var(--m-color-border);
    background: var(--m-color-surface);
    padding: 0.625rem;
    font-family: var(--m-font-mono, monospace);
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text);
  }

  &__extra {
    margin-top: 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    border-top: 1px dashed var(--m-color-split);
    padding-top: 0.75rem;
  }

  &__visual {
    display: grid;
    min-height: 0;
    flex: 1;
    grid-template-columns: 240px minmax(0, 1fr);
    align-items: flex-start;
    gap: 0.875rem;
  }

  &__aside {
    display: flex;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--m-radius-md);
    border: 1px solid var(--m-color-border);
    background: var(--m-color-surface);
  }

  &__aside-head {
    padding: 0.625rem 0.75rem 0.375rem;
  }

  &__aside-title {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    color: var(--m-color-text);
  }

  &__aside-search {
    border-bottom: 1px solid var(--m-color-split);
    padding: 0 0.625rem 0.5rem;
  }

  &__list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.125rem;
    overflow: auto;
    padding: 0.375rem;
  }

  &__empty {
    margin: 0.75rem;
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--m-color-text-muted);
  }

  &__main {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: 0.75rem;
    overflow: auto;
  }

  &__required {
    color: var(--m-color-danger);
  }

  &__chips {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__filter-row {
    display: grid;
    grid-template-columns: auto 96px 1fr 22px;
    align-items: center;
    gap: 0.5rem;
  }

  &__filter-tag {
    flex: none;
  }

  &__filter-op {
    width: 6rem;
  }

  &__filter-hint {
    font-size: 11px;
    font-weight: 400;
    color: var(--m-color-warning);
  }
}

.fb__field {
  position: relative;
  display: flex;
  cursor: grab;
  align-items: center;
  gap: 0.5rem;
  border-radius: var(--m-radius-sm);
  padding: 0.375rem 0.5rem;
  transition: background-color 0.12s;

  &:hover {
    background: var(--m-color-fill-light);
  }

  &.is-dragging {
    opacity: 0.5;
  }
}

.fb__field-icon {
  display: grid;
  height: 22px;
  width: 22px;
  flex: none;
  place-items: center;
  border-radius: var(--m-radius-xs);
  background: var(--m-color-fill-lighter);
  color: var(--m-color-text-muted);

  &[data-kind='number'] {
    background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
    color: var(--m-color-primary);
  }

  &[data-kind='date'] {
    background: color-mix(in srgb, var(--m-color-info) 12%, transparent);
    color: var(--m-color-info);
  }
}

.fb__field-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.fb__field-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--m-color-text);
}

.fb__field-key {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.fb__field-add {
  display: grid;
  height: 1.25rem;
  width: 1.25rem;
  flex: none;
  cursor: pointer;
  place-items: center;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: var(--m-color-text-muted);

  &:hover {
    background: color-mix(in srgb, var(--m-color-primary) 14%, transparent);
    color: var(--m-color-primary);
  }
}

.fb__zone {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: var(--m-radius-md);
  border: 1.5px dashed var(--m-color-border);
  background: color-mix(in srgb, var(--m-color-fill-light) 55%, transparent);
  padding: 0.625rem 0.75rem;
  transition: border-color 0.12s, background-color 0.12s;

  &.is-over {
    border-color: var(--m-color-primary);
    background: color-mix(in srgb, var(--m-color-primary) 6%, transparent);
  }
}

.fb__zone-title {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  font-size: 0.75rem;
  line-height: 1rem;
  font-weight: 600;
  color: var(--m-color-text-muted);
}

.fb__zone-types {
  font-size: 11px;
  font-weight: 400;
  color: var(--m-color-text-muted);
}

/* 过滤条件：空值不会生成过滤步骤，在行内提示。 */
.fb__filter-value--empty {
  --m-color-border: var(--m-color-warning);
}

.fb__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  align-self: flex-start;
  border-radius: 9999px;
  border: 1px solid var(--m-color-border);
  background: var(--m-color-surface);
  padding: 3px 0.375rem 3px 0.625rem;
  font-size: 12.5px;
  color: var(--m-color-text);
}

.fb__chip-label {
  font-weight: 500;
}

.fb__chip-agg {
  width: 92px;
}

/* 已绑字段不在当前数据中（换源 / 改加工后失配）。 */
.fb__chip--missing {
  border-color: var(--m-color-danger);
  background: color-mix(in srgb, var(--m-color-danger) 8%, var(--m-color-surface));
  color: var(--m-color-danger);
}

.fb__chip-x {
  display: grid;
  height: 18px;
  width: 18px;
  flex: none;
  cursor: pointer;
  place-items: center;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: var(--m-color-text-muted);

  &:hover {
    background: color-mix(in srgb, var(--m-color-danger) 14%, transparent);
    color: var(--m-color-danger);
  }
}
</style>
