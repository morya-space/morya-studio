<script setup lang="ts">
/**
 * 设置（/settings）
 * 左侧导航 + 右侧居中内容卡，对齐 demos/settings.html 原型。
 * 仅实现可落地的部分：账户与安全 / 工作区 / 成员与权限 / 关于。
 * 通知、主题、时区/缓存等后端暂不支持，未实现。
 */

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  MButton,
  MDialog,
  MForm,
  MFormItem,
  MInput,
  MSelect,
  MTable,
  MTag,
  message,
  useConfirm,
  type TableColumnDefinition,
} from 'morya-ui'
import WorkspacePage from '../../components/shell/WorkspacePage.vue'
import SvgIcon from '../../components/common/SvgIcon.vue'
import { useSession } from '../../composables/useSession'
import { setLocale, supportedLocales, type AppLocale } from '../../locales'
import { updateProfile, changePassword, getWorkspace, saveWorkspace } from '../../services/settings'
import { listUsers, listRoles, createUser, setUserRoles, setUserStatus, deleteUser } from '../../services/identity'
import type { PublicUser, Role } from '@morya-studio/shared'

const { t, locale } = useI18n()
const router = useRouter()
const confirm = useConfirm()
const { user, setUser, logout } = useSession()

// ==================== 导航 ====================
type SectionKey = 'account' | 'workspace' | 'members' | 'about'
const activeSection = ref<SectionKey>('account')

const navItems = computed(() => [
  { key: 'account' as const, label: t('settings.accountTitle'), icon: 'user' },
  { key: 'workspace' as const, label: t('settings.workspaceTitle'), icon: 'box' },
  { key: 'members' as const, label: t('settings.membersTitle'), icon: 'users' },
  { key: 'about' as const, label: t('settings.aboutTitle'), icon: 'info' },
])

const initial = computed(() => user.value?.name.slice(0, 1) ?? 'M')

// ==================== 账户与安全 ====================
const displayName = ref('')
const avatar = ref('')
const savingProfile = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)

const email = computed(() => user.value?.email ?? '')
const plan = computed(() => 'Free')

// ==================== 工作区 ====================
const workspaceName = ref('Morya Studio')
const workspaceDescription = ref('')
const savingWorkspace = ref(false)

const currentLocale = computed({
  get: () => locale.value as AppLocale,
  set: (v: AppLocale) => setLocale(v),
})

// ==================== 成员与权限 ====================
const members = ref<PublicUser[]>([])
const roles = ref<Role[]>([])
const membersLoading = ref(false)
const savingMember = ref(false)

const addVisible = ref(false)
const addName = ref('')
const addEmail = ref('')
const addPassword = ref('')
const addRoleId = ref('')

const roleOptions = computed(() =>
  roles.value.map(r => ({ label: r.name, value: r.id })),
)

const isSelf = (m: PublicUser) => m.id === user.value?.id

function roleIdOf(m: PublicUser): string {
  const name = m.roles[0] ?? 'member'
  return roles.value.find(r => r.name === name)?.id ?? ''
}

const memberCols = computed<TableColumnDefinition[]>(() => [
  { key: 'member', label: t('settings.memberColumnMember'), minWidth: 220 },
  { key: 'role', label: t('settings.memberColumnRole'), width: 140 },
  { key: 'status', label: t('settings.memberColumnStatus'), width: 110 },
  { key: 'joined', label: t('settings.memberColumnJoined'), width: 130 },
  { key: 'actions', label: t('settings.memberColumnActions'), width: 160, align: 'end' },
])

// ==================== 关于 ====================
const techStack = ['Vue 3', 'TypeScript', 'Vite', 'ECharts', 'Pinia', 'Hono', 'MySQL']
const changelog = [
  { version: 'v0.2', date: '2026-10-16', items: ['Schema v0.2：数据转换管道 / 全局过滤器 / 页面主题覆盖', '新增文本卡与自定义逃生舱卡', '数据源支持 SQL / WebSocket / Mock 模板', '分享与发布：只读链接 + iframe 嵌入', '面板版本历史与回滚'] },
  { version: 'v0.1', date: '2026-09-30', items: ['低代码编辑器：拖拽搭建、属性面板、撤销重做', '渲染引擎 SchemaRenderer + 卡片注册表', '数据源管理、连接器导入向导', '面板 / 模板 / 组件库'] },
]

