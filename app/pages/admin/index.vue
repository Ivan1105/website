<template>
  <div class="admin-page site-container">
    <section class="admin-shell" aria-labelledby="admin-title">
      <header class="admin-heading">
        <p class="eyebrow">ADMIN / 管理</p>
        <h1 id="admin-title">管理页面<span>。</span></h1>
        <p class="muted">查看站点用户及账户状态。</p>
      </header>

      <v-card
        v-if="isAuthLoading"
        class="admin-card surface-card admin-state"
        aria-live="polite"
      >
        <v-progress-circular indeterminate color="primary" size="34" width="3" />
        <div>
          <h2>正在确认访问权限</h2>
          <p class="muted">请稍候，我们正在获取你的账户信息。</p>
        </div>
      </v-card>

      <v-card v-else-if="isAdmin" class="users-panel surface-card">
        <div class="users-toolbar">
          <div>
            <p class="eyebrow">USERS / 用户</p>
            <h2>用户列表</h2>
            <p class="muted">共 {{ pagination.total }} 位用户</p>
          </div>
          <v-btn to="/account" variant="text" color="secondary" prepend-icon="mdi-arrow-left">
            返回个人中心
          </v-btn>
        </div>

        <v-progress-linear
          v-if="usersLoading && users.length"
          indeterminate
          color="primary"
          height="3"
          aria-label="正在加载用户列表"
        />

        <div v-if="usersError" class="users-warning" role="alert">
          <v-icon icon="mdi-alert-circle-outline" size="20" aria-hidden="true" />
          <span>{{ usersError }}</span>
          <v-btn
            variant="text"
            color="secondary"
            size="small"
            prepend-icon="mdi-refresh"
            :loading="usersLoading"
            @click="loadUsers(pagination.page)"
          >
            重试
          </v-btn>
        </div>

        <div v-if="usersLoading && !users.length" class="users-state" aria-live="polite">
          <v-progress-circular indeterminate color="primary" size="34" width="3" />
          <div>
            <h3>正在加载用户</h3>
            <p class="muted">请稍候，我们正在获取用户列表。</p>
          </div>
        </div>

        <div v-else-if="!users.length && !usersError" class="users-state">
          <span class="state-icon" aria-hidden="true">
            <v-icon icon="mdi-account-search-outline" size="30" />
          </span>
          <div>
            <h3>暂无用户</h3>
            <p class="muted">当前没有可展示的用户记录。</p>
          </div>
        </div>

        <div v-else-if="users.length" class="users-table" :aria-busy="usersLoading">
          <div class="users-table-header" aria-hidden="true">
            <span>用户</span>
            <span>用户 ID</span>
            <span>角色</span>
            <span>状态</span>
            <span>最后登录</span>
            <span>操作</span>
          </div>

          <article v-for="user in users" :key="user.user_id" class="user-row">
            <div class="user-identity">
              <v-avatar size="44" color="surface-variant" class="user-avatar">
                <v-img v-if="assetUrl(user.avatar, 'icon')" :src="assetUrl(user.avatar, 'icon')" :alt="`${user.username} 的头像`" cover>
                  <template #error><v-icon icon="mdi-account-outline" size="24" /></template>
                </v-img>
                <v-icon v-else icon="mdi-account-outline" size="24" aria-hidden="true" />
              </v-avatar>
              <div class="user-identity-text">
                <strong>{{ user.nickname || user.username }}</strong>
                <span>@{{ user.username }}</span>
              </div>
            </div>

            <div class="user-field">
              <span class="user-field-label">用户 ID</span>
              <span class="user-id">{{ user.user_id }}</span>
            </div>

            <div class="user-field">
              <span class="user-field-label">角色</span>
              <v-chip
                :color="user.role === 'admin' ? 'primary' : undefined"
                size="small"
                variant="tonal"
              >
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </v-chip>
            </div>

            <div class="user-field status-field">
              <span class="user-field-label">状态</span>
              <v-switch
                v-if="user.role !== 'admin'"
                :key="`${user.user_id}-${user.is_active}-${activeControlVersion}`"
                class="status-switch"
                :class="{ 'status-switch-inactive': !user.is_active }"
                :model-value="user.is_active"
                color="primary"
                :loading="activeLoading && activeTarget?.user_id === user.user_id"
                :disabled="activeLoading"
                size="small"
                density="compact"
                hide-details
                :aria-label="`${user.username} 当前${user.is_active ? '已启用，点击停用' : '已停用，点击启用'}`"
                :title="user.is_active ? '已启用，点击停用' : '已停用，点击启用'"
                @update:model-value="value => openActiveConfirm(user, value)"
              />
              <v-switch
                v-else
                class="status-switch status-switch-readonly"
                :class="{ 'status-switch-inactive': !user.is_active }"
                :model-value="user.is_active"
                color="primary"
                size="small"
                density="compact"
                hide-details
                disabled
                :aria-label="`${user.username} 当前${user.is_active ? '已启用' : '已停用'}，不可修改`"
                :title="`${user.is_active ? '已启用' : '已停用'}，管理员状态不可修改`"
              />
            </div>

            <div class="user-field user-last-login">
              <span class="user-field-label">最后登录</span>
              <span>{{ formatLastLogin(user.last_login_time) }}</span>
            </div>

            <div class="user-actions">
              <v-btn
                v-if="user.role !== 'admin'"
                variant="outlined"
                color="error"
                size="small"
                prepend-icon="mdi-lock-reset"
                @click="openResetConfirm(user)"
              >
                重置密码
              </v-btn>
            </div>
          </article>
        </div>

        <div v-if="pagination.total > PAGE_SIZE" class="users-pagination">
          <span>第 {{ pagination.page + 1 }} / {{ totalPages }} 页</span>
          <v-pagination
            :model-value="pagination.page + 1"
            :length="totalPages"
            :disabled="usersLoading"
            :total-visible="5"
            density="comfortable"
            rounded="circle"
            aria-label="用户列表分页"
            @update:model-value="handlePageChange"
          />
        </div>
      </v-card>

      <v-card v-else class="admin-card surface-card admin-state" role="alert">
        <span class="state-icon state-icon-error" aria-hidden="true">
          <v-icon icon="mdi-shield-lock-outline" size="32" />
        </span>
        <div>
          <p class="eyebrow">ACCESS DENIED</p>
          <h2>无权访问管理页面</h2>
          <p class="muted">此页面仅限管理员访问。</p>
        </div>
        <v-btn to="/account" color="primary" size="large" prepend-icon="mdi-arrow-left">
          返回个人中心
        </v-btn>
      </v-card>
    </section>

    <v-dialog v-model="activeConfirmOpen" :persistent="activeLoading" max-width="500">
      <v-card class="operation-dialog" :title="`确认${pendingActive ? '启用' : '停用'}用户`">
        <v-card-text v-if="activeTarget" class="reset-dialog-content">
          <span
            class="active-dialog-icon"
            :class="pendingActive ? 'active-dialog-icon-enable' : 'active-dialog-icon-disable'"
            aria-hidden="true"
          >
            <v-icon :icon="pendingActive ? 'mdi-account-check-outline' : 'mdi-account-off-outline'" size="30" />
          </span>
          <div>
            <p>
              确认{{ pendingActive ? '启用' : '停用' }}
              <strong>{{ activeTarget.nickname || activeTarget.username }}</strong>
              （@{{ activeTarget.username }}）吗？
            </p>
            <p class="muted">
              {{ pendingActive ? '启用后，该用户可恢复正常登录。' : '停用后，该用户可能无法继续登录。' }}
            </p>
          </div>
          <p v-if="activeError" class="reset-error" role="alert">{{ activeError }}</p>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="activeLoading" @click="closeActiveConfirm">取消</v-btn>
          <v-btn
            :color="pendingActive ? 'success' : 'error'"
            :loading="activeLoading"
            :disabled="activeLoading"
            @click="confirmUpdateActive"
          >
            确认{{ pendingActive ? '启用' : '停用' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="resetConfirmOpen" :persistent="resetLoading" max-width="500">
      <v-card class="reset-dialog" title="确认重置密码">
        <v-card-text v-if="resetTarget" class="reset-dialog-content">
          <span class="reset-dialog-icon" aria-hidden="true">
            <v-icon icon="mdi-lock-alert-outline" size="30" />
          </span>
          <div>
            <p>
              确认重置 <strong>{{ resetTarget.nickname || resetTarget.username }}</strong>
              （@{{ resetTarget.username }}）的密码吗？
            </p>
            <p class="muted">当前密码将立即失效，此操作无法撤销。</p>
          </div>
          <p v-if="resetError" class="reset-error" role="alert">{{ resetError }}</p>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="resetLoading" @click="closeResetConfirm">取消</v-btn>
          <v-btn color="error" :loading="resetLoading" :disabled="resetLoading" @click="confirmResetPassword">
            确认重置
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="resetResultOpen" persistent max-width="540">
      <v-card class="reset-dialog" title="密码重置成功">
        <v-card-text class="reset-result-content">
          <span class="reset-success-icon" aria-hidden="true">
            <v-icon icon="mdi-check-circle-outline" size="32" />
          </span>
          <div>
            <p v-if="resetResultUser">
              <strong>{{ resetResultUser.nickname || resetResultUser.username }}</strong>
              （@{{ resetResultUser.username }}）的临时密码已生成。
            </p>
            <p class="muted">该密码仅显示一次，请复制并安全地提供给用户。</p>
          </div>

          <v-text-field
            :model-value="temporaryPassword"
            label="临时密码"
            readonly
            hide-details
            class="temporary-password-field"
          >
            <template #append-inner>
              <v-btn
                :icon="copySucceeded ? 'mdi-check' : 'mdi-content-copy'"
                variant="text"
                width="44"
                height="44"
                :color="copySucceeded ? 'success' : 'secondary'"
                aria-label="复制临时密码"
                title="复制临时密码"
                @click="copyTemporaryPassword"
              />
            </template>
          </v-text-field>

          <p
            v-if="copyMessage"
            class="copy-message"
            :class="{ 'copy-message-error': !copySucceeded }"
            :role="copySucceeded ? 'status' : 'alert'"
          >
            {{ copyMessage }}
          </p>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="closeResetResult">我已保存，关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="activeSuccess" color="success" location="bottom" :timeout="2500">
      {{ activeSuccessMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { isApiError, useAdminApi, type AdminPaginationDTO, type AdminUserDTO } from '@/api'
import { useAuthSession } from '@/composables/useAuthSession'
import { useAppStore } from '@/stores/app'

const PAGE_SIZE = 20
const USERS_ERROR = '暂时无法加载用户列表，请稍后重试。'
const RESET_PASSWORD_ERROR = '暂时无法重置密码，请稍后重试。'
const UPDATE_ACTIVE_ERROR = '暂时无法更新用户状态，请稍后重试。'

const appStore = useAppStore()
const { adminApi } = useAdminApi()
const { initializeAuth } = useAuthSession()
const { assetUrl } = useAssetUrl()

const users = ref<AdminUserDTO[]>([])
const usersLoading = ref(false)
const usersError = ref<string | null>(null)
const activeConfirmOpen = ref(false)
const activeTarget = ref<AdminUserDTO | null>(null)
const pendingActive = ref(false)
const activeLoading = ref(false)
const activeError = ref<string | null>(null)
const activeSuccess = ref(false)
const activeSuccessMessage = ref('用户状态已更新')
const activeControlVersion = ref(0)
const resetConfirmOpen = ref(false)
const resetTarget = ref<AdminUserDTO | null>(null)
const resetLoading = ref(false)
const resetError = ref<string | null>(null)
const resetResultOpen = ref(false)
const resetResultUser = ref<AdminUserDTO | null>(null)
const temporaryPassword = ref('')
const copyMessage = ref('')
const copySucceeded = ref(false)
const pagination = ref<AdminPaginationDTO>({
  page: 0,
  page_size: PAGE_SIZE,
  total: 0,
  has_more: false,
})

const isAuthLoading = computed(() => !appStore.authInitialized || appStore.userInfoLoading)
const isAdmin = computed(() => appStore.isLoggedIn && appStore.userInfo?.role === 'admin')
const totalPages = computed(() => Math.max(1, Math.ceil(pagination.value.total / pagination.value.page_size)))

useSeoMeta({ title: '管理页面 · Ivan1105' })

const formatLastLogin = (value: string | null) => {
  if (!value) return '从未登录'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const loadUsers = async (page: number) => {
  if (!isAdmin.value || usersLoading.value || !appStore.token) return

  const requestedToken = appStore.token
  usersLoading.value = true
  usersError.value = null

  try {
    const result = await adminApi.queryUsers(page, PAGE_SIZE)
    if (appStore.token !== requestedToken || !isAdmin.value) return

    users.value = result.users
    pagination.value = result.pagination
  } catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      users.value = []
      return
    }

    usersError.value = isApiError(error) ? error.message : USERS_ERROR
    console.warn('[admin] queryUsers failed', error)
  } finally {
    usersLoading.value = false
  }
}

const handlePageChange = (page: number) => {
  const apiPage = page - 1
  if (apiPage === pagination.value.page || usersLoading.value) return
  void loadUsers(apiPage)
}

const openActiveConfirm = (user: AdminUserDTO, active: boolean | null) => {
  if (user.role === 'admin' || activeLoading.value || typeof active !== 'boolean' || active === user.is_active) return

  activeTarget.value = user
  pendingActive.value = active
  activeError.value = null
  activeControlVersion.value += 1
  activeConfirmOpen.value = true
}

const closeActiveConfirm = () => {
  if (activeLoading.value) return

  activeConfirmOpen.value = false
  activeTarget.value = null
  activeError.value = null
}

const confirmUpdateActive = async () => {
  const user = activeTarget.value
  if (!user || user.role === 'admin' || activeLoading.value || !appStore.token) return

  const requestedToken = appStore.token
  const nextActive = pendingActive.value
  activeLoading.value = true
  activeError.value = null

  try {
    await adminApi.updateActive(user.user_id, { active: nextActive })
    if (appStore.token !== requestedToken || !isAdmin.value) return

    users.value = users.value.map(item => item.user_id === user.user_id
      ? { ...item, is_active: nextActive }
      : item)
    activeSuccessMessage.value = `${user.nickname || user.username} 已${nextActive ? '启用' : '停用'}`
    activeSuccess.value = true
    activeConfirmOpen.value = false
    activeTarget.value = null
  } catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      activeConfirmOpen.value = false
      activeTarget.value = null
      return
    }

    activeError.value = isApiError(error) ? error.message : UPDATE_ACTIVE_ERROR
  } finally {
    activeLoading.value = false
  }
}

const openResetConfirm = (user: AdminUserDTO) => {
  if (user.role === 'admin' || resetLoading.value) return

  resetTarget.value = user
  resetError.value = null
  resetConfirmOpen.value = true
}

const closeResetConfirm = () => {
  if (resetLoading.value) return

  resetConfirmOpen.value = false
  resetTarget.value = null
  resetError.value = null
}

const confirmResetPassword = async () => {
  const user = resetTarget.value
  if (!user || user.role === 'admin' || resetLoading.value || !appStore.token) return

  const requestedToken = appStore.token
  resetLoading.value = true
  resetError.value = null

  try {
    const result = await adminApi.resetPassword(user.user_id)
    if (appStore.token !== requestedToken || !isAdmin.value) return

    temporaryPassword.value = result.temporary_password
    resetResultUser.value = user
    copyMessage.value = ''
    copySucceeded.value = false
    resetConfirmOpen.value = false
    resetTarget.value = null
    resetResultOpen.value = true
  } catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      resetConfirmOpen.value = false
      resetTarget.value = null
      return
    }

    resetError.value = isApiError(error) ? error.message : RESET_PASSWORD_ERROR
  } finally {
    resetLoading.value = false
  }
}

