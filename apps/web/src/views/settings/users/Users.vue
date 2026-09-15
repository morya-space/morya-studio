<script setup lang="ts">
import type { Role, UserRecord, UserStatus } from '@morya-studio/shared'
import type { FormInstance, FormRules } from 'morya-ui'
import {
  MButton,
  MConfirmDialog,
  MDialog,
  message,
  MForm,
  MFormItem,
  MIcon,
  MIconField,
  MInput,
  MSelect,
  MSpace,
  MSwitch,
  MTable,
  MTag,
} from 'morya-ui'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import PageHeader from '../../../components/PageHeader.vue'
import { usePermission } from '../../../composables/usePermission'
import { formatDateTime } from '../../../lib/format'
import { asRow, asText } from '../../../lib/table'
import { useAuth } from '../../../services/auth'
import { createUser, deleteUser, fetchRoles, fetchUsers, updateUser } from '../../../services/identity'

const { can } = usePermission()
const { user: currentUser } = useAuth()
const loading = ref(false)
const deleting = ref(false)
const rows = ref<UserRecord[]>([])
const roles = ref<Role[]>([])
const total = ref(0)
const query = ref('')
const statusFilter = ref<'all' | UserStatus>('all')
const page = ref(1)
const pageSize = 10
const dialogVisible = ref(false)
const confirmVisible = ref(false)
const editing = ref<UserRecord | null>(null)
const pendingDelete = ref<UserRecord | null>(null)
const formRef = ref<FormInstance | null>(null)
const form = reactive({
  name: '',
  email: '',
  password: '',
  status: 'active' as UserStatus,
  roleIds: [] as string[],
})

const statusActive = computed({
  get: () => form.status === 'active',
  set: (value: boolean) => {
    form.status = value ? 'active' : 'disabled'
  },
})

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

const formRules: FormRules = {
  name: { required: true, message: '请输入姓名', trigger: ['blur', 'input'] },
  email: { required: true, message: '请输入邮箱', trigger: 'blur' },
  password: {
    validator: (value: unknown) => Boolean(editing.value) || (typeof value === 'string' && value.length >= 6),
    message: '密码至少需要 6 位',
    trigger: 'blur',
  },
  roleIds: {
    validator: (value: unknown) => Array.isArray(value) && value.length >= 1,
    message: '请选择角色',
    trigger: 'change',
  },
}

const columns = [
  { key: 'name', label: '姓名', minWidth: 120 },
  { key: 'email', label: '邮箱', minWidth: 180 },
  { key: 'status', label: '状态', width: 100 },
  { key: 'roles', label: '角色', minWidth: 180 },
  { key: 'createdAt', label: '创建时间', minWidth: 160 },
  { key: 'actions', label: '操作', width: 120 },
]

async function load() {
  loading.value = true
  try {
    const result = await fetchUsers({ query: query.value, status: statusFilter.value, page: page.value, pageSize })
    rows.value = result.items
    total.value = result.meta.total
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '加载用户失败')
  }
  finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.name = ''
  form.email = ''
  form.password = ''
  form.status = 'active'
  form.roleIds = roles.value[0] ? [roles.value[0].id] : []
  dialogVisible.value = true
}

function openEdit(row: UserRecord) {
  editing.value = row
  form.name = row.name
  form.email = row.email
  form.password = ''
  form.status = row.status
  form.roleIds = row.roles.map(role => role.id)
  dialogVisible.value = true
}

async function saveUser() {
  const { valid } = await formRef.value!.validate()
  if (!valid)
    return false
  try {
    if (editing.value) {
      await updateUser(editing.value.id, {
        name: form.name,
        email: form.email,
        status: form.status,
        roleIds: form.roleIds,
      })
      message.success('用户已更新')
    }
    else {
      await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        status: form.status,
        roleIds: form.roleIds,
      })
      message.success('用户已创建')
    }
    dialogVisible.value = false
    await load()
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
    return false
  }
}

function askDelete(row: UserRecord) {
  pendingDelete.value = row
  confirmVisible.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value)
    return false
  deleting.value = true
  try {
    await deleteUser(pendingDelete.value.id)
    message.success('用户已删除')
    await load()
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
    return false
  }
  finally {
    deleting.value = false
  }
}

watch([query, statusFilter], () => {
  page.value = 1
  void load()
})

onMounted(async () => {
  roles.value = await fetchRoles().catch(() => [])
  await load()
})
</script>