// ==================== 初始化 ====================
onMounted(async () => {
  displayName.value = user.value?.name ?? ''
  avatar.value = user.value?.avatar ?? ''
  try {
    const ws = await getWorkspace()
    if (ws.name) workspaceName.value = ws.name
    workspaceDescription.value = String(ws.data?.description ?? '')
  } catch { /* 忽略，用默认 */ }
  await loadMembers()
})

// ==================== 账户 ====================
async function onSaveProfile() {
  if (savingProfile.value) return
  savingProfile.value = true
  try {
    const updated = await updateProfile({ name: displayName.value.trim() || undefined, avatar: avatar.value.trim() })
    setUser(updated)
    message.success(t('settings.profileUpdated'))
  } catch {
    message.error(t('common.error'))
  } finally {
    savingProfile.value = false
  }
}

async function onChangePassword() {
  if (savingPassword.value) return
  if (newPassword.value !== confirmPassword.value) {
    message.error(t('settings.passwordMismatch'))
    return
  }
  savingPassword.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    message.success(t('settings.passwordUpdated'))
    currentPassword.value = newPassword.value = confirmPassword.value = ''
    // 后端已吊销会话，重新登录
    await logout()
    router.push('/login')
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    savingPassword.value = false
  }
}

// ==================== 工作区 ====================
async function onSaveWorkspace() {
  if (savingWorkspace.value) return
  savingWorkspace.value = true
  try {
    await saveWorkspace({
      name: workspaceName.value.trim(),
      data: { description: workspaceDescription.value.trim() },
    })
    message.success(t('settings.workspaceSaved'))
  } catch {
    message.error(t('common.error'))
  } finally {
    savingWorkspace.value = false
  }
}

// ==================== 成员 ====================
async function loadMembers() {
  membersLoading.value = true
  try {
    const [us, rs] = await Promise.all([listUsers(), listRoles()])
    members.value = us
    roles.value = rs
    if (!addRoleId.value && rs.length) addRoleId.value = rs.find(r => r.name !== 'admin')?.id ?? rs[0].id
  } catch {
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

function onRoleChange(m: PublicUser, roleId: string) {
  if (isSelf(m) || !roleId) return
  const role = roles.value.find(r => r.id === roleId)
  if (!role) return
  void setUserRoles(m.id, [roleId])
    .then(() => {
      m.roles = [role.name]
      message.success(t('settings.roleChanged', { name: m.name }))
    })
    .catch(() => message.error(t('common.error')))
}

function onToggleStatus(m: PublicUser) {
  if (isSelf(m)) return
  const next = m.status === 'active' ? 'disabled' : 'active'
  void setUserStatus(m.id, next)
    .then(() => {
      m.status = next
      message.success(t('settings.statusChanged', { name: m.name }))
    })
    .catch(() => message.error(t('common.error')))
}

async function onRemoveMember(m: PublicUser) {
  if (isSelf(m)) return
  const ok = await confirm.require({
    header: t('settings.confirmRemoveMemberTitle'),
    message: t('settings.confirmRemoveMemberMsg', { name: m.name }),
    acceptLabel: t('common.delete'),
    rejectLabel: t('common.cancel'),
    acceptColor: 'danger',
  })
  if (!ok) return
  try {
    await deleteUser(m.id)
    members.value = members.value.filter(x => x.id !== m.id)
    message.success(t('settings.memberRemoved', { name: m.name }))
  } catch {
    message.error(t('common.error'))
  }
}

function onOpenAddMember() {
  addName.value = ''
  addEmail.value = ''
  addPassword.value = ''
  if (!addRoleId.value && roles.value.length) addRoleId.value = roles.value[0].id
  addVisible.value = true
}

async function onAddMember() {
  if (savingMember.value) return
  if (!addName.value.trim()) { message.warn(t('settings.memberNameRequired')); return }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.value.trim())) { message.warn(t('settings.memberEmailInvalid')); return }
  if (addPassword.value.length < 4) { message.warn(t('settings.memberPasswordTooShort')); return }
  savingMember.value = true
  try {
    await createUser({
      name: addName.value.trim(),
      email: addEmail.value.trim(),
      password: addPassword.value,
      roleIds: addRoleId.value ? [addRoleId.value] : undefined,
    })
    addVisible.value = false
    message.success(t('settings.memberCreated'))
    await loadMembers()
  } catch (e) {
    message.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    savingMember.value = false
  }
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}
</script>

