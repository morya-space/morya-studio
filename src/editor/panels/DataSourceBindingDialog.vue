<script setup lang="ts">
/**
 * 数据源绑定弹窗
 * 替换卡片属性面板的简单下拉：左侧操作区（单/多选数据源 + 字段常规操作：
 * 重命名 / 排序 / 隐藏列 / 过滤 / 截取），右侧预览区（多源合并 + 草稿步骤加工后的实时预览）。
 * 草稿模式：点「确定」才写回卡片（一次撤销历史），「取消」丢弃全部修改。
 * 多数据源语义：各源行做纵向合并（UNION），字段取并集。
 */

import { computed, ref, watch } from 'vue'
import {
  MButton, MCheckbox, MDialog, MEmpty, MInput, MInputNumber, MSplitter,
  MSwitch, MScrollbar, MTable, MTag, message, type TableColumnDefinition,
} from 'morya-ui'
import type { DataSourceConfig, DataSourceType, TransformStep } from '../../types/schema'
import { useEditorStore } from '../store'
import { useDataStore } from '../../data/store'
import { cardDataSourceIds } from '../../engine/utils'
import { getDataSource, listDataSources } from '../../services/datasource'
import { applyTransform } from '../../data/transform/pipeline'
import {
  autoConfigCard, describeFields, isDimensionLike, isMetricLike,
  type FieldDescriptor, type FieldRole,
} from '../../data/fields'
import SvgIcon from '../../components/common/SvgIcon.vue'

type Row = Record<string, unknown>

interface FieldMeta {
  name: string
  sources: string[]
  sample: unknown
}

interface RawEntry {
  rows: Row[]
  loading: boolean
  error?: string
}

const editorStore = useEditorStore()
const dataStore = useDataStore()

const visible = defineModel<boolean>({ required: true })
const card = computed(() => editorStore.selectedCard)

// ==================== 数据源选择 ====================
const allSources = ref<DataSourceConfig[]>([])
const search = ref('')
const selectedIds = ref<string[]>([])

const TYPE_TAG: Record<DataSourceType, 'primary' | 'secondary' | 'success' | 'info' | 'warning'> = {
  static: 'success',
  api: 'primary',
  mock: 'warning',
  websocket: 'info',
  sql: 'secondary',
}

const filteredSources = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allSources.value
  return allSources.value.filter(ds =>
    `${ds.name ?? ''} ${ds.type} ${ds.id ?? ''}`.toLowerCase().includes(q),
  )
})

function isChecked(id?: string): boolean {
  return !!id && selectedIds.value.includes(id)
}

function toggleSource(id: string | undefined, checked: boolean) {
  if (!id) return
  const set = new Set(selectedIds.value)
  if (checked) set.add(id)
  else set.delete(id)
  selectedIds.value = allSources.value
    .filter(ds => ds.id && set.has(ds.id))
    .map(ds => ds.id as string)
}

// ==================== 字段操作草稿 ====================
const renameMap = ref<Record<string, string>>({})
const hiddenFields = ref<Set<string>>(new Set())
const sortField = ref('')
const sortOrder = ref<'asc' | 'desc'>('asc')
const filterChips = ref<string[]>([])
const newFilter = ref('')
const limitCount = ref<number | undefined>(undefined)
const extras = ref<TransformStep[]>([])
let pendingShown: string[] | null = null

function setRename(name: string, v: string) {
  if (v) renameMap.value[name] = v
  else delete renameMap.value[name]
}

function setSort(name: string, dir: 'asc' | 'desc') {
  if (sortField.value === name && sortOrder.value === dir) sortField.value = ''
  else {
    sortField.value = name
    sortOrder.value = dir
  }
}

function isHidden(name: string): boolean {
  return hiddenFields.value.has(name)
}

function setHidden(name: string, hide: boolean) {
  const next = new Set(hiddenFields.value)
  if (hide) next.add(name)
  else next.delete(name)
  hiddenFields.value = next
}

function addFilter() {
  const expr = newFilter.value.trim()
  if (!expr) return
  filterChips.value = [...filterChips.value, expr]
  newFilter.value = ''
}

function removeFilter(index: number) {
  filterChips.value = filterChips.value.filter((_, i) => i !== index)
}