const copyTemporaryPassword = async () => {
  if (!temporaryPassword.value) return

  copyMessage.value = ''
  copySucceeded.value = false

  try {
    if (!import.meta.client || !navigator.clipboard) {
      throw new Error('Clipboard API unavailable')
    }

    await navigator.clipboard.writeText(temporaryPassword.value)
    copySucceeded.value = true
    copyMessage.value = '临时密码已复制。'
  } catch {
    copyMessage.value = '复制失败，请手动选择并复制临时密码。'
  }
}

const closeResetResult = () => {
  resetResultOpen.value = false
  resetResultUser.value = null
  temporaryPassword.value = ''
  copyMessage.value = ''
  copySucceeded.value = false
}

watch(resetConfirmOpen, (open) => {
  if (!open && !resetLoading.value) {
    resetTarget.value = null
    resetError.value = null
  }
})

watch(activeConfirmOpen, (open) => {
  if (!open && !activeLoading.value) {
    activeTarget.value = null
    activeError.value = null
  }
})

onMounted(async () => {
  await initializeAuth()
  if (isAdmin.value) {
    await loadUsers(0)
  }
})
</script>

<style scoped>
.admin-page {
  padding-block: 64px 88px;
}

.admin-shell {
  width: 100%;
  min-height: calc(100dvh - var(--site-nav-height) - 152px);
  margin-inline: auto;
}