<template>
  <WorkspacePage :title="t('pages.settings.title')" :summary="t('pages.settings.summary')">
    <div class="settings-layout">
      <!-- 左侧导航 -->
      <aside class="settings-nav">
        <div class="settings-nav__user">
          <span class="settings-nav__avatar">{{ initial }}</span>
          <div class="settings-nav__meta">
            <span class="settings-nav__name">{{ user?.name ?? 'Member' }}</span>
            <span class="settings-nav__email">{{ email }}</span>
          </div>
        </div>

        <nav class="settings-nav__menu" aria-label="设置导航">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="settings-nav__item"
            :class="{ active: activeSection === item.key }"
            @click="activeSection = item.key"
          >
            <span class="settings-nav__icon"><SvgIcon :name="item.icon" :px="16" /></span>
            <span class="settings-nav__label">{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- 右侧内容：卡片居中 -->
      <main class="settings-content">
        <!-- ============ 账户与安全 ============ -->
        <section v-show="activeSection === 'account'" class="settings-card">
          <header class="settings-card__head">
            <span class="settings-card__icon"><SvgIcon name="user" :px="18" /></span>
            <div>
              <h3 class="settings-card__title">{{ t('settings.accountTitle') }}</h3>
              <p class="settings-card__desc">{{ t('settings.accountDesc') }}</p>
            </div>
          </header>
          <div class="settings-card__body">
            <MForm>
              <MFormItem :label="t('settings.email')">
                <MInput :model-value="email" type="email" readonly fluid />
              </MFormItem>
              <MFormItem :label="t('settings.displayName')">
                <MInput v-model="displayName" fluid />
              </MFormItem>
              <MFormItem :label="t('settings.avatar')">
                <MInput v-model="avatar" :placeholder="t('settings.avatarHint')" fluid />
              </MFormItem>
              <MFormItem :label="t('settings.plan')">
                <MInput :model-value="plan" readonly fluid />
              </MFormItem>
            </MForm>
            <div class="settings-card__actions">
              <MButton type="primary" :loading="savingProfile" @click="onSaveProfile">{{ t('settings.updateProfile') }}</MButton>
            </div>
          </div>
        </section>

        <section v-show="activeSection === 'account'" class="settings-card">
          <header class="settings-card__head">
            <span class="settings-card__icon"><SvgIcon name="lock" :px="18" /></span>
            <div>
              <h3 class="settings-card__title">{{ t('settings.changePassword') }}</h3>
              <p class="settings-card__desc">{{ t('settings.passwordHint') }}</p>
            </div>
          </header>
          <div class="settings-card__body">
            <MForm>
              <MFormItem :label="t('settings.currentPassword')">
                <MInput v-model="currentPassword" type="password" fluid />
              </MFormItem>
              <MFormItem :label="t('settings.newPassword')">
                <MInput v-model="newPassword" type="password" fluid />
              </MFormItem>
              <MFormItem :label="t('settings.confirmPassword')">
                <MInput v-model="confirmPassword" type="password" fluid />
              </MFormItem>
            </MForm>
            <div class="settings-card__actions">
              <MButton type="primary" :loading="savingPassword" @click="onChangePassword">{{ t('settings.changePassword') }}</MButton>
            </div>
          </div>
        </section>

        <!-- ============ 工作区 ============ -->
        <section v-show="activeSection === 'workspace'" class="settings-card">
          <header class="settings-card__head">
            <span class="settings-card__icon"><SvgIcon name="box" :px="18" /></span>
            <div>
              <h3 class="settings-card__title">{{ t('settings.workspaceTitle') }}</h3>
              <p class="settings-card__desc">{{ t('settings.workspaceDesc') }}</p>
            </div>
          </header>
          <div class="settings-card__body">
            <MForm>
              <MFormItem :label="t('settings.workspaceName')">
                <MInput v-model="workspaceName" fluid />
              </MFormItem>
              <MFormItem :label="t('settings.workspaceDescription')">
                <MInput v-model="workspaceDescription" :placeholder="t('settings.workspaceDescriptionHint')" fluid />
              </MFormItem>
              <MFormItem :label="t('settings.language')">
                <MSelect v-model="currentLocale" :options="supportedLocales" fluid />
              </MFormItem>
            </MForm>
            <div class="settings-card__actions">
              <MButton type="primary" :loading="savingWorkspace" @click="onSaveWorkspace">{{ t('settings.saveWorkspace') }}</MButton>
            </div>
          </div>
        </section>

        <!-- ============ 成员与权限 ============ -->
        <section v-show="activeSection === 'members'" class="settings-card settings-card--wide">
          <header class="settings-card__head">
            <span class="settings-card__icon"><SvgIcon name="users" :px="18" /></span>
            <div class="settings-card__head-main">
              <h3 class="settings-card__title">{{ t('settings.membersTitle') }}</h3>
              <p class="settings-card__desc">
                {{ t('settings.membersDesc') }}
              </p>
            </div>
            <MButton type="primary" class="settings-card__head-action" @click="onOpenAddMember">
              <SvgIcon name="plus" :px="14" /> {{ t('settings.addMember') }}
            </MButton>
          </header>
          <div class="settings-card__body">
            <MTable
              :columns="memberCols"
              :rows="members"
              row-key="id"
              :paginator="false"
              :loading="membersLoading"
              :empty-text="t('settings.noMembers')"
              fill
            >
              <template #cell-member="{ row }">
                <div class="member-cell">
                  <span class="member-cell__avatar">{{ (row.name || '?').slice(0, 1) }}</span>
                  <div class="member-cell__meta">
                    <span class="member-cell__name">
                      {{ row.name }}
                      <span v-if="isSelf(row)" class="member-cell__self">{{ t('settings.memberSelf') }}</span>
                    </span>
                    <span class="member-cell__email">{{ row.email }}</span>
                  </div>
                </div>
              </template>
              <template #cell-role="{ row }">
                <MSelect
                  :model-value="roleIdOf(row)"
                  :options="roleOptions"
                  :disabled="isSelf(row)"
                  fluid
                  @update:model-value="onRoleChange(row, $event as string)"
                />
              </template>
              <template #cell-status="{ row }">
                <MTag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'active' ? t('settings.memberStatusActive') : t('settings.memberStatusDisabled') }}
                </MTag>
              </template>
              <template #cell-joined="{ row }">
                <span class="member-cell__joined">{{ fmtDate(row.createdAt) }}</span>
              </template>
              <template #cell-actions="{ row }">
                <div class="member-actions">
                  <MButton type="text" size="small" :disabled="isSelf(row)" @click="onToggleStatus(row)">
                    {{ row.status === 'active' ? t('settings.memberDisable') : t('settings.memberEnable') }}
                  </MButton>
                  <MButton type="text" size="small" danger :disabled="isSelf(row)" @click="onRemoveMember(row)">
                    {{ t('common.delete') }}
                  </MButton>
                </div>
              </template>
            </MTable>

            <div class="roles-tips">
              <div v-for="role in roles" :key="role.id" class="role-tip">
                <b>{{ role.name }}</b>
                <p>{{ role.description }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ============ 关于 ============ -->
        <section v-show="activeSection === 'about'" class="settings-card settings-card--wide">
          <header class="settings-card__head">
            <span class="settings-card__icon"><SvgIcon name="info" :px="18" /></span>
            <div>
              <h3 class="settings-card__title">{{ t('settings.aboutTitle') }}</h3>
              <p class="settings-card__desc">{{ t('settings.aboutDesc') }}</p>
            </div>
          </header>
          <div class="settings-card__body">
            <div class="about-hero">
              <span class="about-hero__logo"><SvgIcon name="grid" :px="26" /></span>
              <div>
                <h3 class="about-hero__name">Morya Studio <span class="about-hero__tag">v0.2</span></h3>
                <p class="about-hero__desc">数据驱动的可视化看板搭建平台：多数据源接入、拖拽式编辑器、分享与发布。</p>
              </div>
            </div>

            <div class="about-section">
              <p class="about-section__title">{{ t('settings.techStack') }}</p>
              <div class="about-chips">
                <span v-for="s in techStack" :key="s" class="about-chip">{{ s }}</span>
              </div>
            </div>

            <div class="about-section">
              <p class="about-section__title">{{ t('settings.changelog') }}</p>
              <div class="timeline">
                <div v-for="c in changelog" :key="c.version" class="tl-item">
                  <span class="tl-dot" />
                  <div class="tl-body">
                    <b>{{ c.version }} <em>{{ c.date }}</em></b>
                    <ul>
                      <li v-for="(item, i) in c.items" :key="i">{{ item }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- 添加成员对话框 -->
    <MDialog v-model="addVisible" :title="t('settings.addMemberTitle')" width="460px">
      <MForm>
        <MFormItem :label="t('settings.memberName')" required>
          <MInput v-model="addName" fluid />
        </MFormItem>
        <MFormItem :label="t('settings.memberEmail')" required>
          <MInput v-model="addEmail" type="email" placeholder="name@company.com" fluid />
        </MFormItem>
        <MFormItem :label="t('settings.memberPassword')" required>
          <MInput v-model="addPassword" type="password" fluid />
        </MFormItem>
        <MFormItem :label="t('settings.memberRole')">
          <MSelect v-model="addRoleId" :options="roleOptions" fluid />
        </MFormItem>
      </MForm>
      <template #footer>
        <MButton type="default" @click="addVisible = false">{{ t('common.cancel') }}</MButton>
        <MButton type="primary" :loading="savingMember" @click="onAddMember">{{ t('common.save') }}</MButton>
      </template>
    </MDialog>
  </WorkspacePage>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  gap: 24px;
  max-width: 980px;
  margin: 0 auto;
  align-items: start;
}

/* ============ 左侧导航 ============ */
.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  position: sticky;
  top: 0;
}