function buildSteps(): TransformStep[] {
  const out: TransformStep[] = []
  for (const expr of filterChips.value) {
    const t = expr.trim()
    if (t) out.push({ op: 'filter', expr: t })
  }
  if (sortField.value) out.push({ op: 'sort', field: sortField.value, order: sortOrder.value })
  if (typeof limitCount.value === 'number' && limitCount.value > 0) {
    out.push({ op: 'limit', count: limitCount.value })
  }
  if (hiddenFields.value.size) {
    const shown = fields.value.filter(f => !hiddenFields.value.has(f.name)).map(f => f.name)
    if (shown.length) out.push({ op: 'pick', fields: shown })
  }
  const renames: Record<string, string> = {}
  for (const [k, v] of Object.entries(renameMap.value)) {
    const t = (v ?? '').trim()
    if (t && t !== k) renames[k] = t
  }
  if (Object.keys(renames).length) out.push({ op: 'rename', fields: renames })
  out.push(...extras.value)
  return out
}

const draftSteps = computed<TransformStep[]>(() => buildSteps())

// ==================== 预览取数 ====================
const rawByDs = ref<Record<string, RawEntry>>({})
const previewFetching = ref(false)

async function ensureLoaded(force = false) {
  const targets = selectedIds.value.filter(id => force || !rawByDs.value[id])
  if (!targets.length) return
  previewFetching.value = true
  try {
    await Promise.all(targets.map(async id => {
      rawByDs.value[id] = { rows: [], loading: true }
      const ds = getDataSource(id)
      if (!ds) {
        rawByDs.value[id] = { rows: [], loading: false, error: '数据源已不存在' }
        return
      }
      try {
        const rows = await dataStore.fetchRaw(ds, { force })
        rawByDs.value[id] = { rows, loading: false }
      } catch (e) {
        rawByDs.value[id] = { rows: [], loading: false, error: e instanceof Error ? e.message : String(e) }
      }
    }))
  } finally {
    previewFetching.value = false
  }
}

watch(selectedIds, () => { void ensureLoaded() }, { deep: true })

const mergedRaw = computed<Row[]>(() => {
  const out: Row[] = []
  for (const id of selectedIds.value) out.push(...(rawByDs.value[id]?.rows ?? []))
  return out
})

/** 字段全集：从各选中源的原始行（前 20 行）探测键并集 */
const fields = computed<FieldMeta[]>(() => {
  const map = new Map<string, FieldMeta>()
  for (const id of selectedIds.value) {
    const entry = rawByDs.value[id]
    if (!entry || entry.loading) continue
    for (const row of entry.rows.slice(0, 20)) {
      for (const key of Object.keys(row)) {
        let meta = map.get(key)
        if (!meta) {
          meta = { name: key, sources: [], sample: undefined }
          map.set(key, meta)
        }
        if (!meta.sources.includes(id)) meta.sources.push(id)
        const v = row[key]
        if (meta.sample === undefined || meta.sample === null) {
          if (v !== undefined && v !== null) meta.sample = v
        }
      }
    }
  }
  return [...map.values()]
})

// pick 步骤解析出的「保留字段」需等字段集就绪才能换算隐藏列
watch(fields, (fs) => {
  if (!pendingShown) return
  hiddenFields.value = new Set(fs.map(f => f.name).filter(n => !pendingShown!.includes(n)))
  pendingShown = null
})

const previewRows = computed<Row[]>(() => applyTransform(mergedRaw.value, draftSteps.value))

// ==================== 字段角色拖拽（维度 / 时间 / 指标） ====================
/** 加工后的最终字段（含角色推断），作为拖拽角色面板的数据源 */
const finalFields = computed<FieldDescriptor[]>(() => describeFields(previewRows.value))

/** 字段角色分配草稿：字段名 → 维度/指标/时间 */
const fieldRoles = ref<Record<string, FieldRole>>({})
let dragField: string | null = null

function roleOf(name: string): FieldRole {
  return fieldRoles.value[name] ?? finalFields.value.find(f => f.name === name)?.role ?? 'dimension'
}

function assignRole(name: string, role: FieldRole | null) {
  const next = { ...fieldRoles.value }
  if (role) next[name] = role
  else delete next[name]
  fieldRoles.value = next
}

function onRoleDragStart(name: string) {
  dragField = name
}

function onRoleDragEnd() {
  dragField = null
}

function onRoleDrop(role: FieldRole) {
  if (dragField) assignRole(dragField, role)
  dragField = null
}

const roleBuckets = computed(() => ({
  dimension: finalFields.value.filter(f => roleOf(f.name) === 'dimension'),
  time: finalFields.value.filter(f => roleOf(f.name) === 'time'),
  metric: finalFields.value.filter(f => roleOf(f.name) === 'metric'),
}))