.admin-heading {
  display: flow-root;
  margin-bottom: var(--site-space-4);
}

.admin-heading .eyebrow {
  margin: 0;
}

.admin-heading h1 {
  margin: 10px 0 0;
  font-size: clamp(2.15rem, 5vw, 3.5rem);
  font-weight: 550;
  line-height: 1.2;
  letter-spacing: -0.045em;
}

.admin-heading h1 span {
  color: var(--site-accent);
}

.admin-heading .muted {
  margin: 12px 0 0;
}

.admin-card {
  padding: clamp(24px, 5vw, 44px);
}

.users-panel {
  overflow: hidden;
}

.users-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--site-space-3);
  padding: clamp(24px, 4vw, 36px);
  border-bottom: 1px solid var(--site-border);
}

.users-toolbar .eyebrow,
.users-toolbar h2,
.users-toolbar .muted {
  margin: 0;
}

.users-toolbar h2 {
  margin-top: 4px;
  color: var(--site-text);
  font-size: 1.5rem;
}

.users-toolbar .muted {
  margin-top: 4px;
  font-size: 0.9rem;
}

.users-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: var(--site-space-3);
  padding: 12px 14px;
  border: 1px solid rgb(var(--v-theme-error) / 30%);
  border-radius: var(--site-radius);
  background: rgb(var(--v-theme-error) / 7%);
  color: var(--site-muted);
}

