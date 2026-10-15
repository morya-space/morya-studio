<script setup lang="ts">
/**
 * 模板（/templates）
 * 内置模板：预置看板，一键创建可编辑面板。
 * 我的模板：在「面板」中把面板存为模板，这里可复用 / 删除。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MButton, MCard, MEmpty, MTabs, message } from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import { buildDemoPage, demoDataSources } from '../../data/demoBoard'
import { savePage, genPageId } from '../../services/page'
import { saveDataSource, getDataSource } from '../../services/datasource'
import { listTemplates, deleteTemplate, type PanelTemplate } from '../../services/template'
import type { PageSchema } from '../../types/schema'
import { SCHEMA_VERSION } from '../../types/schema'

const { t } = useI18n()
const router = useRouter()

const activeTab = ref('builtin')
const tabs = computed(() => [
  { label: t('templates.builtinTab'), value: 'builtin' },
  { label: t('templates.customTab'), value: 'custom' },
])

interface BuiltinTemplate {
  key: string
  title: string
  description: string
  icon: string
  cardCount: number
  build: () => PageSchema
}

const builtinTemplates = computed<BuiltinTemplate[]>(() => [
  {
    key: 'blank',
    title: t('templates.blank'),
    description: t('templates.blankDesc'),
    icon: 'plus',
    cardCount: 0,
    build: () => ({
      id: genPageId(),
      title: t('templates.blank'),
      layout: 'grid',
      grid: { cols: 12, gap: 24 },
      cards: [],
      meta: { version: SCHEMA_VERSION, createdAt: new Date().toISOString() },
    }),
  },
  {
    key: 'sales',
    title: '销售分析看板',
    description: 'KPI + 趋势图 + 品类占比 + 订单表 + 热销榜，开箱即用',
    icon: 'bar-chart',
    cardCount: 7,
    build: () => {
      const p = buildDemoPage()
      p.id = genPageId()
      return p
    },
  },
])

const customs = ref<PanelTemplate[]>([])

function refreshCustoms() {
  customs.value = listTemplates()
}

onMounted(refreshCustoms)

function persistDemoDataSources() {
  for (const ds of demoDataSources) {
    if (!getDataSource(ds.id!)) saveDataSource(ds)
  }
}

function useBuiltin(tpl: BuiltinTemplate) {
  const page = tpl.build()
  persistDemoDataSources()
  savePage(page)
  message.success(t('templates.used', { title: tpl.title }))
  router.push(`/editor/${page.id}`)
}

function useCustom(tpl: PanelTemplate) {
  const page: PageSchema = JSON.parse(JSON.stringify(tpl.page)) as PageSchema
  page.id = genPageId()
  page.meta = { ...page.meta, version: SCHEMA_VERSION, createdAt: new Date().toISOString() }
  persistDemoDataSources()
  savePage(page)
  message.success(t('templates.used', { title: tpl.title }))
  router.push(`/editor/${page.id}`)
}

function onDeleteCustom(tpl: PanelTemplate) {
  deleteTemplate(tpl.id)
  refreshCustoms()
  message.success(t('templates.deleted', { title: tpl.title }))
}
</script>

<template>
  <WorkspacePage :title="t('pages.templates.title')" :summary="t('pages.templates.summary')">
    <MTabs v-model="activeTab" :tabs="tabs">
      <template #default="{ activeValue }">
        <!-- 内置模板 -->
        <div v-if="activeValue === 'builtin'" class="templates__grid">
          <MCard v-for="tpl in builtinTemplates" :key="tpl.key" class="template-card" shadow="hover">
            <div class="template-card__thumb">
              <SvgIcon :name="tpl.icon" :px="30" />
            </div>
            <h4 class="template-card__title">{{ tpl.title }}</h4>
            <p class="template-card__desc">{{ tpl.description }}</p>
            <div class="template-card__foot">
              <span class="template-card__count">{{ t('templates.cardCount', { n: tpl.cardCount }) }}</span>
              <MButton type="primary" size="small" @click="useBuiltin(tpl)">{{ t('templates.use') }}</MButton>
            </div>
          </MCard>
        </div>

        <!-- 我的模板 -->
        <div v-else>
          <div v-if="customs.length === 0" class="templates__empty">
            <MEmpty :title="t('templates.emptyCustom')" />
          </div>
          <div v-else class="templates__grid">
            <MCard v-for="tpl in customs" :key="tpl.id" class="template-card" shadow="hover">
              <div class="template-card__thumb">
                <SvgIcon :name="tpl.icon ?? 'layout'" :px="30" />
              </div>
              <h4 class="template-card__title">{{ tpl.title }}</h4>
              <p class="template-card__desc">{{ tpl.description || '—' }}</p>
              <div class="template-card__foot">
                <span class="template-card__count">{{ t('templates.cardCount', { n: tpl.cardCount }) }}</span>
                <div class="template-card__btns">
                  <MButton type="text" size="small" danger @click="onDeleteCustom(tpl)">{{ t('templates.delete') }}</MButton>
                  <MButton type="primary" size="small" @click="useCustom(tpl)">{{ t('templates.use') }}</MButton>
                </div>
              </div>
            </MCard>
          </div>
        </div>
      </template>
    </MTabs>
  </WorkspacePage>
</template>

<style scoped>
.templates__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding-top: 8px;
}

.templates__empty {
  padding: 40px 0;
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-card__thumb {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-radius-md);
  background: linear-gradient(135deg, color-mix(in srgb, var(--m-color-primary) 12%, transparent), color-mix(in srgb, var(--m-color-accent-blue) 12%, transparent));
  color: var(--m-color-primary);
  margin-bottom: 8px;
}

.template-card__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0;
}

.template-card__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
  flex: 1;
}

.template-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.template-card__btns {
  display: flex;
  align-items: center;
  gap: 4px;
}

.template-card__count {
  font-size: 12px;
  color: var(--m-color-text-muted);
}
</style>
