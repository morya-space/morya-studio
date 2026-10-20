<script setup lang="ts">
/**
 * 数据配置卡片按钮
 * 展示当前数据接入的摘要，点击后打开弹窗做具体配置。
 * 来源：请求 / Mock / WebSocket / SQL / 引用数据源。
 */

import { computed } from 'vue'
import { useEditorStore } from '../store'
import { listDataSources } from '../../services/datasource'
import { getCardRegistration } from '../../engine/registry'
import { cardUsesData } from '../../engine/utils'
import SvgIcon from '../../components/common/SvgIcon.vue'

const store = useEditorStore()
const card = computed(() => store.selectedCard)
const ds = computed(() => card.value?.dataSource)
const supportsDataConfig = computed(() => Boolean(card.value && (
  cardUsesData(card.value) || (getCardRegistration(card.value.type)?.dataContract?.roles.length ?? 0) > 0
)))

type Mode = 'api' | 'mock' | 'websocket' | 'sql' | 'reference'

const mode = computed<Mode>(() => {
  const c = card.value
  if (!c) return 'mock'
  if (c.dataSourceId) return 'reference'
  const t = c.dataSource?.type
  return (t === 'api' || t === 'mock' || t === 'websocket' || t === 'sql') ? t : 'mock'
})

const SOURCE_LABEL: Record<Mode, string> = {
  api: '动态请求',
  mock: 'Mock 数据',
  websocket: 'WebSocket',
  sql: 'SQL 查询',
  reference: '引用数据源',
}

const primaryLine = computed(() => {
  const c = card.value
  if (!c) return ''
  switch (mode.value) {
    case 'reference': {
      const found = listDataSources().find(d => d.id === c.dataSourceId)
      return found?.name ?? c.dataSourceId ?? '未选择数据源'
    }
    case 'api':
      return `${ds.value?.method ?? 'GET'}  ${ds.value?.url || '（未填写地址）'}`
    case 'websocket':
      return ds.value?.wsUrl || '（未填写地址）'
    case 'sql':
      return `${ds.value?.sql?.driver ?? 'mysql'} · ${ds.value?.sql?.host || '（未填写主机）'}`
    default:
      return ds.value?.mockTemplate ? '自定义 Mock 模板' : '未配置 Mock 模板'
  }
})

function formatInterval(ms?: number): string {
  if (!ms) return '不轮询'
  if (ms % 3600000 === 0) return `每 ${ms / 3600000} 小时`
  if (ms % 60000 === 0) return `每 ${ms / 60000} 分`
  return `每 ${Math.round(ms / 1000)} 秒`
}

const chips = computed<string[]>(() => {
  switch (mode.value) {
    case 'api': {
      const out: string[] = []
      if (ds.value?.dataPath) out.push(`路径 ${ds.value.dataPath}`)
      out.push(formatInterval(ds.value?.pollInterval))
      const pc = Object.keys(ds.value?.params ?? {}).length
      if (pc) out.push(`参数 ${pc}`)
      if (ds.value?.retry?.count) out.push(`重试 ${ds.value.retry.count}`)
      if (ds.value?.auth && ds.value.auth.type !== 'none') out.push(ds.value.auth.type.toUpperCase())
      return out
    }
    case 'websocket': {
      const out = [ds.value?.ws?.aggregate ?? 'first']
      if (ds.value?.ws?.messagePath) out.push(`路径 ${ds.value.ws.messagePath}`)
      return out
    }
    case 'sql':
      return ds.value?.sql?.query ? [ds.value.sql.query.slice(0, 24)] : ['待配置查询']
    case 'reference':
      return ['来自「数据源」管理，可跨卡片复用']
    default:
      return ['开箱即用，可替换为请求 / SQL / WebSocket']
  }
})

const emit = defineEmits<{ (e: 'edit'): void }>()
</script>

<template>
  <button v-if="supportsDataConfig" type="button" class="data-card" aria-label="编辑数据配置" @click="emit('edit')">
    <div class="data-card__head">
      <span class="data-card__icon"><SvgIcon name="database" :px="16" /></span>
      <span class="data-card__title">数据配置</span>
      <span class="data-card__tag">{{ SOURCE_LABEL[mode] }}</span>
      <span class="data-card__arrow"><SvgIcon name="arrow-up-right" :px="14" /></span>
    </div>
    <p class="data-card__primary">{{ primaryLine }}</p>
    <div v-if="chips.length" class="data-card__chips">
      <span v-for="c in chips" :key="c" class="data-card__chip">{{ c }}</span>
    </div>
    <span class="data-card__action">编辑配置</span>
  </button>
</template>

<style scoped>
.data-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-lg, var(--m-radius-md));
  background: var(--m-color-surface);
  width: 100%;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color var(--m-motion-fast, 150ms) var(--m-motion-ease, ease), box-shadow var(--m-motion-fast, 150ms) var(--m-motion-ease, ease), background-color var(--m-motion-fast, 150ms) var(--m-motion-ease, ease);
}

.data-card:hover {
  border-color: var(--m-color-primary);
  box-shadow: var(--m-shadow-card);
  background: color-mix(in srgb, var(--m-color-primary) 4%, var(--m-color-surface));
}

.data-card:focus-visible {
  outline: none;
  box-shadow: var(--m-focus-shadow);
}

.data-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-card__icon {
  display: inline-flex;
  padding: 6px;
  border-radius: var(--m-radius-sm);
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}

.data-card__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--m-color-text);
}

.data-card__tag {
  margin-left: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-primary) 10%, transparent);
  color: var(--m-color-primary);
  font-size: 11px;
  font-weight: 600;
}

.data-card__arrow {
  margin-left: auto;
  color: var(--m-color-text-muted);
}

.data-card__primary {
  margin: 0;
  font-size: 12.5px;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.data-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.data-card__chip {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--m-color-fill-light);
  color: var(--m-color-text-muted);
  font-size: 11px;
}

.data-card__action {
  align-self: flex-start;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--m-color-primary);
}
</style>