.users-warning span {
  flex: 1;
}

.users-state {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--site-space-3);
  padding: var(--site-space-4);
  text-align: left;
}

.users-state h3,
.users-state p {
  margin: 0;
}

.users-state h3 {
  color: var(--site-text);
  font-size: 1.25rem;
}

.users-state p {
  margin-top: 4px;
}

.users-table {
  opacity: 1;
  transition: opacity var(--site-transition);
}

.users-table[aria-busy="true"] {
  opacity: 0.65;
}

.users-table-header,
.user-row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 90px 110px 72px minmax(150px, 0.7fr) 120px;
  align-items: center;
  gap: var(--site-space-2);
  padding-inline: clamp(24px, 4vw, 36px);
}

.users-table-header {
  min-height: 48px;
  color: var(--site-muted);
  background: var(--site-soft);
  font-size: 0.75rem;
  font-weight: 700;
}

.user-row {
  min-height: 82px;
  border-bottom: 1px solid var(--site-border);
}

.user-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  flex: 0 0 auto;
  color: var(--site-accent);
}

.user-identity > text {
  min-width: 0;
  display: grid;
}

.user-identity strong,
.user-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-identity strong {
  color: var(--site-text);
}

.user-identity span,
.user-last-login,
.user-id {
  color: var(--site-muted);
  font-size: 0.85rem;
}

