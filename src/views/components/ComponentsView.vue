<script setup lang="ts">
/**
 * 组件库（/components）
 * 内置组件：引擎注册的卡片组件，实时预览（活文档）。
 * 自定义组件：用户保存的可复用卡片配置，支持增删改查。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MDialog, MEmpty, MForm, MFormItem, MInput, MSelect, MSkeleton, MTag, MTabs, MTextarea, message } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import { getAllRegistrations, getCardComponent, getCardRegistration } from '../../engine/registry'
import type { CardSchema, CardType } from '../../types/schema'
import {
  initComponents,
  listCustomComponents, saveCustomComponent, deleteCustomComponent, genComponentId,
  type CustomComponent,
} from '../../services/component'

const { t } = useI18n()
const router = useRouter()

const activeTab = ref('builtin')
const tabs = computed(() => [
  { label: t('components.builtinTab'), value: 'builtin' },
  { label: t('components.customTab'), value: 'custom' },
])

// ==================== 内置组件 ====================

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

const builtinItems = computed<GalleryItem[]>(() => {
  return getAllRegistrations().map(reg => {
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
  return getCardComponent(type as CardType)
}

// ==================== 自定义组件 ====================

const customs = ref<CustomComponent[]>([])
const loading = ref(true)
const dialogVisible = ref(false)
const editing = ref<CustomComponent | null>(null)
const configText = ref('{}')

const baseTypeOptions = computed(() =>
  getAllRegistrations().map(reg => ({ label: reg.label ?? reg.type, value: reg.type })),
)

function refreshCustoms() {
  customs.value = listCustomComponents()
}

onMounted(async () => {
  try {
    await initComponents()
    refreshCustoms()
  } finally {
    loading.value = false
  }
})

function onAdd() {
  const firstType = (getAllRegistrations()[0]?.type ?? 'stat') as CardType
  const def = getCardRegistration(firstType)?.defaultConfig?.() ?? {}
  editing.value = { id: genComponentId(), name: '', baseType: firstType, description: '', config: def }
  configText.value = JSON.stringify(def, null, 2)
  dialogVisible.value = true
}

function onEdit(comp: CustomComponent) {
  editing.value = { ...comp }
  configText.value = JSON.stringify(comp.config ?? {}, null, 2)
  dialogVisible.value = true
}

function onDelete(comp: CustomComponent) {
  deleteCustomComponent(comp.id)
  refreshCustoms()
  message.success(t('components.deleted', { title: comp.name }))
}

function onBaseTypeChange() {
  if (!editing.value) return
  const def = getCardRegistration(editing.value.baseType as CardType)?.defaultConfig?.() ?? {}
  editing.value.config = def
  configText.value = JSON.stringify(def, null, 2)
}

function onSave() {
  const comp = editing.value
  if (!comp) return
  if (!comp.name.trim()) {
    message.warn(t('components.nameRequired'))
    return
  }
  try {
    comp.config = JSON.parse(configText.value || '{}')
  } catch {
    message.error(t('components.configInvalid'))
    return
  }
  saveCustomComponent(comp)
  dialogVisible.value = false
  refreshCustoms()
  message.success(t('components.saved', { title: comp.name }))
}

function openDemo() {
  router.push('/demo/renderer')
}
</script>

<template>
  <WorkspacePage :title="t('pages.components.title')" :summary="t('pages.components.summary')">
    <div class="components">
      <div class="components__bar">
        <p class="components__tip">{{ t('components.tip') }}</p>
        <MButton v-if="activeTab === 'custom'" type="primary" @click="onAdd">{{ t('components.newComponent') }}</MButton>
        <MButton v-else type="default" @click="openDemo">{{ t('components.openDemo') }}</MButton>
      </div>

      <MTabs v-model="activeTab" :tabs="tabs">
        <template #default="{ activeValue }">
          <!-- 内置组件 -->
          <div v-if="activeValue === 'builtin'" class="grid">
            <section v-for="item in builtinItems" :key="item.type" class="card">
              <header class="card__head">
                <h4 class="card__label">{{ item.label }}</h4>
                <MTag>{{ item.type }}</MTag>
              </header>
              <p class="card__desc">{{ item.description }}</p>
              <div class="card__preview">
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

          <!-- 自定义组件 -->
          <div v-else>
            <div v-if="loading" class="grid">
              <MSkeleton v-for="i in 3" :key="i" height="140px" border-radius="var(--m-radius-lg)" />
            </div>
            <div v-else-if="customs.length === 0" class="empty">
              <MEmpty :title="t('components.emptyCustom')">
                <template #extra>
                  <MButton type="primary" @click="onAdd">{{ t('components.createNow') }}</MButton>
                </template>
              </MEmpty>
            </div>
            <div v-else class="grid">
              <section v-for="comp in customs" :key="comp.id" class="card">
                <header class="card__head">
                  <h4 class="card__label">{{ comp.name }}</h4>
                  <MTag>{{ comp.baseType }}</MTag>
                </header>
                <p class="card__desc">{{ comp.description || '—' }}</p>
                <div class="card__actions">
                  <MButton type="text" size="small" @click="onEdit(comp)">{{ t('common.edit') }}</MButton>
                  <MButton type="text" size="small" danger @click="onDelete(comp)">{{ t('common.delete') }}</MButton>
                </div>
              </section>
            </div>
          </div>
        </template>
      </MTabs>
    </div>

    <!-- 新建/编辑自定义组件 -->
    <MDialog v-model="dialogVisible" :title="editing && customs.some(c => c.id === editing!.id) ? t('components.editComponent') : t('components.newComponent')" width="520px">
      <MForm v-if="editing" :model="editing">
        <MFormItem :label="t('components.name')" required>
          <MInput v-model="editing.name" fluid />
        </MFormItem>
        <MFormItem :label="t('components.baseType')" required>
          <MSelect v-model="editing.baseType" :options="baseTypeOptions" fluid @update:model-value="onBaseTypeChange" />
        </MFormItem>
        <MFormItem :label="t('common.description')">
          <MInput v-model="editing.description" fluid />
        </MFormItem>
        <MFormItem :label="t('components.config')" :help="t('components.configTip')">
          <MTextarea v-model="configText" :rows="10" fluid />
        </MFormItem>
      </MForm>
      <template #footer>
        <MButton type="default" @click="dialogVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" @click="onSave">{{ t('common.save') }}</MButton>
      </template>
    </MDialog>
  </WorkspacePage>
</template>

<style lang="scss" scoped>
.components {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  &__tip {
    font-size: 13px;
    color: var(--m-color-text-muted);
    margin: 0;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  padding-top: 8px;
}

.card {
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label {
    font-size: 15px;
    font-weight: 700;
    color: var(--m-color-text);
    margin: 0;
  }

  &__desc {
    font-size: 13px;
    color: var(--m-color-text-muted);
    margin: 0;
    flex: 1;
  }

  &__preview {
    margin-top: 8px;
    pointer-events: none;
  }

  &__actions {
    display: flex;
    gap: 4px;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--m-color-split);
  }
}

.empty {
  padding: 40px 0;
}
</style>
