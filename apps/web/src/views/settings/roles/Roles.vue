<script setup lang="ts">
import type { PermissionDefinition, Role } from '@morya-studio/shared'
import type { FormInstance, FormRules } from 'morya-ui'
import {
  MButton,
  MConfirmDialog,
  MDialog,
  message,
  MForm,
  MFormItem,
  MInput,
  MSpace,
  MTable,
  MTag,
  MTextarea,
  MTree,
} from 'morya-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../../../components/PageHeader.vue'
import { usePermission } from '../../../composables/usePermission'
import { formatDateTime } from '../../../lib/format'
import { asRow, asText } from '../../../lib/table'
import { createRole, deleteRole, fetchPermissions, fetchRoles, updateRole } from '../../../services/identity'

const { can } = usePermission()
const loading = ref(false)
const deleting = ref(false)
const rows = ref<Role[]>([])
const catalog = ref<PermissionDefinition[]>([])
const dialogVisible = ref(false)
const confirmVisible = ref(false)
const editing = ref<Role | null>(null)
const pendingDelete = ref<Role | null>(null)
const formRef = ref<FormInstance | null>(null)
const checkedKeys = ref<Record<string, boolean>>({})
const form = reactive({
  name: '',
  description: '',
})
const rules: FormRules = {
  name: { required: true, message: '请输入角色名称', trigger: ['blur', 'input'] },
}

const columns = [
  { key: 'name', label: '角色', minWidth: 140 },
  { key: 'description', label: '描述', minWidth: 180 },
  { key: 'permissions', label: '权限数', width: 100 },
  { key: 'userCount', label: '用户数', width: 100 },
  { key: 'createdAt', label: '创建时间', minWidth: 160 },
  { key: 'actions', label: '操作', width: 120 },
]

const permissionTree = computed(() => {
  const groups = new Map<string, { key: string; label: string; children: { key: string; label: string }[] }>()
  for (const item of catalog.value) {
    const group = groups.get(item.group) ?? { key: `group:${item.group}`, label: item.group, children: [] }
    group.children.push({ key: item.code, label: item.name })
    groups.set(item.group, group)
  }
  return [...groups.values()]
})

const selectedPermissions = computed(() =>
  Object.entries(checkedKeys.value)
    .filter(([, checked]) => checked)
    .map(([key]) => key)
    .filter(key => !key.startsWith('group:')),
)

async function load() {
  loading.value = true
  try {
    rows.value = await fetchRoles()
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '加载角色失败')
  }
  finally {
    loading.value = false
  }
}

function keysFromCodes(codes: string[]) {
  return Object.fromEntries(codes.map(code => [code, true]))
}

function openCreate() {
  editing.value = null
  form.name = ''
  form.description = ''
  checkedKeys.value = {}
  dialogVisible.value = true
}

function openEdit(row: Role) {
  editing.value = row
  form.name = row.name
  form.description = row.description
  checkedKeys.value = keysFromCodes(row.permissions)
  dialogVisible.value = true
}

async function saveRole() {
  const { valid } = await formRef.value!.validate()
  if (!valid)
    return false
  try {
    if (editing.value) {
      await updateRole(editing.value.id, {
        name: form.name,
        description: form.description,
        permissions: editing.value.isSystem ? undefined : selectedPermissions.value,
      })
      message.success('角色已更新')
    }
    else {
      await createRole({
        name: form.name,
        description: form.description,
        permissions: selectedPermissions.value,
      })
      message.success('角色已创建')
    }
    dialogVisible.value = false
    await load()
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
    return false
  }
}

function askDelete(row: Role) {
  pendingDelete.value = row
  confirmVisible.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value)
    return false
  deleting.value = true
  try {
    await deleteRole(pendingDelete.value.id)
    message.success('角色已删除')
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

onMounted(async () => {
  catalog.value = await fetchPermissions().catch(() => [])
  await load()
})
</script>

<template>
  <section class="page-section">
    <PageHeader title="角色管理" description="用角色组织权限。系统角色不能删除，权限由平台维护。">
      <template v-if="can('roles.write')" #actions>
        <MButton label="新建角色" icon="plus" @click="openCreate" />
      </template>
    </PageHeader>

    <MTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :paginator="false"
      striped
      show-overflow-tooltip
      row-key="id"
      empty-text="暂无角色"
      empty-description="创建自定义角色后，可在此分配权限并关联用户"
    >
      <template #cell-name="{ row }">
        <div class="name-cell">
          <strong>{{ row.name }}</strong>
          <MTag v-if="row.isSystem" value="系统" severity="secondary" size="small" />
        </div>
      </template>
      <template #cell-permissions="{ row }">
        {{ asRow<Role>(row).permissions.length }}
      </template>
      <template #cell-createdAt="{ row }">
        {{ formatDateTime(asText(row.createdAt)) }}
      </template>
      <template #cell-actions="{ row }">
        <MSpace :size="4" :wrap-item="false">
          <MButton
            v-if="can('roles.write')"
            text
            icon-only
            icon="edit"
            size="small"
            aria-label="编辑角色"
            @click="openEdit(asRow<Role>(row))"
          />
          <MButton
            v-if="can('roles.write') && !asRow<Role>(row).isSystem"
            text
            icon-only
            icon="trash"
            size="small"
            severity="danger"
            aria-label="删除角色"
            @click="askDelete(asRow<Role>(row))"
          />
        </MSpace>
      </template>
    </MTable>

    <MDialog
      v-model="dialogVisible"
      :header="editing ? '编辑角色' : '新建角色'"
      width="36rem"
      positive-text="保存"
      negative-text="取消"
      :on-positive-click="saveRole"
    >
      <MForm ref="formRef" :model="form" :rules="rules" label-position="top">
        <MFormItem label="名称" name="name">
          <template #default="{ id, invalid }">
            <MInput :id="id" v-model="form.name" fluid :invalid="invalid" :disabled="Boolean(editing?.isSystem)" />
          </template>
        </MFormItem>
        <MFormItem label="描述" name="description">
          <template #default="{ id }">
            <MTextarea :id="id" v-model="form.description" fluid :rows="3" autosize />
          </template>
        </MFormItem>
      </MForm>
      <p class="tree-label">
        {{ editing?.isSystem ? '系统角色权限由平台维护，这里仅可更新描述。' : '权限' }}
      </p>
      <MTree
        v-if="!editing?.isSystem"
        v-model:checked-keys="checkedKeys"
        :value="permissionTree"
        show-checkbox
        default-expand-all
      />
    </MDialog>

    <MConfirmDialog
      v-model="confirmVisible"
      header="删除角色"
      :message="`确定删除角色 ${pendingDelete?.name ?? ''} 吗？`"
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

.name-cell {
  display: flex;
  align-items: center;
  gap: var(--m-space-2);
}

.tree-label {
  margin: var(--m-space-3) 0 var(--m-space-2);
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-sm);
}
</style>
