<script setup lang="ts">
/**
 * 滚动表格卡（scrollTable）
 * 对齐 go-view TableScrollBoard：表头 + 无限滚动行。
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatValue } from '../../data/format'
import { normalizeTableColumns } from './table-columns'
import type { CardProps } from './types'
import type { TableColumn } from '../../types/schema'

const props = defineProps<CardProps>()

const cfg = computed(() => props.schema.scrollTable ?? {})

/** 规格化列：装配面板写入的字段名数组与手工对象列统一处理；未配置时回退数据全列 */
const columns = computed<TableColumn[]>(() => normalizeTableColumns(cfg.value.columns, props.data))

const rowHeight = computed(() => cfg.value.rowHeight ?? 36)
const loop = computed(() => Number(cfg.value.speed ?? 0) > 0 && props.data.length > 0)

/** 滚动时复制一份数据以实现无缝循环 */
const rows = computed(() => (loop.value ? [...props.data, ...props.data] : props.data))

const viewport = ref<HTMLElement | null>(null)
let raf = 0
let offset = 0
let last = 0

function tick(now: number) {
  const speed = Number(cfg.value.speed ?? 0)
  const dt = last ? (now - last) / 1000 : 0
  last = now
  const single = props.data.length * rowHeight.value
  if (speed > 0 && single > 0) {
    offset += speed * dt
    if (offset >= single) offset -= single
    const el = viewport.value?.querySelector<HTMLElement>('.scroll-table__track')
    if (el) el.style.transform = `translateY(-${offset}px)`
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => { if (typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick) })
onBeforeUnmount(() => cancelAnimationFrame(raf))

function cellText(row: Record<string, unknown>, col: TableColumn): string {
  const raw = row[col.key]
  if (col.render && col.render !== 'text') return formatValue(raw, col.render, 0)
  return String(raw ?? '')
}
</script>

<template>
  <div class="scroll-table">
    <div v-if="cfg.headShow !== false" class="scroll-table__head" :style="{ height: `${rowHeight}px` }">
      <span v-for="(col, i) in columns" :key="col.key" class="scroll-table__cell" :style="{ textAlign: col.align ?? 'left' }">
        {{ i === 0 && cfg.indexShow ? '#' : col.title }}
      </span>
    </div>
    <div ref="viewport" class="scroll-table__body">
      <div class="scroll-table__track">
        <div
          v-for="(row, r) in rows"
          :key="r"
          class="scroll-table__row"
          :class="{ 'is-stripe': cfg.stripe && r % 2 === 1 }"
          :style="{ height: `${rowHeight}px` }"
        >
          <span
            v-for="(col, c) in columns"
            :key="col.key"
            class="scroll-table__cell"
            :style="{ textAlign: col.align ?? 'left' }"
          >
            {{ c === 0 && cfg.indexShow ? (r % (data.length || 1)) + 1 : cellText(row, col) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scroll-table {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: var(--m-color-text);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    font-weight: 600;
    color: var(--m-color-text-muted);
    background: var(--m-color-fill-light);
    border-bottom: 1px solid var(--m-color-border);
    flex: none;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  &__track {
    will-change: transform;
  }

  &__row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--m-color-split);

    &.is-stripe {
      background: color-mix(in srgb, var(--m-color-fill-light) 60%, transparent);
    }
  }

  &__cell {
    flex: 1;
    min-width: 0;
    padding: 0 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
