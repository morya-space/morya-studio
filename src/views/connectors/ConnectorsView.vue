<script setup lang="ts">
/**
 * 连接器（/connectors）
 * 把外部数据接入平台，落地为标准数据源：
 * - 文件上传：解析 CSV / JSON 生成 static 数据源（纯前端）。
 * - 数据库连接：经 REST 桥接 URL 连接，生成 api 数据源（直连 DB 需后端代理，预留）。
 */

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MButton, MFileUpload, MForm, MFormItem, MInput, MSelect, MTabs, message } from 'morya-ui'
import WorkspacePage from '../components/shell/WorkspacePage.vue'
import SvgIcon from '../components/common/SvgIcon.vue'
import { importRowsAsDataSource, importDatabaseAsDataSource, parseFileText } from '../services/connector'

const router = useRouter()
const { t } = useI18n()

const activeTab = ref('file')
const tabs = computed(() => [
  { label: t('connectors.fileTab'), value: 'file' },
  { label: t('connectors.dbTab'), value: 'db' },
])

// ---------- 文件上传 ----------
const fileName = ref('')
const dsName = ref('')
const parsedRows = ref<Record<string, unknown>[] | null>(null)
const importing = ref(false)

const previewRows = computed(() => (parsedRows.value ?? []).slice(0, 5))
const previewCols = computed(() => {
  const first = previewRows.value[0]
  return first ? Object.keys(first).slice(0, 6) : []
})

async function onSelect(files: File[]) {
  const file = files[0]
  if (!file) return
  fileName.value = file.name
  if (!dsName.value) dsName.value = file.name.replace(/\.[^.]+$/, '')
  try {
    const text = await file.text()
    parsedRows.value = parseFileText(file.name, text)
    if (parsedRows.value.length === 0) {
      message.warn(t('connectors.fileParseFail'))
      parsedRows.value = null
    } else {
      message.success(t('connectors.fileParsed', { n: parsedRows.value.length }))
    }
  } catch {
    parsedRows.value = null
    message.error(t('connectors.fileParseFail'))
  }
}

async function onImportFile() {
  if (!parsedRows.value || !fileName.value) {
    message.warn(t('connectors.fileEmpty'))
    return
  }
  importing.value = true
  try {
    const ds = importRowsAsDataSource(dsName.value.trim() || fileName.value.replace(/\.[^.]+$/, ''), parsedRows.value)
    message.success(t('connectors.fileImported', { title: ds.name }))
    resetFile()
    router.push('/datasources')
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('connectors.fileParseFail'))
  } finally {
    importing.value = false
  }
}

function resetFile() {
  fileName.value = ''
  dsName.value = ''
  parsedRows.value = null
}

// ---------- 数据库连接 ----------
const db = ref({
  name: '',
  driver: 'mysql' as 'mysql' | 'postgresql' | 'sqlserver' | 'rest',
  url: '',
  dataPath: '',
})
const dbImporting = ref(false)

const driverOptions = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQL Server', value: 'sqlserver' },
  { label: 'REST 桥接', value: 'rest' },
]

function onImportDb() {
  if (!db.value.url.trim()) {
    message.warn(t('connectors.dbUrlRequired'))
    return
  }
  dbImporting.value = true
  try {
    const ds = importDatabaseAsDataSource({
      name: db.value.name.trim(),
      driver: db.value.driver,
      url: db.value.url,
      dataPath: db.value.dataPath,
    })
    message.success(t('connectors.dbImported', { title: ds.name }))
    db.value = { name: '', driver: 'mysql', url: '', dataPath: '' }
    router.push('/datasources')
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  } finally {
    dbImporting.value = false
  }
}
</script>