.settings-nav__user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--m-color-split);
}

.settings-nav__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--m-color-surface);
  background: linear-gradient(135deg, var(--m-color-primary), var(--m-color-accent-blue));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--m-color-primary) 35%, transparent);
  flex-shrink: 0;
}

.settings-nav__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.settings-nav__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--m-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav__email {
  font-size: 12px;
  color: var(--m-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav__menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-nav__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-radius: var(--m-radius-md);
  background: transparent;
  color: var(--m-color-text-muted);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.settings-nav__item:hover {
  background: var(--m-color-fill-light);
  color: var(--m-color-text);
}

.settings-nav__item.active {
  background: linear-gradient(120deg, var(--m-color-primary), color-mix(in srgb, var(--m-color-primary) 70%, var(--m-color-accent-blue)));
  color: var(--m-color-surface);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--m-color-primary) 35%, transparent);
}

.settings-nav__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--m-radius-sm);
  background: color-mix(in srgb, currentColor 12%, transparent);
  flex-shrink: 0;
}

.settings-nav__item.active .settings-nav__icon {
  background: color-mix(in srgb, var(--m-color-surface) 18%, transparent);
}

.settings-nav__label {
  font-size: 13px;
  font-weight: 600;
}

/* ============ 右侧内容（卡片居中） ============ */
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-card {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  background: var(--m-color-surface);
  border-radius: var(--m-radius-lg);
  box-shadow: var(--m-shadow-card);
  overflow: hidden;
}

