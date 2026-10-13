<script setup lang="ts">
/**
 * 组件库画廊（/layers）
 * 展示平台内置卡片组件，每个用示例数据实时渲染。
 * 这是引擎能力的活文档。
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MTag } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import { getAllRegistrations } from '../engine/registry'
import { getCardComponent } from '../engine/registry'
import type { CardSchema } from '../types/schema'

const { t } = useI18n()
const router = useRouter()

interface GalleryItem {
  type: string
  label: string
  description: string
  schema: CardSchema
  data: Record<string, unknown>[]
}

const sampleChart = [
  { x: '1月', y: 420 }, { x: '2月', y: 380 }, { x: '3月', y: 560 },
  { x: '4月', y: 490 }, { x: '5月', y: 620 }, { x: '6月', y: 580 },
]

const items = computed<GalleryItem[]>(() => {
  const regs = getAllRegistrations()
  return regs.map(reg => {
    const base = { id: `gallery-${reg.type}`, type: reg.type, title: reg.label } as CardSchema
    switch (reg.type) {
      case 'stat':
        return {
          type: reg.type, label: reg.label ?? reg.type, description: reg.description ?? '',
          schema: { ...base, stat: { valueField: 'value', prefix: '$', trendField: 'trend', trendType: 'auto' } },
          data: [{ value: 128430, trend: '+12.5%', label: '总收入' }],
        }
      case 'chart':
        return {
          type: reg.type, label: reg.label ?? reg.type, description: reg.description ?? '',
          schema: { ...base, chart: { chartType: 'area', xField: 'x', yField: 'y', smooth: true, height: 220 } },
          data: sampleChart,
        }
      case 'table':
        return {
          type: reg.type, label: reg.label ?? reg.type, description: reg.description ?? '',
          schema: {
            ...base,
            table: {
              columns: [
                { key: 'id', title: '订单号' },
                { key: 'customer', title: '客户' },
                { key: 'amount', title: '金额', render: 'currency', align: 'right' },
              ],
              showPagination: false,
            },
          },
          data: [
            { id: 'ORD-001', customer: '张三', amount: 1299 },
            { id: 'ORD-002', customer: '李四', amount: 599 },
            { id: 'ORD-003', customer: '王五', amount: 2899 },
          ],
        }
      case 'list':
        return {
          type: reg.type, label: reg.label ?? reg.type, description: reg.description ?? '',
          schema: { ...base, list: { titleField: 'name', subtitleField: 'category', valueField: 'sales', trendField: 'trend' } },
          data: [
            { name: '无线耳机', category: '电子', sales: 1234, trend: '+15%' },
            { name: '智能手表', category: '电子', sales: 986, trend: '+8%' },
            { name: '运动鞋', category: '服装', sales: 765, trend: '-3%' },
          ],
        }
      case 'banner':
        return {
          type: reg.type, label: reg.label ?? reg.type, description: reg.description ?? '',
          schema: { ...base, banner: { title: '升级到专业版', description: '解锁全部图表类型与无限数据源', buttonText: '立即升级' } },
          data: [],
        }
      default:
        return { type: reg.type, label: reg.label ?? reg.type, description: reg.description ?? '', schema: base, data: [] }
    }
  })
})

function resolve(type: string) {
  return getCardComponent(type as never)
}

function openDemo() {
  router.push('/demo/renderer')
}
</script>

<template>
  <WorkspacePage :title="t('pages.layers.title')" :summary="t('pages.layers.summary')">
    <div class="gallery">
      <div class="gallery__head">
        <p class="gallery__tip">{{ t('gallery.tip') }}</p>
        <MButton type="default" @click="openDemo">{{ t('gallery.openDemo') }}</MButton>
      </div>

      <div class="gallery__grid">
        <section v-for="item in items" :key="item.type" class="gallery-item">
          <header class="gallery-item__head">
            <h4 class="gallery-item__label">{{ item.label }}</h4>
            <MTag>{{ item.type }}</MTag>
          </header>
          <p class="gallery-item__desc">{{ item.description }}</p>
          <div class="gallery-item__preview">
            <component
              :is="resolve(item.type)"
              v-if="resolve(item.type)"
              :schema="item.schema"
              :data="item.data"
              :loading="false"
              :error="null"
            />
          </div>
        </section>
      </div>
    </div>
  </WorkspacePage>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gallery__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gallery__tip {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

.gallery-item {
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  padding: 20px;
  box-shadow: var(--m-shadow-card);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gallery-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gallery-item__label {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.gallery-item__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.gallery-item__preview {
  margin-top: 8px;
  pointer-events: none;
}
</style>