<template>
  <WorkspacePage :title="t('pages.connectors.title')" :summary="t('pages.connectors.summary')">
    <div class="connectors">
      <MTabs v-model="activeTab" :tabs="tabs">
        <template #default="{ activeValue }">
          <!-- 文件上传 -->
          <div v-if="activeValue === 'file'" class="pane">
            <div class="pane__intro">
              <h3 class="pane__title">{{ t('connectors.fileTitle') }}</h3>
              <p class="pane__desc">{{ t('connectors.fileDesc') }}</p>
            </div>

            <MFileUpload
              drag
              accept=".csv,.json,.tsv,.txt"
              :max-size="5 * 1024 * 1024"
              :auto-upload="false"
              :show-file-list="false"
              @select="onSelect"
            >
              <div class="dropzone">
                <SvgIcon name="upload" :px="28" class="dropzone__icon" />
                <p class="dropzone__text">{{ t('connectors.fileDrop') }}</p>
                <p class="dropzone__tip">{{ t('connectors.fileTip') }}</p>
              </div>
            </MFileUpload>

            <div v-if="parsedRows" class="result">
              <MForm>
                <MFormItem :label="t('connectors.fileName')">
                  <MInput v-model="dsName" :placeholder="t('connectors.fileNamePlaceholder')" fluid />
                </MFormItem>
              </MForm>

              <div class="preview">
                <p class="preview__title">{{ t('connectors.previewTitle') }}</p>
                <div class="preview__table">
                  <div class="preview__row preview__row--head" :style="{ gridTemplateColumns: `repeat(${previewCols.length}, 1fr)` }">
                    <span v-for="col in previewCols" :key="col" class="preview__cell">{{ col }}</span>
                  </div>
                  <div v-for="(row, i) in previewRows" :key="i" class="preview__row" :style="{ gridTemplateColumns: `repeat(${previewCols.length}, 1fr)` }">
                    <span v-for="col in previewCols" :key="col" class="preview__cell">{{ row[col] }}</span>
                  </div>
                </div>
              </div>

              <div class="result__actions">
                <MButton type="default" @click="resetFile">{{ t('common.cancel') }}</MButton>
                <MButton type="primary" :loading="importing" @click="onImportFile">
                  {{ t('connectors.fileImport') }}
                </MButton>
              </div>
            </div>
          </div>

          <!-- 数据库连接 -->
          <div v-else class="pane">
            <div class="pane__intro">
              <h3 class="pane__title">{{ t('connectors.dbTitle') }}</h3>
              <p class="pane__desc">{{ t('connectors.dbDesc') }}</p>
            </div>

            <div class="db-form">
              <MForm :model="db">
                <MFormItem :label="t('connectors.dbDriver')">
                  <MSelect v-model="db.driver" :options="driverOptions" fluid />
                </MFormItem>
                <MFormItem :label="t('connectors.dbUrl')" required>
                  <MInput v-model="db.url" :placeholder="t('connectors.dbUrlPlaceholder')" fluid />
                </MFormItem>
                <MFormItem :label="t('connectors.dbDataPath')">
                  <MInput v-model="db.dataPath" :placeholder="t('connectors.dbDataPathPlaceholder')" fluid />
                </MFormItem>
                <MFormItem :label="t('connectors.dbName')">
                  <MInput v-model="db.name" :placeholder="t('connectors.dbNamePlaceholder')" fluid />
                </MFormItem>
              </MForm>

              <div class="db-form__actions">
                <MButton type="primary" :loading="dbImporting" @click="onImportDb">
                  {{ t('connectors.dbImport') }}
                </MButton>
              </div>
            </div>
          </div>
        </template>
      </MTabs>
    </div>
  </WorkspacePage>
</template>

<style scoped>
.connectors {
  max-width: 720px;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 8px;
}

.pane__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 4px;
}

.pane__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;
}

.dropzone__icon {
  color: var(--m-color-primary);
}

.dropzone__text {
  font-size: 14px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 0;
}

.dropzone__tip {
  font-size: 12px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-text);
  margin: 0 0 8px;
}

.preview__table {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  overflow: hidden;
}

.preview__row {
  display: grid;
  border-bottom: 1px solid var(--m-color-split);
}

.preview__row:last-child {
  border-bottom: none;
}

.preview__row--head {
  background: var(--m-color-page-bg);
  font-weight: 600;
}

.preview__cell {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result__actions,
.db-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.db-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