.settings-card--wide {
  max-width: 720px;
}

.settings-card__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 28px 0;
}

.settings-card__head-main {
  flex: 1;
  min-width: 0;
}

.settings-card__head-action {
  flex-shrink: 0;
}

.settings-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--m-radius-md);
  background: linear-gradient(135deg, color-mix(in srgb, var(--m-color-primary) 14%, transparent), color-mix(in srgb, var(--m-color-accent-blue) 14%, transparent));
  color: var(--m-color-primary);
  flex-shrink: 0;
}

.settings-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 4px;
}

.settings-card__desc {
  font-size: 13px;
  color: var(--m-color-text-muted);
  margin: 0;
}

.settings-card__body {
  padding: 22px 28px 28px;
}

.settings-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* ============ 成员 ============ */
.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-cell__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--m-color-surface);
  background: linear-gradient(135deg, var(--m-color-primary), var(--m-color-accent-blue));
  flex: none;
}

.member-cell__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-cell__name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--m-color-text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.member-cell__self {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}

.member-cell__email {
  font-size: 12px;
  color: var(--m-color-text-muted);
}

.member-cell__joined {
  font-size: 13px;
  color: var(--m-color-text-muted);
}

.member-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
}

.roles-tips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--m-color-split);
}

.role-tip {
  border: 1px solid var(--m-color-border);
  border-radius: var(--m-radius-md);
  padding: 12px 14px;
}

