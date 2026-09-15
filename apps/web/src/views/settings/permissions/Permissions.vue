<script setup lang="ts">
import type { PermissionDefinition, Role } from '@morya-studio/shared'
import { MAccordion, MCard, message, MSkeleton, MSpace, MTag } from 'morya-ui'
import { computed, onMounted, ref, watch } from 'vue'
import PageHeader from '../../../components/PageHeader.vue'
import { fetchPermissions, fetchRoles } from '../../../services/identity'

const loading = ref(false)
const catalog = ref<PermissionDefinition[]>([])
const roles = ref<Role[]>([])
const activeGroups = ref<string[]>([])

const groups = computed(() => {
  const map = new Map<string, PermissionDefinition[]>()
  for (const item of catalog.value) {
    const list = map.get(item.group) ?? []
    list.push(item)
    map.set(item.group, list)
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }))
})

const accordionTabs = computed(() =>
  groups.value.map(group => ({
    value: group.name,
    header: `${group.name}（${group.items.length}）`,
  })),
)

function rolesFor(code: string) {
  return roles.value.filter(role => role.permissions.includes(code))
}

watch(
  groups,
  (value) => {
    if (!activeGroups.value.length && value.length)
      activeGroups.value = value.map(group => group.name)
  },
  { immediate: true },
)

onMounted(async () => {
  loading.value = true
  try {
    const [permissionItems, roleItems] = await Promise.all([
      fetchPermissions(),
      fetchRoles().catch(() => [] as Role[]),
    ])
    catalog.value = permissionItems
    roles.value = roleItems
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '加载权限失败')
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="page-section">
    <PageHeader title="权限管理" description="权限由系统预置，通过角色进行授予。这里用于核对目录和当前分配情况。" />

    <MCard v-if="loading" title="权限目录">
      <MSpace vertical :size="12" :wrap-item="false">
        <MSkeleton height="2.5rem" />
        <MSkeleton height="6rem" />
        <MSkeleton height="6rem" />
      </MSpace>
    </MCard>

    <MAccordion
      v-else-if="accordionTabs.length"
      v-model="activeGroups"
      multiple
      :tabs="accordionTabs"
    >
      <template v-for="group in groups" :key="group.name" #[group.name]>
        <div class="perm-list">
          <article v-for="item in group.items" :key="item.code" class="perm-item">
            <div>
              <div class="perm-title">
                <strong>{{ item.name }}</strong>
                <code>{{ item.code }}</code>
              </div>
              <p>{{ item.description }}</p>
            </div>
            <div class="tag-row">
              <MTag v-for="role in rolesFor(item.code)" :key="role.id" :value="role.name" severity="info" />
              <span v-if="!rolesFor(item.code).length" class="muted">暂无角色</span>
            </div>
          </article>
        </div>
      </template>
    </MAccordion>

    <MCard v-else title="权限目录">
      <p class="muted">
        暂无权限定义。
      </p>
    </MCard>
  </section>
</template>

<style scoped>
.page-section {
  display: grid;
  gap: var(--m-space-4);
  align-content: start;
}

.perm-list {
  display: grid;
  gap: var(--m-space-4);
}

.perm-item {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: var(--m-space-3);
  padding-bottom: var(--m-space-4);
  border-bottom: var(--m-border-width) solid var(--m-color-border);
}

.perm-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.perm-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--m-space-2);
}

.perm-item p,
.muted {
  margin: var(--m-space-1) 0 0;
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-sm);
}

code {
  color: var(--m-color-text-muted);
  font-size: var(--m-font-size-xs);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: var(--m-space-2);
}

@media (max-width: 840px) {
  .perm-item {
    grid-template-columns: 1fr;
  }
}
</style>