const ROLE_LABEL: Record<FieldRole, string> = { dimension: '维度', time: '时间', metric: '指标' }
const ROLE_TAG: Record<FieldRole, 'info' | 'success' | 'primary'> = {
  dimension: 'info',
  time: 'success',
  metric: 'primary',
}

function kindBadge(f: FieldDescriptor): string {
  switch (f.kind) {
    case 'number': return '数值'
    case 'date': return '日期'
    case 'boolean': return '布尔'
    default: return '文本'
  }
}

const previewTableRows = computed(() =>
  previewRows.value.slice(0, 50).map((r, i) => ({ ...r, __rid: String(i) })),
)

const previewColumns = computed<TableColumnDefinition[]>(() => {
  const cols: TableColumnDefinition[] = []
  const seen = new Set<string>()
  for (const f of fields.value) {
    if (hiddenFields.value.has(f.name)) continue
    const key = (renameMap.value[f.name] ?? '').trim() || f.name
    if (seen.has(key)) continue
    seen.add(key)
    cols.push({ key, title: key })
  }
  const sample = previewRows.value[0]
  if (sample) {
    for (const key of Object.keys(sample)) {
      if (seen.has(key) || key === '__rid') continue
      seen.add(key)
      cols.push({ key, title: key })
    }
  }
  return cols
})

const sourceStats = computed(() => selectedIds.value.map(id => {
  const ds = getDataSource(id)
  const entry = rawByDs.value[id]
  return {
    id,
    name: ds?.name ?? id,
    count: entry?.rows.length ?? 0,
    loading: !!entry?.loading,
    error: entry?.error,
  }
}))

// ==================== 展示工具 ====================
function typeOf(v: unknown): string {
  if (typeof v === 'number') return '数值'
  if (typeof v === 'boolean') return '布尔'
  if (v instanceof Date) return '日期'
  if (typeof v === 'string') return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v) ? '日期' : '文本'
  if (v === null || v === undefined) return '—'
  return '对象'
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 28)
  const s = String(v)
  return s.length > 28 ? `${s.slice(0, 28)}…` : s
}

// ==================== 打开 / 写回 ====================
watch(visible, (v) => {
  if (v) openDraft()
})

function openDraft() {
  allSources.value = listDataSources().filter(ds => ds.id)
  search.value = ''
  newFilter.value = ''
  rawByDs.value = {}
  renameMap.value = {}
  hiddenFields.value = new Set()
  sortField.value = ''
  sortOrder.value = 'asc'
  filterChips.value = []
  limitCount.value = undefined
  extras.value = []
  pendingShown = null
  dragField = null
  // 字段角色：从卡片上次配置恢复；未配置的字段运行时按类型推断
  fieldRoles.value = { ...(card.value?.fieldRoles ?? {}) }

  const c = card.value
  selectedIds.value = c ? cardDataSourceIds(c) : []
  for (const step of c?.transform ?? []) {
    switch (step.op) {
      case 'filter': filterChips.value.push(step.expr); break
      case 'sort': sortField.value = step.field; sortOrder.value = step.order ?? 'asc'; break
      case 'limit': limitCount.value = step.count; break
      case 'pick': pendingShown = [...step.fields]; break
      case 'rename': renameMap.value = { ...renameMap.value, ...step.fields }; break
      default: extras.value.push(step)
    }
  }
  void ensureLoaded()
}