.user-field {
  min-width: 0;
}

.status-field {
  min-height: 40px;
  display: flex;
  align-items: center;
}

.status-field :deep(.v-switch) {
  width: max-content;
  justify-self: start;
}

.status-switch-inactive :deep(.v-switch__track) {
  background-color: rgba(var(--v-theme-on-surface), 0.24) !important;
}

.user-field-label {
  display: none;
}

.user-actions {
  min-height: 36px;
  display: flex;
  align-items: center;
}

.users-pagination {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-3);
  padding: 12px clamp(24px, 4vw, 36px);
  color: var(--site-muted);
  font-size: 0.85rem;
}

.reset-dialog,
.operation-dialog {
  border: 1px solid var(--site-border);
}

.reset-dialog-content,
.reset-result-content {
  display: grid;
  gap: var(--site-space-3);
}

.reset-dialog-content p,
.reset-result-content p {
  margin: 0;
}

.reset-dialog-content .muted,
.reset-result-content .muted {
  margin-top: 6px;
}

.reset-dialog-icon,
.reset-success-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
}

.reset-dialog-icon {
  background: rgb(var(--v-theme-error) / 10%);
  color: rgb(var(--v-theme-error));
}

.reset-success-icon {
  background: rgb(var(--v-theme-success) / 10%);
  color: rgb(var(--v-theme-success));
}

