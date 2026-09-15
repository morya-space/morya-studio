<script setup lang="ts">
import type { AuthSession, LoginEvent } from '@morya-studio/shared'
import type { FormInstance, FormRules } from 'morya-ui'
import {
  MButton,
  MCard,
  MDivider,
  message,
  MForm,
  MFormItem,
  MInputPassword,
  MTable,
  MTag,
} from 'morya-ui'
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../../../components/PageHeader.vue'
import { usePermission } from '../../../composables/usePermission'
import { formatDateTime, summarizeUserAgent } from '../../../lib/format'
import { asRow, asText } from '../../../lib/table'
import { changePassword } from '../../../services/auth'
import { fetchLoginEvents, fetchSessions, revokeOtherSessions, revokeSession } from '../../../services/identity'

const { can } = usePermission()
const formRef = ref<FormInstance | null>(null)
const saving = ref(false)
const sessions = ref<AuthSession[]>([])
const events = ref<LoginEvent[]>([])
const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const rules: FormRules = {
  currentPassword: { required: true, message: '请输入当前密码', trigger: 'blur' },
  newPassword: { required: true, min: 6, message: '新密码至少需要 6 位', trigger: 'blur' },
  confirmPassword: {
    validator: () => form.newPassword === form.confirmPassword,
    message: '两次输入的密码不一致',
    trigger: 'blur',
  },
}

const sessionColumns = [
  { key: 'device', label: '设备', minWidth: 140 },
  { key: 'ip', label: 'IP', minWidth: 120 },
  { key: 'lastSeenAt', label: '最近活动', minWidth: 160 },
  { key: 'current', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100 },
]

const eventColumns = [
  { key: 'createdAt', label: '时间', minWidth: 160 },
  { key: 'email', label: '账号', minWidth: 180 },
  { key: 'success', label: '结果', width: 100 },
  { key: 'ip', label: 'IP', minWidth: 120 },
  { key: 'userAgent', label: '客户端', minWidth: 140 },
]

async function load() {
  try {
    const [sessionItems, eventResult] = await Promise.all([
      fetchSessions(),
      fetchLoginEvents({ page: 1, pageSize: 10 }),
    ])
    sessions.value = sessionItems
    events.value = eventResult.items
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '加载安全信息失败')
  }
}

async function onSubmit() {
  const { valid } = await formRef.value!.validate()
  if (!valid)
    return
  saving.value = true
  try {
    await changePassword(form.currentPassword, form.newPassword)
    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    message.success('密码已更新，其他会话已退出')
    await load()
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '修改密码失败')
  }
  finally {
    saving.value = false
  }
}

async function removeSession(id: string) {
  try {
    await revokeSession(id)
    message.success('会话已注销')
    await load()
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

async function removeOthers() {
  try {
    await revokeOtherSessions()
    message.success('其他会话已全部注销')
    await load()
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-section">
    <PageHeader title="安全设置" description="修改密码、管理登录会话，并查看最近的登录记录。" />

    <MCard title="修改密码" subtitle="更新后其他设备上的登录会话会被强制退出。">
      <MForm
        ref="formRef"
        class="password-form"
        :model="form"
        :rules="rules"
        label-position="top"
        :disabled="!can('security.write')"
        @submit="onSubmit"
      >
        <MFormItem label="当前密码" name="currentPassword">
          <template #default="{ id, invalid }">
            <MInputPassword :id="id" v-model="form.currentPassword" fluid :invalid="invalid" />
          </template>
        </MFormItem>
        <MFormItem label="新密码" name="newPassword">
          <template #default="{ id, invalid }">
            <MInputPassword :id="id" v-model="form.newPassword" fluid :invalid="invalid" feedback />
          </template>
        </MFormItem>
        <MFormItem label="确认新密码" name="confirmPassword">
          <template #default="{ id, invalid }">
            <MInputPassword :id="id" v-model="form.confirmPassword" fluid :invalid="invalid" />
          </template>
        </MFormItem>
        <div class="form-actions">
          <MButton
            v-if="can('security.write')"
            native-type="submit"
            label="更新密码"
            :loading="saving"
          />
        </div>
      </MForm>
    </MCard>

    <MDivider />

    <MCard title="登录会话">
      <template #header>
        <div class="card-header">
          <div>
            <h3>登录会话</h3>
            <p>查看当前账号的活跃会话，并注销可疑设备。</p>
          </div>
          <MButton
            v-if="can('security.write')"
            label="注销其他会话"
            severity="secondary"
            outlined
            @click="removeOthers"
          />
        </div>
      </template>
      <MTable
        :columns="sessionColumns"
        :rows="sessions"
        :paginator="false"
        striped
        show-overflow-tooltip
        row-key="id"
        empty-text="暂无会话"
        empty-description="登录后这里会显示当前与其他设备会话"
      >
        <template #cell-device="{ row }">
          {{ summarizeUserAgent(asText(row.userAgent)) }}
        </template>
        <template #cell-ip="{ row }">
          {{ asText(row.ip) || '—' }}
        </template>
        <template #cell-lastSeenAt="{ row }">
          {{ formatDateTime(asText(row.lastSeenAt)) }}
        </template>
        <template #cell-current="{ row }">
          <MTag
            :value="asRow<AuthSession>(row).current ? '当前' : '其他'"
            :severity="asRow<AuthSession>(row).current ? 'success' : 'secondary'"
          />
        </template>
        <template #cell-actions="{ row }">
          <MButton
            v-if="can('security.write') && !asRow<AuthSession>(row).current"
            text
            icon-only
            icon="external-link"
            size="small"
            severity="danger"
            aria-label="注销会话"
            @click="removeSession(asRow<AuthSession>(row).id)"
          />
        </template>
      </MTable>
    </MCard>

    <MCard title="最近登录" subtitle="仅展示最近 10 条登录尝试。">
      <MTable
        :columns="eventColumns"
        :rows="events"
        :paginator="false"
        striped
        show-overflow-tooltip
        row-key="id"
        empty-text="暂无登录记录"
        empty-description="成功或失败的登录尝试会记录在这里"
      >
        <template #cell-createdAt="{ row }">
          {{ formatDateTime(asText(row.createdAt)) }}
        </template>
        <template #cell-success="{ row }">
          <MTag
            :value="asRow<LoginEvent>(row).success ? '成功' : '失败'"
            :severity="asRow<LoginEvent>(row).success ? 'success' : 'danger'"
          />
        </template>
        <template #cell-userAgent="{ row }">
          {{ summarizeUserAgent(asText(row.userAgent)) }}
        </template>
      </MTable>
    </MCard>
  </section>
</template>

<style scoped>
.page-section {
  display: grid;
  gap: var(--m-space-4);
  align-content: start;
}

.password-form {
  max-width: 28rem;
}

.form-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: var(--m-space-2);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--m-space-3);
  width: 100%;
}

.card-header h3 {
  margin: 0;
  font-size: var(--m-font-size-md);
  font-weight: 600;
  color: var(--m-color-text);
}

.card-header p {
  margin: var(--m-space-1) 0 0;
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-sm);
}

@media (max-width: 48rem) {
  .card-header {
    flex-direction: column;
  }
}
</style>