function onConfirm() {
  const c = card.value
  if (!c) return
  const ids = selectedIds.value

  for (const id of ids) {
    const ds = getDataSource(id)
    if (!ds) {
      message.error(`数据源「${id}」不存在，请重新选择`)
      return
    }
    dataStore.registerDataSource(ds)
  }
  if (ids.length && fields.value.length && fields.value.every(f => hiddenFields.value.has(f.name))) {
    message.warning('至少保留 1 个显示字段')
    return
  }

  const steps = buildSteps()
  // 最终数据（合并 + 草稿步骤），用于自动补齐卡片字段配置
  const finalRows = applyTransform(mergedRaw.value, steps)
  editorStore.updateSchema(draft => {
    const target = draft.cards.find(cc => cc.id === c.id)
    if (!target) return
    if (ids.length) {
      target.dataSourceIds = [...ids]
      target.dataSourceId = ids[0]
    } else {
      delete target.dataSourceIds
      delete target.dataSourceId
    }
    if (steps.length) target.transform = steps
    else delete target.transform

    // 字段角色（拖拽配置）持久化
    if (ids.length) {
      target.fieldRoles = Object.keys(fieldRoles.value).length ? { ...fieldRoles.value } : undefined
    } else {
      delete target.fieldRoles
    }

    // 打通「数据源 → 渲染」：按字段角色（维度 / 指标）自动补齐卡片的字段配置
    if (ids.length && finalRows.length) {
      const cfg = autoConfigCard(target, finalRows, fieldRoles.value)
      if (cfg.stat) target.stat = cfg.stat
      if (cfg.chart) target.chart = cfg.chart
      if (cfg.table) target.table = cfg.table
      if (cfg.list) target.list = cfg.list
    }
  })

  const updated = editorStore.page.cards.find(cc => cc.id === c.id)
  if (updated) void dataStore.loadCardData({ ...updated })
  message.success(ids.length ? `已绑定 ${ids.length} 个数据源` : '已解除数据源绑定')
  visible.value = false
}
</script>