<template>
  <section class="page-section">
    <PageHeader title="用户管理" description="维护平台账号、分配角色并启用或禁用登录。">
      <template v-if="can('users.write')" #actions>
        <MButton label="新建用户" icon="plus" @click="openCreate" />
      </template>
    </PageHeader>

    <div class="filters">
      <MSpace wrap align="center" :size="12" :wrap-item="false">
        <MIconField class="search-field">
          <template #icon>
            <MIcon name="search" size="sm" />
          </template>
          <MInput v-model="query" placeholder="搜索姓名或邮箱" clearable fluid aria-label="搜索用户" />
        </MIconField>
        <MSelect v-model="statusFilter" class="status-filter" :options="statusOptions" aria-label="状态筛选" />
      </MSpace>
    </div>

    <MTable
      v-model:page="page"
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :paginator="true"
      :rows-per-page="pageSize"
      :server-items-length="total"
      striped
      show-overflow-tooltip
      row-key="id"
      empty-text="暂无用户"
      empty-description="创建账号或调整筛选条件后会显示在这里"
      @update:page="load"
    >
      <template #cell-status="{ row }">
        <MTag
          :value="asRow<UserRecord>(row).status === 'active' ? '启用' : '禁用'"
          :severity="asRow<UserRecord>(row).status === 'active' ? 'success' : 'secondary'"
        />
      </template>
      <template #cell-roles="{ row }">
        <div class="tag-row">
          <MTag v-for="role in asRow<UserRecord>(row).roles" :key="role.id" :value="role.name" severity="info" />
        </div>
      </template>
      <template #cell-createdAt="{ row }">
        {{ formatDateTime(asText(row.createdAt)) }}
      </template>
      <template #cell-actions="{ row }">
        <MSpace :size="4" :wrap-item="false">
          <MButton
            v-if="can('users.write')"
            text
            icon-only
            icon="edit"
            size="small"
            aria-label="编辑用户"
            @click="openEdit(asRow<UserRecord>(row))"
          />
          <MButton
            v-if="can('users.write') && asRow<UserRecord>(row).id !== currentUser?.id"
            text
            icon-only
            icon="trash"
            size="small"
            severity="danger"
            aria-label="删除用户"
            @click="askDelete(asRow<UserRecord>(row))"
          />
        </MSpace>
      </template>
    </MTable>

    <MDialog
      v-model="dialogVisible"
      :header="editing ? '编辑用户' : '新建用户'"
      width="32rem"
      positive-text="保存"
      negative-text="取消"
      :on-positive-click="saveUser"
    >
      <MForm ref="formRef" :model="form" :rules="formRules" label-position="top">
        <MFormItem label="姓名" name="name">
          <template #default="{ id, invalid }">
            <MInput :id="id" v-model="form.name" fluid :invalid="invalid" />
          </template>
        </MFormItem>
        <MFormItem label="邮箱" name="email">
          <template #default="{ id, invalid }">
            <MInput :id="id" v-model="form.email" type="email" fluid :invalid="invalid" />
          </template>
        </MFormItem>
        <MFormItem v-if="!editing" label="初始密码" name="password">
          <template #default="{ id, invalid }">
            <MInput :id="id" v-model="form.password" type="password" fluid :invalid="invalid" />
          </template>
        </MFormItem>
        <MFormItem label="账号状态" name="status">
          <MSwitch v-model="statusActive" checked-text="启用" unchecked-text="禁用" />
        </MFormItem>
        <MFormItem label="角色" name="roleIds">
          <MSelect
            v-model="form.roleIds"
            multiple
            fluid
            :options="roles.map(role => ({ label: role.name, value: role.id }))"
          />
        </MFormItem>
      </MForm>
    </MDialog>

    <MConfirmDialog
      v-model="confirmVisible"
      header="删除用户"
      :message="`确定删除 ${pendingDelete?.name ?? ''} 吗？此操作不可撤销。`"
      accept-label="删除"
      reject-label="取消"
      accept-severity="danger"
      type="error"
      :loading="deleting"
      :before-accept="confirmDelete"
    />
  </section>
</template>

<style scoped>
.page-section {
  display: grid;
  gap: var(--m-space-4);
  align-content: start;
}

.filters {
  padding: var(--m-space-4);
  background: color-mix(in srgb, var(--m-color-border) 25%, transparent);
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
}

.search-field {
  width: min(24rem, 100%);
}

.status-filter {
  width: 10rem;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--m-space-2);
}

@media (max-width: 48rem) {
  .status-filter {
    width: 100%;
  }
}
</style>
