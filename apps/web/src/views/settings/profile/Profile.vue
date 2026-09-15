<script setup lang="ts">
import type { FormInstance, FormRules } from 'morya-ui'
import { MButton, MCard, message, MForm, MFormItem, MInput, MTag } from 'morya-ui'
import { reactive, ref, watch } from 'vue'
import PageHeader from '../../../components/PageHeader.vue'
import { usePermission } from '../../../composables/usePermission'
import { formatDateTime } from '../../../lib/format'
import { updateProfile, useAuth } from '../../../services/auth'

const { user } = useAuth()
const { can } = usePermission()
const formRef = ref<FormInstance | null>(null)
const saving = ref(false)
const model = reactive({ name: user.value?.name ?? '' })
const rules: FormRules = {
  name: { required: true, message: '请输入姓名', trigger: ['blur', 'input'] },
}

watch(() => user.value?.name, (name) => {
  if (name)
    model.name = name
})

async function onSubmit() {
  const { valid } = await formRef.value!.validate()
  if (!valid)
    return
  saving.value = true
  try {
    await updateProfile(model.name)
    message.success('个人资料已更新')
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="page-section">
    <PageHeader title="个人资料" description="查看账号信息，并更新对外显示的姓名。" />
    <div class="profile-grid">
      <MCard title="基本信息" subtitle="对外展示名称可随时更新，邮箱由系统维护。">
        <MForm
          ref="formRef"
          class="profile-form"
          :model="model"
          :rules="rules"
          label-position="top"
          validate-on="submit"
          @submit="onSubmit"
        >
          <MFormItem label="姓名" name="name">
            <template #default="{ id, invalid }">
              <MInput :id="id" v-model="model.name" fluid :invalid="invalid" :disabled="!can('profile.write')" />
            </template>
          </MFormItem>
          <MFormItem label="邮箱">
            <MInput :model-value="user?.email" fluid disabled />
          </MFormItem>
          <div class="form-actions">
            <MButton
              v-if="can('profile.write')"
              native-type="submit"
              label="保存"
              :loading="saving"
            />
          </div>
        </MForm>
      </MCard>

      <MCard title="账号状态" subtitle="角色与状态由管理员维护。">
        <dl class="meta-list">
          <div>
            <dt>状态</dt>
            <dd>
              <MTag
                :value="user?.status === 'active' ? '启用' : '禁用'"
                :severity="user?.status === 'active' ? 'success' : 'secondary'"
              />
            </dd>
          </div>
          <div>
            <dt>角色</dt>
            <dd class="tag-row">
              <MTag v-for="role in user?.roles ?? []" :key="role.id" :value="role.name" severity="info" />
              <span v-if="!user?.roles?.length" class="muted">暂无角色</span>
            </dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{{ formatDateTime(user?.createdAt) }}</dd>
          </div>
        </dl>
      </MCard>
    </div>
  </section>
</template>

<style scoped>
.page-section {
  display: grid;
  gap: var(--m-space-4);
  align-content: start;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 0.8fr);
  gap: var(--m-space-4);
}

.profile-form {
  max-width: 28rem;
}

.form-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: var(--m-space-2);
}

.meta-list {
  margin: 0;
  display: grid;
  gap: var(--m-space-4);
}

.meta-list dt {
  margin: 0 0 var(--m-space-1);
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-sm);
}

.meta-list dd {
  margin: 0;
  color: var(--m-color-text);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--m-space-2);
}

.muted {
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-sm);
}

@media (max-width: 960px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