<template>
  <MDialog v-model="visible" class="binding-dialog-host" title="数据源绑定" maximizable>
    <MSplitter class="binding-split" :default-size="45" :resize-trigger-size="9" resize-trigger-class="binding-gutter" min="300px" min2="340px">
      <template #panel1>
      <!-- 左侧：操作区 -->
      <MScrollbar class="ops-scroll" height="100%" aria-label="数据源绑定操作区">
      <section class="ops-col">
        <div class="ops-block">
          <div class="ops-head">
            <h4 class="ops-title">选择数据源</h4>
            <span class="ops-meta">已选 {{ selectedIds.length }} 个 · 可单选 / 多选</span>
          </div>
          <MInput v-model="search" placeholder="搜索名称 / 类型" clearable size="small" />
          <div class="ds-pick-list">
            <label v-for="ds in filteredSources" :key="ds.id" class="ds-pick-item">
              <MCheckbox
                :model-value="isChecked(ds.id)"
                size="small"
                @update:model-value="toggleSource(ds.id, $event)"
              />
              <span class="ds-pick-name">{{ ds.name || ds.id }}</span>
              <MTag :type="TYPE_TAG[ds.type] ?? 'secondary'" size="small">{{ ds.type }}</MTag>
            </label>
            <p v-if="!filteredSources.length" class="ds-pick-empty">
              没有匹配的数据源？可在左侧「数据源」面板新建
            </p>
          </div>
        </div>

        <div v-if="selectedIds.length && fields.length" class="ops-block">
          <div class="ops-head">
            <h4 class="ops-title">字段操作</h4>
            <div class="ops-limit">
              <span>截取</span>
              <MInputNumber
                :model-value="limitCount"
                :min="1"
                size="small"
                style="--m-inputnumber-width: 5.5rem"
                @update:model-value="limitCount = ($event as unknown) == null ? undefined : Number($event)"
              />
            </div>
          </div>
          <div class="role-wells">
            <div
              v-for="role in [{ key: 'dimension' as const, label: '维度' }, { key: 'time' as const, label: '时间' }, { key: 'metric' as const, label: '指标' }]"
              :key="role.key"
              class="role-well"
              @dragover.prevent
              @drop.prevent="onRoleDrop(role.key)"
            >
              <div class="role-well__head">
                <span class="role-well__label">{{ role.label }}</span>
                <span class="role-well__count">{{ roleBuckets[role.key].length }}</span>
              </div>
              <div class="role-well__chips">
                <span
                  v-for="f in roleBuckets[role.key]" :key="f.name"
                  class="role-chip"
                  draggable="true"
                  @dragstart="onRoleDragStart(f.name)"
                  @dragend="onRoleDragEnd"
                >
                  <span class="role-chip__name">{{ f.name }}</span>
                  <span class="role-chip__kind">{{ kindBadge(f) }}</span>
                  <button
                    type="button"
                    class="role-chip__x"
                    :aria-label="`将 ${f.name} 移出`"
                    @click="assignRole(f.name, null)"
                  >×</button>
                </span>
                <span v-if="!roleBuckets[role.key].length" class="role-well__empty">拖入字段</span>
              </div>
            </div>
            <p class="role-hint">把字段拖到「维度 / 时间 / 指标」，自动配置到图表 X/Y、指标数值、表格列等</p>
          </div>

          <div class="field-list">
            <div v-for="f in fields" :key="f.name" class="field-row" :class="{ 'is-hidden': isHidden(f.name) }">
              <div class="field-id">
                <span class="field-name">{{ f.name }}</span>
                <span class="field-type">{{ typeOf(f.sample) }} · {{ f.sources.length }} 源</span>
                <span class="field-sample">{{ fmtValue(f.sample) }}</span>
              </div>
              <MInput
                class="field-rename"
                :model-value="renameMap[f.name] ?? ''"
                :placeholder="f.name"
                size="small"
                @update:model-value="setRename(f.name, $event as string)"
              />
              <div class="field-sort">
                <MButton
                  type="text" size="small"
                  :class="{ 'is-active': sortField === f.name && sortOrder === 'asc' }"
                  @click="setSort(f.name, 'asc')"
                >↑</MButton>
                <MButton
                  type="text" size="small"
                  :class="{ 'is-active': sortField === f.name && sortOrder === 'desc' }"
                  @click="setSort(f.name, 'desc')"
                >↓</MButton>
              </div>
              <MSwitch
                size="small"
                :model-value="!isHidden(f.name)"
                :aria-label="`显示字段 ${f.name}`"
                @update:model-value="setHidden(f.name, !$event)"
              />
            </div>
          </div>

          <div class="filter-ops">
            <div class="filter-head">
              <span class="filter-label">过滤条件</span>
              <span class="filter-note">表达式使用原字段名</span>
            </div>
            <div class="filter-chips">
              <MTag
                v-for="(expr, i) in filterChips" :key="`${expr}-${i}`"
                type="info" size="small" closable
                @close="removeFilter(i)"
              >{{ expr }}</MTag>
              <span v-if="!filterChips.length" class="filter-none">暂无条件</span>
            </div>
            <div class="filter-add">
              <MInput v-model="newFilter" size="small" placeholder="如 amount > 100" />
              <MButton type="secondary" size="small" @click="addFilter">添加</MButton>
            </div>
            <p v-if="extras.length" class="extras-note">
              另有 {{ extras.length }} 个高级步骤（映射 / 分组聚合），顺序保持不变，可在「数据转换」面板编辑
            </p>
          </div>
        </div>
        <div v-else-if="selectedIds.length" class="ops-block">
          <p class="ds-pick-empty">选中数据源暂无可探测字段（0 行或拉取失败）</p>
        </div>
      </section>
      </MScrollbar>
      </template>

      <template #panel2>
      <!-- 右侧：预览区 -->
      <section class="preview-col">
        <div class="preview-head">
          <div class="preview-stats">
            <MTag
              v-for="s in sourceStats" :key="s.id"
              type="secondary" size="small"
            >{{ s.name }}: {{ s.loading ? '取数中…' : `${s.count} 行` }}</MTag>
            <span class="preview-count">
              合并 {{ mergedRaw.length }} 行 → 加工后 {{ previewRows.length }} 行
            </span>
          </div>
          <MButton type="text" size="small" :loading="previewFetching" @click="ensureLoaded(true)">
            <SvgIcon name="sync" :px="12" /> 刷新
          </MButton>
        </div>

        <MEmpty
          v-if="!selectedIds.length"
          class="preview-empty"
          title="未选择数据源"
          description="在左侧勾选数据源后，这里会实时预览合并与加工后的数据"
        />
        <template v-else>
          <div v-for="s in sourceStats.filter(x => x.error)" :key="`err-${s.id}`" class="preview-error" role="alert">
            {{ s.name }}：{{ s.error }}
          </div>
          <MTable
            :columns="previewColumns"
            :rows="previewTableRows"
            row-key="__rid"
            size="small"
            striped
            :loading="previewFetching"
            :max-height="440"
          >
            <template #body-cell="{ value }">
              <span class="preview-cell">{{ fmtValue(value) }}</span>
            </template>
            <template #empty>
              <MEmpty simple title="无数据行" description="数据为空，或过滤条件过滤掉了全部行" />
            </template>
          </MTable>
          <p class="preview-note">仅预览前 50 行；字段操作实时作用于预览，确定后生效到卡片</p>
        </template>
      </section>
      </template>
    </MSplitter>

    <template #footer>
      <div class="dialog-foot">
        <span class="foot-hint">多选时各数据源按行纵向合并（UNION），字段取并集</span>
        <div class="foot-btns">
          <MButton type="default" @click="visible = false">取消</MButton>
          <MButton type="primary" @click="onConfirm">确定</MButton>
        </div>
      </div>
    </template>
  </MDialog>