.active-dialog-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
}

.active-dialog-icon-enable {
  background: rgb(var(--v-theme-success) / 10%);
  color: rgb(var(--v-theme-success));
}

.active-dialog-icon-disable {
  background: rgb(var(--v-theme-error) / 10%);
  color: rgb(var(--v-theme-error));
}

.reset-error,
.copy-message-error {
  color: rgb(var(--v-theme-error));
}

.temporary-password-field :deep(input) {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
}

.copy-message {
  color: rgb(var(--v-theme-success));
  font-size: 0.875rem;
}

.admin-state {
  min-height: 310px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: var(--site-space-3);
}

.admin-state h2 {
  margin-top: 6px;
  color: var(--site-text);
  font-size: clamp(1.4rem, 3vw, 1.9rem);
}

.admin-state .muted {
  margin-top: 8px;
}

.state-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--site-soft);
  color: var(--site-accent);
}

.state-icon-error {
  background: rgb(var(--v-theme-error) / 10%);
  color: rgb(var(--v-theme-error));
}

@media (max-width: 600px) {
  .admin-page {
    padding-block: 40px 64px;
  }

  .admin-heading {
    margin-bottom: var(--site-space-3);
  }

  .users-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .users-toolbar .v-btn {
    align-self: flex-start;
  }

  .users-warning {
    align-items: flex-start;
    flex-wrap: wrap;
    margin: var(--site-space-2);
  }

  .users-warning .v-btn {
    margin-left: 26px;
  }

  .users-state {
    min-height: 260px;
    align-items: flex-start;
    flex-direction: column;
  }

  .users-table-header {
    display: none;
  }

  .user-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: var(--site-space-2);
    padding-block: var(--site-space-3);
  }

  .user-identity {
    grid-column: 1 / -1;
  }

  .user-field {
    display: grid;
    align-content: start;
    gap: 5px;
  }

  .user-field .v-chip {
    justify-self: start;
  }

  .user-field-label {
    display: block;
    color: var(--site-muted);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .user-last-login {
    grid-column: 1 / -1;
  }

  .user-actions {
    grid-column: 1 / -1;
  }

  .user-actions .v-btn {
    width: 100%;
  }

  .users-pagination {
    align-items: stretch;
    flex-direction: column;
  }

  .users-pagination > span {
    text-align: center;
  }

  .admin-state .v-btn {
    width: 100%;
  }
}
</style>