.role-tip b {
  font-size: 13px;
  font-weight: 700;
  color: var(--m-color-text);
  display: block;
  margin-bottom: 6px;
}

.role-tip p {
  font-size: 12px;
  color: var(--m-color-text-muted);
  line-height: 1.65;
  margin: 0;
}

/* ============ 关于 ============ */
.about-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--m-color-split);
}

.about-hero__logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: var(--m-color-surface);
  background: linear-gradient(135deg, var(--m-color-primary), var(--m-color-accent-blue));
  box-shadow: 0 8px 20px color-mix(in srgb, var(--m-color-primary) 30%, transparent);
  flex: none;
}

.about-hero__name {
  font-size: 17px;
  font-weight: 700;
  color: var(--m-color-text);
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 6px;
}

.about-hero__tag {
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-color-primary) 12%, transparent);
  color: var(--m-color-primary);
}

.about-hero__desc {
  font-size: 12.5px;
  color: var(--m-color-text-muted);
  line-height: 1.6;
  margin: 0;
}

.about-section {
  padding-top: 20px;
}

.about-section__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--m-color-text);
  margin: 0 0 12px;
}

.about-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.about-chip {
  font-size: 12.5px;
  padding: 5px 11px;
  border-radius: 999px;
  background: var(--m-color-fill-light);
  color: var(--m-color-text-muted);
  border: 1px solid var(--m-color-border);
}

.timeline {
  display: flex;
  flex-direction: column;
}

.tl-item {
  display: flex;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--m-color-split);
}

.tl-item:last-child {
  border-bottom: none;
}

.tl-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--m-color-primary);
  margin-top: 6px;
  flex: none;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--m-color-primary) 12%, transparent);
}

.tl-body {
  min-width: 0;
}

.tl-body b {
  font-size: 13.5px;
  color: var(--m-color-text);
  display: flex;
  align-items: center;
  gap: 9px;
}

.tl-body b em {
  font-style: normal;
  font-size: 11.5px;
  color: var(--m-color-text-muted);
  font-weight: 400;
}

.tl-body ul {
  margin: 6px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tl-body li {
  font-size: 12.5px;
  color: var(--m-color-text-muted);
  line-height: 1.7;
}

/* ============ 响应式 ============ */
@media (max-width: 860px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
  .settings-nav {
    position: static;
    flex-direction: row;
    align-items: center;
  }
  .settings-nav__menu {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
  }
  .settings-nav__user {
    border-bottom: none;
    border-right: 1px solid var(--m-color-split);
    padding-right: 16px;
    padding-bottom: 0;
  }
  .roles-tips {
    grid-template-columns: 1fr;
  }
}
</style>