</template>

<style scoped>
.binding-split {
  height: clamp(420px, 62vh, 620px);
}

.ops-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 2px 12px 4px 2px;
}

.ops-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 10px 12px;
  background: var(--m-color-surface);
}

.ops-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ops-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
}

.ops-meta {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.ops-limit {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.ds-pick-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
}

.ds-pick-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--m-radius-sm);
  cursor: pointer;
}

.ds-pick-item:hover {
  background: var(--m-color-hover, var(--m-color-surface-hover));
}

.ds-pick-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-pick-empty {
  margin: 8px 0;
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.role-wells {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px dashed var(--m-color-border);
  padding-top: 10px;
}

.role-well {
  border: 1px dashed var(--m-color-border);
  border-radius: var(--m-radius-sm);
  padding: 6px 8px;
  background: color-mix(in srgb, var(--m-color-split) 35%, transparent);
  transition: border-color var(--m-motion-fast) var(--m-motion-ease);
}

.role-well__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.role-well__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text);
}

.role-well__count {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.role-well__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-well__empty {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.role-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
  background: var(--m-color-surface);
  cursor: grab;
  user-select: none;
}

.role-chip:active {
  cursor: grabbing;
}

.role-chip__name {
  font-size: 12px;
  color: var(--m-color-text);
}

.role-chip__kind {
  font-size: 10px;
  color: var(--m-color-text-muted);
}

.role-chip__x {
  border: none;
  background: transparent;
  padding: 0 2px;
  font-size: 12px;
  line-height: 1;
  color: var(--m-color-text-muted);
  cursor: pointer;
}

.role-chip__x:hover {
  color: var(--m-color-danger);
}

.role-hint {
  margin: 0;
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-sm);
}

.field-row.is-hidden {
  opacity: 0.45;
}

.field-id {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.field-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-type {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.field-sample {
  font-size: 11px;
  color: var(--m-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-rename {
  min-width: 0;
}

.field-sort {
  display: flex;
  gap: 0;
}

.field-sort :deep(.m-button) {
  padding: 0 4px;
  color: var(--m-color-text-muted);
}

.field-sort :deep(.m-button.is-active) {
  color: var(--m-color-primary);
  font-weight: 700;
}

.filter-ops {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px dashed var(--m-color-border);
  padding-top: 8px;
}

.filter-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-text);
}

.filter-note {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-none {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.filter-add {
  display: flex;
  gap: 6px;
}

.filter-add :deep(.m-input) {
  flex: 1;
  min-width: 0;
}

.extras-note {
  margin: 0;
  font-size: 11px;
  color: var(--m-color-warning);
}

.preview-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  padding: 2px 2px 2px 10px;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preview-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.preview-count {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.preview-empty {
  margin-top: 48px;
}

.preview-error {
  font-size: 12px;
  color: var(--m-color-danger);
  padding: 6px 10px;
  border-radius: var(--m-radius-sm);
  background: color-mix(in srgb, var(--m-color-danger) 10%, transparent);
}

.preview-cell {
  font-size: 12px;
}

.preview-note {
  margin: 0;
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.dialog-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.foot-hint {
  font-size: 11px;
  color: var(--m-color-text-muted);
}

.foot-btns {
  display: flex;
  gap: 8px;
}
</style>

<style>
/* MDialog 面板 max-width 由 --m-dialog-width 控制（默认 32rem），width prop 只写内联 width 无法突破该封顶；
   且浮层 teleport 到 body，需类限定的全局样式覆盖。backdrop 根节点承接透传 class。 */
.binding-dialog-host .m-dialog {
  --m-dialog-width: min(1440px, 96vw);
}

/* MSplitter 分隔条：保留 9px 命中区，视觉仅一条居中 border 线；hover / 聚焦变主色 */
.binding-dialog-host .binding-gutter {
  position: relative;
  background: transparent;
}

.binding-dialog-host .binding-gutter::before {
  content: "";
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 50%;
  width: 1px;
  margin-left: -0.5px;
  background: var(--m-color-border);
  transition: background-color var(--m-motion-fast) var(--m-motion-ease);
}

.binding-dialog-host .binding-gutter:hover,
.binding-dialog-host .binding-gutter:focus-visible {
  background: transparent;
}

.binding-dialog-host .binding-gutter:hover::before,
.binding-dialog-host .binding-gutter:focus-visible::before {
  background: var(--m-color-primary);
}
</style>
