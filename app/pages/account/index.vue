<template>
  <div class="account-page site-container">
    <section class="account-shell" aria-labelledby="account-title">
      <header class="account-heading">
        <p class="eyebrow">ACCOUNT / 账户</p>
        <h1 id="account-title">个人中心<span>。</span></h1>
        <p class="muted">查看你的账户资料与登录状态。</p>
      </header>

      <v-card
        v-if="isInitialLoading"
        class="account-card surface-card account-state"
        aria-live="polite"
      >
        <v-progress-circular indeterminate color="primary" size="34" width="3" />
        <div>
          <h2>正在加载账户资料</h2>
          <p class="muted">请稍候，我们正在获取你的最新信息。</p>
        </div>
      </v-card>

      <v-card v-else-if="!appStore.isLoggedIn" class="account-card surface-card account-state">
        <span class="state-icon" aria-hidden="true">
          <v-icon icon="mdi-account-lock-outline" size="30" />
        </span>
        <div>
          <p class="eyebrow">SIGN IN REQUIRED</p>
          <h2>请先登录</h2>
          <p class="muted">登录后即可查看你的账户资料。</p>
        </div>
        <v-btn to="/login" color="primary" size="large" append-icon="mdi-arrow-right">前往登录</v-btn>
      </v-card>

      <v-card v-else-if="!accountInfo" class="account-card surface-card account-state" role="alert">
        <span class="state-icon state-icon-error" aria-hidden="true">
          <v-icon icon="mdi-alert-circle-outline" size="30" />
        </span>
        <div>
          <p class="eyebrow">ACCOUNT UNAVAILABLE</p>
          <h2>暂时无法加载账户资料</h2>
          <p class="muted">{{ accountError || '请稍后重新加载。' }}</p>
        </div>
        <v-btn
          color="primary"
          size="large"
          :loading="accountLoading"
          prepend-icon="mdi-refresh"
          @click="loadAccountInfo"
        >
          重新加载
        </v-btn>
      </v-card>

      <v-card v-else class="profile-card surface-card">
        <div class="profile-banner">
          <v-img v-if="accountBannerUrl" :src="accountBannerUrl" alt="" cover>
            <template #error><div class="profile-banner-fallback" /></template>
          </v-img>
          <div v-else class="profile-banner-fallback" />
          <v-btn
            class="banner-edit-button"
            icon="mdi-camera-outline"
            :loading="bannerSaving"
            :disabled="bannerSaving"
            aria-label="修改背景图"
            title="修改背景图"
            @click="openBannerFilePicker"
          />
          <input
            ref="banner-file-input"
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            tabindex="-1"
            @change="handleBannerFileChange"
          >
        </div>

        <div class="profile-content">
          <div class="profile-summary">
            <div class="account-avatar-editor">
              <v-avatar size="88" color="surface-variant" class="account-avatar">
                <v-img v-if="accountAvatarUrl" :src="accountAvatarUrl" :alt="`${displayName} 的头像`" cover>
                  <template #error><v-icon icon="mdi-account-outline" size="42" /></template>
                </v-img>
                <v-icon v-else icon="mdi-account-outline" size="42" aria-hidden="true" />
              </v-avatar>
              <v-btn
                class="avatar-edit-button"
                icon="mdi-camera-outline"
                aria-label="修改头像"
                title="修改头像"
                @click="openAvatarFilePicker"
              />
              <input
                ref="avatar-file-input"
                class="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                tabindex="-1"
                @change="handleAvatarFileChange"
              >
            </div>

            <div class="profile-identity">
              <div class="profile-meta-row">
                <p class="eyebrow">CURRENT ACCOUNT</p>
                <v-chip
                  v-if="appStore.userInfo?.role === 'admin'"
                  color="primary"
                  size="x-small"
                  variant="tonal"
                >
                  管理员
                </v-chip>
              </div>
              <div class="profile-name-row">
                <h2>{{ displayName }}</h2>
                <v-btn
                  variant="text"
                  color="secondary"
                  size="small"
                  icon="mdi-pencil-outline"
                  aria-label="修改昵称"
                  title="修改昵称"
                  @click="openEditor('nickname')"
                />
              </div>
              <p class="profile-username">@{{ accountInfo.username }}</p>
            </div>
          </div>

          <div class="profile-signature">
            <p>{{ accountInfo.signature || '未设置个性签名' }}</p>
            <v-btn
              variant="text"
              color="secondary"
              size="small"
              icon="mdi-pencil-outline"
              aria-label="修改个性签名"
              title="修改个性签名"
              @click="openEditor('signature')"
            />
          </div>

          <div v-if="accountError" class="account-warning" role="status">
            <v-icon icon="mdi-alert-circle-outline" size="20" aria-hidden="true" />
            <span>{{ accountError }} 当前展示的是上次加载的信息。</span>
            <v-btn
              variant="text"
              color="secondary"
              size="small"
              :loading="accountLoading"
              prepend-icon="mdi-refresh"
              @click="loadAccountInfo"
            >
              重试
            </v-btn>
          </div>
          <v-progress-linear
            v-else-if="accountLoading"
            class="account-progress"
            indeterminate
            color="primary"
            height="3"
            aria-label="正在刷新账户资料"
          />

          <dl class="account-details">
            <div>
              <dt><v-icon icon="mdi-email-outline" size="19" aria-hidden="true" /> 邮箱</dt>
              <dd>
                <span class="detail-value">
                  <a v-if="accountInfo.email" :href="`mailto:${accountInfo.email}`">{{ accountInfo.email }}</a>
                  <span v-else>未设置邮箱</span>
                  <v-btn
                    variant="text"
                    color="secondary"
                    size="small"
                    icon="mdi-pencil-outline"
                    aria-label="修改邮箱"
                    title="修改邮箱"
                    @click="openEditor('email')"
                  />
                </span>
              </dd>
            </div>
            <div>
              <dt><v-icon icon="mdi-lock-outline" size="19" aria-hidden="true" /> 密码</dt>
              <dd>
                <span class="detail-value">
                  <span class="password-value">
                    <span class="password-mask" aria-hidden="true">••••••••</span>
                    <span class="sr-only">密码已设置</span>
                  </span>
                  <v-btn
                    variant="text"
                    color="secondary"
                    size="small"
                    icon="mdi-pencil-outline"
                    aria-label="修改密码"
                    title="修改密码"
                    @click="openPasswordEditor"
                  />
                </span>
              </dd>
            </div>
          </dl>

          <section class="notification-setting" aria-labelledby="desktop-notification-title">
            <div class="notification-setting-copy">
              <span class="notification-setting-icon" aria-hidden="true">
                <v-icon icon="mdi-bell-outline" size="21" />
              </span>
              <div>
                <h3 id="desktop-notification-title">桌面通知</h3>
                <p>{{ desktopNotificationDescription }}</p>
              </div>
            </div>
            <v-switch
              :model-value="notificationStore.desktopEnabled"
              color="primary"
              hide-details
              :disabled="desktopNotificationsDisabled"
              :loading="pushBusy"
              aria-label="桌面通知"
              @update:model-value="updateDesktopNotifications"
            />
          </section>

          <div class="account-actions">
            <div class="account-action-buttons">
              <v-btn
                v-if="appStore.userInfo?.role === 'admin'"
                to="/admin"
                color="primary"
                size="large"
                prepend-icon="mdi-shield-account-outline"
              >
                管理页面
              </v-btn>
              <v-btn variant="outlined" color="secondary" size="large" prepend-icon="mdi-logout" @click="handleLogout">
                退出登录
              </v-btn>
            </div>
            <nuxt-link to="/" class="back-home">
              <v-icon icon="mdi-arrow-left" size="16" /> 返回首页
            </nuxt-link>
          </div>
        </div>
      </v-card>
    </section>

    <v-dialog v-model="editorOpen" :persistent="editorSaving" max-width="520">
      <v-card class="profile-editor" :title="`修改${editorConfig.label}`">
        <v-form @submit.prevent="saveEditor">
          <v-card-text>
            <v-textarea
              v-if="editorField === 'signature'"
              v-model="editorValue"
              :label="editorConfig.label"
              :placeholder="editorConfig.placeholder"
              :maxlength="editorConfig.maxLength"
              :counter="editorConfig.maxLength"
              :error-messages="editorMessages"
              rows="4"
              auto-grow
              autofocus
              :disabled="editorSaving"
            />
            <v-text-field
              v-else
              v-model="editorValue"
              :label="editorConfig.label"
              :placeholder="editorConfig.placeholder"
              :maxlength="editorConfig.maxLength"
              :counter="editorConfig.maxLength"
              :error-messages="editorMessages"
              :type="editorField === 'email' ? 'email' : 'text'"
              :autocomplete="editorField === 'email' ? 'email' : 'off'"
              autofocus
              :disabled="editorSaving"
            />
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="editorSaving" @click="closeEditor">取消</v-btn>
            <v-btn color="primary" type="submit" :loading="editorSaving" :disabled="!canSaveEditor">
              保存
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="passwordEditorOpen" :persistent="passwordSaving" max-width="520">
      <v-card class="profile-editor" title="修改密码">
        <v-form @submit.prevent="savePassword">
          <v-card-text class="password-form">
            <v-text-field
              v-model="passwordForm.currentPassword"
              label="当前密码"
              placeholder="请输入当前密码"
              :type="passwordVisibility.currentPassword ? 'text' : 'password'"
              autocomplete="current-password"
              maxlength="255"
              :error-messages="passwordMessages.currentPassword"
              autofocus
              :disabled="passwordSaving"
              @blur="passwordTouched.currentPassword = true"
            >
              <template #append-inner>
                <v-btn
                  :icon="passwordVisibility.currentPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  variant="text"
                  width="44"
                  height="44"
                  :aria-label="passwordVisibility.currentPassword ? '隐藏当前密码' : '显示当前密码'"
                  :aria-pressed="passwordVisibility.currentPassword"
                  :disabled="passwordSaving"
                  @click="passwordVisibility.currentPassword = !passwordVisibility.currentPassword"
                />
              </template>
            </v-text-field>

            <v-text-field
              v-model="passwordForm.password"
              label="新密码"
              placeholder="请输入至少 8 位的新密码"
              :type="passwordVisibility.password ? 'text' : 'password'"
              autocomplete="new-password"
              maxlength="255"
              :error-messages="passwordMessages.password"
              :disabled="passwordSaving"
              @blur="passwordTouched.password = true"
            >
              <template #append-inner>
                <v-btn
                  :icon="passwordVisibility.password ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  variant="text"
                  width="44"
                  height="44"
                  :aria-label="passwordVisibility.password ? '隐藏新密码' : '显示新密码'"
                  :aria-pressed="passwordVisibility.password"
                  :disabled="passwordSaving"
                  @click="passwordVisibility.password = !passwordVisibility.password"
                />
              </template>
            </v-text-field>

            <v-text-field
              v-model="passwordForm.confirmPassword"
              label="重复新密码"
              placeholder="请再次输入新密码"
              :type="passwordVisibility.confirmPassword ? 'text' : 'password'"
              autocomplete="new-password"
              maxlength="255"
              :error-messages="passwordMessages.confirmPassword"
              :disabled="passwordSaving"
              @blur="passwordTouched.confirmPassword = true"
            >
              <template #append-inner>
                <v-btn
                  :icon="passwordVisibility.confirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  variant="text"
                  width="44"
                  height="44"
                  :aria-label="passwordVisibility.confirmPassword ? '隐藏重复密码' : '显示重复密码'"
                  :aria-pressed="passwordVisibility.confirmPassword"
                  :disabled="passwordSaving"
                  @click="passwordVisibility.confirmPassword = !passwordVisibility.confirmPassword"
                />
              </template>
            </v-text-field>

            <p v-if="passwordError" class="password-error" role="alert">{{ passwordError }}</p>
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="passwordSaving" @click="closePasswordEditor">取消</v-btn>
            <v-btn color="primary" type="submit" :loading="passwordSaving" :disabled="!canSavePassword">
              保存
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <AvatarCropDialog
      v-model="avatarCropOpen"
      :image-src="avatarSourceUrl"
      :loading="avatarSaving"
      :error="avatarError"
      @confirm="saveAvatar"
      @replace="openAvatarFilePicker"
    />

    <v-snackbar v-model="updateSuccess" color="success" location="bottom" :timeout="2500">
      {{ updateSuccessText }}
    </v-snackbar>
    <v-snackbar v-model="imageNotice" color="error" location="bottom" :timeout="3500">
      {{ imageNoticeText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { isApiError, useAccountApi, useCommonApi, type AccountInfoDTO, type UpdateAccountInfoReq } from '@/api'
import { useAuthSession } from '@/composables/useAuthSession'
import { useAppStore } from '@/stores/app'

const ACCOUNT_INFO_ERROR = '暂时无法加载账户资料，请稍后重试。'
const UPDATE_ACCOUNT_ERROR = '暂时无法修改账户资料，请稍后重试。'
const MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type EditableField = 'nickname' | 'email' | 'signature'
type PasswordField = 'currentPassword' | 'password' | 'confirmPassword'

interface EditorConfig {
  label: string
  placeholder: string
  maxLength: number
}

const editorConfigs: Record<EditableField, EditorConfig> = {
  nickname: {
    label: '昵称',
    placeholder: '请输入昵称',
    maxLength: 64,
  },
  email: {
    label: '邮箱',
    placeholder: 'user@example.com',
    maxLength: 255,
  },
  signature: {
    label: '个性签名',
    placeholder: '写下一句介绍自己的话',
    maxLength: 255,
  },
}

const appStore = useAppStore()
const { accountApi } = useAccountApi()
const { commonApi } = useCommonApi()
const { initializeAuth, logout } = useAuthSession()
const {
  store: notificationStore,
  permission: desktopPermission,
  pushBusy,
  pushError,
  pushSupport,
  refreshPushSupport,
  requestDesktopPermission,
  setDesktopEnabled,
} = useNotificationCenter()
const { assetUrl } = useAssetUrl()

const accountInfo = ref<AccountInfoDTO | null>(null)
const accountLoading = ref(false)
const accountError = ref<string | null>(null)
const editorOpen = ref(false)
const editorField = ref<EditableField>('nickname')
const editorValue = ref('')
const editorSaving = ref(false)
const editorError = ref<string | null>(null)
const updateSuccess = ref(false)
const updateSuccessText = ref('账户资料已更新')
const passwordEditorOpen = ref(false)
const passwordSaving = ref(false)
const passwordError = ref<string | null>(null)
const passwordForm = reactive<Record<PasswordField, string>>({
  currentPassword: '',
  password: '',
  confirmPassword: '',
})
const passwordVisibility = reactive<Record<PasswordField, boolean>>({
  currentPassword: false,
  password: false,
  confirmPassword: false,
})
const passwordTouched = reactive<Record<PasswordField, boolean>>({
  currentPassword: false,
  password: false,
  confirmPassword: false,
})
const avatarFileInput = useTemplateRef<HTMLInputElement>('avatar-file-input')
const avatarCropOpen = ref(false)
const avatarSourceUrl = ref('')
const avatarSaving = ref(false)
const avatarError = ref<string | null>(null)
const pendingAvatarPath = ref<string | null>(null)
const bannerFileInput = useTemplateRef<HTMLInputElement>('banner-file-input')
const bannerSaving = ref(false)
const imageNotice = ref(false)
const imageNoticeText = ref('')

const desktopNotificationDescription = computed(() => {
  if (pushSupport.value === 'checking') return '正在检查当前浏览器的消息推送能力。'
  if (pushSupport.value === 'unconfigured') return '消息推送尚未配置，站内提醒仍会正常显示。'
  if (pushSupport.value === 'unsupported') return '当前浏览器不支持消息推送，站内提醒仍会正常显示。'
  if (desktopPermission.value === 'denied') return '浏览器已阻止通知；如需开启，请在浏览器网站权限中修改。'
  if (pushError.value) return pushError.value
  if (notificationStore.desktopEnabled && desktopPermission.value === 'granted') return '页面关闭或在后台时，会通过系统通知提醒你。'
  return '开启后，页面关闭或在后台时也能收到新消息提醒。'
})

const desktopNotificationsDisabled = computed(() => (
  pushBusy.value
  || pushSupport.value === 'checking'
  || pushSupport.value === 'unconfigured'
  || pushSupport.value === 'unsupported'
))

const updateDesktopNotifications = async (value: boolean | null) => {
  if (!value) {
    const result = await setDesktopEnabled(false)
    if (!result.enabled) {
      updateSuccessText.value = result.message
      updateSuccess.value = true
    } else {
      imageNoticeText.value = result.message
      imageNotice.value = true
    }
    return
  }

  if (desktopPermission.value === 'granted') {
    const result = await setDesktopEnabled(true)
    if (result.enabled) {
      updateSuccessText.value = result.message
      updateSuccess.value = true
      return
    }
    imageNoticeText.value = result.message
    imageNotice.value = true
    return
  }

  const result = await requestDesktopPermission()
  if (result.enabled) {
    updateSuccessText.value = result.message
    updateSuccess.value = true
  } else {
    imageNoticeText.value = result.message
    imageNotice.value = true
  }
}

const displayName = computed(() => accountInfo.value?.nickname || accountInfo.value?.username || '个人中心')
const accountAvatarUrl = computed(() => assetUrl(accountInfo.value?.avatar, 'icon'))
const accountBannerUrl = computed(() => assetUrl(accountInfo.value?.banner, 'banner'))
const editorConfig = computed(() => editorConfigs[editorField.value])
const normalizedEditorValue = computed(() => editorValue.value.trim())
const currentEditorValue = computed(() => accountInfo.value?.[editorField.value]?.trim() ?? '')
const editorValidationError = computed(() => {
  if (editorField.value === 'nickname' && !normalizedEditorValue.value) {
    return '请输入昵称。'
  }

  if (editorField.value === 'email' && !normalizedEditorValue.value) {
    return '请输入邮箱。'
  }

  if (editorValue.value.length > editorConfig.value.maxLength) {
    return `${editorConfig.value.label}不能超过 ${editorConfig.value.maxLength} 个字符。`
  }

  if (editorField.value === 'email' && normalizedEditorValue.value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(normalizedEditorValue.value)) return '请输入有效的邮箱地址。'
  }

  return null
})
const editorMessages = computed(() => {
  const message = editorError.value || editorValidationError.value
  return message ? [message] : []
})
const canSaveEditor = computed(() => {
  return !editorSaving.value
    && !editorValidationError.value
    && normalizedEditorValue.value !== currentEditorValue.value
})
const passwordValidationErrors = computed<Record<PasswordField, string | null>>(() => {
  let currentPasswordError: string | null = null
  let passwordError: string | null = null
  let confirmPasswordError: string | null = null

  if (!passwordForm.currentPassword.trim()) {
    currentPasswordError = '请输入当前密码。'
  } else if (passwordForm.currentPassword.length > 255) {
    currentPasswordError = '当前密码不能超过 255 个字符。'
  }

  if (!passwordForm.password.trim()) {
    passwordError = '请输入新密码。'
  } else if (passwordForm.password.length < 8) {
    passwordError = '新密码至少需要 8 个字符。'
  } else if (passwordForm.password.length > 255) {
    passwordError = '新密码不能超过 255 个字符。'
  }

  if (!passwordForm.confirmPassword.trim()) {
    confirmPasswordError = '请再次输入新密码。'
  } else if (passwordForm.confirmPassword !== passwordForm.password) {
    confirmPasswordError = '两次输入的新密码不一致。'
  }

  return {
    currentPassword: currentPasswordError,
    password: passwordError,
    confirmPassword: confirmPasswordError,
  }
})
const passwordMessages = computed<Record<PasswordField, string[]>>(() => ({
  currentPassword: passwordTouched.currentPassword && passwordValidationErrors.value.currentPassword
    ? [passwordValidationErrors.value.currentPassword]
    : [],
  password: passwordTouched.password && passwordValidationErrors.value.password
    ? [passwordValidationErrors.value.password]
    : [],
  confirmPassword: passwordTouched.confirmPassword && passwordValidationErrors.value.confirmPassword
    ? [passwordValidationErrors.value.confirmPassword]
    : [],
}))
const canSavePassword = computed(() => {
  return !passwordSaving.value
    && Object.values(passwordValidationErrors.value).every(error => !error)
})
const isInitialLoading = computed(() => {
  return !appStore.authInitialized
    || (appStore.isLoggedIn && !accountInfo.value && (appStore.userInfoLoading || accountLoading.value))
})

useSeoMeta({ title: '个人中心 · Ivan1105' })

const loadAccountInfo = async () => {
  if (!appStore.token || accountLoading.value) return

  const requestedToken = appStore.token
  accountLoading.value = true
  accountError.value = null

  try {
    const info = await accountApi.queryAccountInfo()
    if (appStore.token !== requestedToken) return

    if (!info) {
      appStore.clearAuth()
      accountInfo.value = null
      return
    }

    accountInfo.value = info
  } catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      accountInfo.value = null
      return
    }

    accountError.value = ACCOUNT_INFO_ERROR
    console.warn('[account] queryAccountInfo failed', error)
  } finally {
    accountLoading.value = false
  }
}

const openEditor = (field: EditableField) => {
  if (!accountInfo.value) return
  editorField.value = field
  editorValue.value = accountInfo.value[field] ?? ''
  editorError.value = null
  editorOpen.value = true
}

const closeEditor = () => {
  if (editorSaving.value) return
  editorOpen.value = false
  editorError.value = null
}

const resetPasswordEditor = () => {
  passwordForm.currentPassword = ''
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordVisibility.currentPassword = false
  passwordVisibility.password = false
  passwordVisibility.confirmPassword = false
  passwordTouched.currentPassword = false
  passwordTouched.password = false
  passwordTouched.confirmPassword = false
  passwordError.value = null
}

const openPasswordEditor = () => {
  resetPasswordEditor()
  passwordEditorOpen.value = true
}

const closePasswordEditor = () => {
  if (passwordSaving.value) return
  passwordEditorOpen.value = false
  resetPasswordEditor()
}

const revokeAvatarSource = () => {
  if (avatarSourceUrl.value && import.meta.client) {
    URL.revokeObjectURL(avatarSourceUrl.value)
  }
  avatarSourceUrl.value = ''
}

const resetAvatarCrop = () => {
  revokeAvatarSource()
  pendingAvatarPath.value = null
  avatarError.value = null
}

const showImageNotice = (message: string) => {
  imageNoticeText.value = message
  imageNotice.value = true
}

const openAvatarFilePicker = () => {
  if (avatarSaving.value) return
  if (avatarFileInput.value) {
    avatarFileInput.value.value = ''
    avatarFileInput.value.click()
  }
}

const handleAvatarFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    showImageNotice('请选择 JPEG、PNG 或 WebP 图片。')
    return
  }

  resetAvatarCrop()
  avatarSourceUrl.value = URL.createObjectURL(file)
  avatarCropOpen.value = true
}

const openBannerFilePicker = () => {
  if (bannerSaving.value) return
  if (bannerFileInput.value) {
    bannerFileInput.value.value = ''
    bannerFileInput.value.click()
  }
}

const handleBannerFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    showImageNotice('请选择 JPEG、PNG 或 WebP 图片。')
    return
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
    showImageNotice('图片大小不能超过 10 MB。')
    return
  }

  if (!accountInfo.value || !appStore.token || bannerSaving.value) return

  const requestedToken = appStore.token
  bannerSaving.value = true

  try {
    const upload = await commonApi.uploadImage(file, 'banner')
    if (appStore.token !== requestedToken) return

    const info = await accountApi.updateAccountInfo({ banner: upload.path })
    if (appStore.token !== requestedToken) return

    accountInfo.value = info
    updateSuccessText.value = '背景图修改成功'
    updateSuccess.value = true
  }
  catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      accountInfo.value = null
      return
    }

    showImageNotice(isApiError(error) ? error.message : '背景图保存失败，请重试。')
    console.warn('[account] updateBanner failed', error)
  }
  finally {
    bannerSaving.value = false
  }
}

const saveAvatar = async (file: Blob) => {
  if (!accountInfo.value || !appStore.token || avatarSaving.value) return

  const requestedToken = appStore.token
  avatarSaving.value = true
  avatarError.value = null

  try {
    let path = pendingAvatarPath.value
    if (!path) {
      const upload = await commonApi.uploadImage(file, 'icon')
      if (appStore.token !== requestedToken) return
      path = upload.path
      pendingAvatarPath.value = path
    }

    const info = await accountApi.updateAccountInfo({ avatar: path })
    if (appStore.token !== requestedToken) return

    accountInfo.value = info
    if (appStore.userInfo) {
      appStore.setUserInfo({ ...appStore.userInfo, avatar: info.avatar })
    }
    avatarCropOpen.value = false
    resetAvatarCrop()
    updateSuccessText.value = '头像修改成功'
    updateSuccess.value = true
  }
  catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      accountInfo.value = null
      avatarCropOpen.value = false
      resetAvatarCrop()
      return
    }

    avatarError.value = isApiError(error) ? error.message : '头像保存失败，请重试。'
    console.warn('[account] updateAvatar failed', error)
  }
  finally {
    avatarSaving.value = false
  }
}

const saveEditor = async () => {
  if (!accountInfo.value || !appStore.token || !canSaveEditor.value) return

  const requestedToken = appStore.token
  const value = normalizedEditorValue.value
  const req = { [editorField.value]: value } as UpdateAccountInfoReq

  editorSaving.value = true
  editorError.value = null

  try {
    const info = await accountApi.updateAccountInfo(req)
    if (appStore.token !== requestedToken) return

    accountInfo.value = info
    if (appStore.userInfo) {
      appStore.setUserInfo({ ...appStore.userInfo, nickname: info.nickname })
    }
    editorOpen.value = false
    updateSuccessText.value = '账户资料已更新'
    updateSuccess.value = true
  } catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      accountInfo.value = null
      editorOpen.value = false
      return
    }

    editorError.value = isApiError(error) ? error.message : UPDATE_ACCOUNT_ERROR
    console.warn('[account] updateAccountInfo failed', error)
  } finally {
    editorSaving.value = false
  }
}

const savePassword = async () => {
  if (!accountInfo.value || !appStore.token || passwordSaving.value) return

  if (!canSavePassword.value) {
    passwordTouched.currentPassword = true
    passwordTouched.password = true
    passwordTouched.confirmPassword = true
    return
  }

  const requestedToken = appStore.token
  const req: UpdateAccountInfoReq = {
    currentPassword: passwordForm.currentPassword,
    password: passwordForm.password,
  }

  passwordSaving.value = true
  passwordError.value = null

  try {
    const info = await accountApi.updateAccountInfo(req)
    if (appStore.token !== requestedToken) return

    accountInfo.value = info
    resetPasswordEditor()
    passwordEditorOpen.value = false
    updateSuccessText.value = '密码修改成功'
    updateSuccess.value = true
  } catch (error) {
    if (appStore.token !== requestedToken) return

    if (isApiError(error) && error.status === 401) {
      appStore.clearAuth()
      accountInfo.value = null
      passwordEditorOpen.value = false
      resetPasswordEditor()
      return
    }

    passwordError.value = isApiError(error) ? error.message : UPDATE_ACCOUNT_ERROR
    console.warn('[account] updatePassword failed', error)
  } finally {
    passwordSaving.value = false
  }
}

onMounted(async () => {
  await refreshPushSupport()
  await initializeAuth()
  if (appStore.isLoggedIn) {
    await loadAccountInfo()
  }
})

watch(avatarCropOpen, (open) => {
  if (!open && !avatarSaving.value) resetAvatarCrop()
})

onBeforeUnmount(revokeAvatarSource)

const handleLogout = async () => {
  await logout()
  accountInfo.value = null
  await navigateTo('/')
}
</script>

<style scoped>
.account-page {
  padding-block: 64px 88px;
}

.account-shell {
  width: min(760px, 100%);
  min-height: calc(100dvh - var(--site-nav-height) - 152px);
  margin-inline: auto;
}

.account-heading {
  display: flow-root;
  margin-bottom: var(--site-space-4);
}

.account-heading .eyebrow {
  margin: 0;
}

.account-heading h1 {
  margin: 10px 0 0;
  font-size: clamp(2.15rem, 5vw, 3.5rem);
  font-weight: 550;
  line-height: 1.2;
  letter-spacing: -0.045em;
}

.account-heading h1 span {
  color: var(--site-accent);
}

.account-heading .muted {
  margin: 12px 0 0;
}

.account-card {
  padding: clamp(24px, 5vw, 44px);
}

.account-state {
  min-height: 310px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: var(--site-space-3);
}

.account-state h2 {
  margin-top: 6px;
  color: var(--site-text);
  font-size: clamp(1.4rem, 3vw, 1.9rem);
}

.account-state .muted {
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

.profile-card {
  overflow: hidden;
}

.profile-banner {
  position: relative;
  height: 210px;
  background: var(--site-soft);
}

.profile-banner .v-img,
.profile-banner-fallback {
  width: 100%;
  height: 100%;
}

.profile-banner-fallback {
  background: linear-gradient(135deg, var(--site-soft), #d5efeb 58%, #c5e8e2);
}

.banner-edit-button {
  position: absolute !important;
  top: 0;
  right: 0;
  z-index: 2;
  width: 64px !important;
  height: 64px !important;
  min-width: 0 !important;
  padding: 0 !important;
  border-radius: 0 !important;
  background: rgb(var(--v-theme-primary)) !important;
  box-shadow: none !important;
  color: #fff !important;
  clip-path: polygon(0 0, 100% 0, 100% 100%);
  filter: drop-shadow(-4px 5px 6px rgb(9 36 32 / 32%));
  transition: filter 160ms ease, background-color 160ms ease;
}

.banner-edit-button:hover {
  filter: drop-shadow(-5px 6px 7px rgb(9 36 32 / 42%));
}

.banner-edit-button:focus-visible {
  filter:
    drop-shadow(-4px 5px 6px rgb(9 36 32 / 32%))
    drop-shadow(-2px 2px 2px rgb(var(--v-theme-primary) / 55%));
}

.banner-edit-button :deep(.v-btn__content),
.banner-edit-button :deep(.v-btn__loader) {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
}

.profile-content {
  padding: 0 clamp(24px, 5vw, 44px) clamp(24px, 5vw, 44px);
}

.profile-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: end;
  gap: var(--site-space-3);
}

.account-avatar-editor {
  position: relative;
  width: 88px;
  height: 88px;
  margin-top: -44px;
  border-radius: 50%;
}

.account-avatar {
  width: 100% !important;
  height: 100% !important;
  border: 4px solid var(--site-surface);
  color: var(--site-accent);
  background: var(--site-soft);
}

.avatar-edit-button {
  position: absolute;
  inset: 4px;
  width: calc(100% - 8px) !important;
  height: calc(100% - 8px) !important;
  min-width: 0 !important;
  border-radius: 50% !important;
  background: rgba(9, 36, 32, 0.68) !important;
  color: #fff !important;
  opacity: 0;
  transition: opacity 160ms ease;
}

.account-avatar-editor:hover .avatar-edit-button,
.account-avatar-editor:focus-within .avatar-edit-button,
.avatar-edit-button:focus-visible {
  opacity: 1;
}

.profile-identity {
  min-width: 0;
  padding-top: 20px;
}

.profile-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.profile-meta-row .eyebrow {
  margin: 0;
}

.profile-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.profile-identity h2 {
  min-width: 0;
  margin: 0;
  color: var(--site-text);
  font-size: clamp(1.5rem, 3vw, 2rem);
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.profile-username {
  min-width: 0;
  margin-top: 4px;
  color: var(--site-muted);
  overflow-wrap: anywhere;
}

.profile-signature {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-2);
  margin-top: var(--site-space-3);
  padding-bottom: var(--site-space-3);
  border-bottom: 1px solid var(--site-border);
  color: var(--site-muted);
}

.profile-signature p {
  min-width: 0;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.account-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: var(--site-space-3);
  padding: 12px 14px;
  border: 1px solid var(--site-border);
  border-radius: var(--site-radius);
  background: var(--site-soft);
  color: var(--site-muted);
  font-size: 0.9rem;
}

.account-warning span {
  flex: 1;
}

.account-progress {
  margin-top: var(--site-space-3);
}

.account-details {
  display: grid;
  gap: 0;
  margin-top: var(--site-space-2);
}

.account-details > div {
  display: grid;
  grid-template-columns: minmax(130px, 0.35fr) 1fr;
  gap: var(--site-space-3);
  padding-block: 20px;
  border-bottom: 1px solid var(--site-border);
}

.account-details dt {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--site-muted);
  font-size: 0.9rem;
}

.account-details dd {
  min-width: 0;
  margin: 0;
  color: var(--site-text);
  font-weight: 650;
  overflow-wrap: anywhere;
}

.detail-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-2);
}

.detail-value > :first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

.password-mask {
  color: #000;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.account-details a {
  color: var(--site-text);
  text-underline-offset: 3px;
}

.account-details a:hover {
  color: var(--site-accent);
}

.notification-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 24px;
  padding: 18px 20px;
  border: 1px solid var(--site-border);
  border-radius: var(--site-radius);
  background: var(--site-soft);
}

.notification-setting-copy {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}

.notification-setting-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--site-surface);
  color: var(--site-accent);
}

.notification-setting h3 {
  font-size: 0.92rem;
}

.notification-setting p {
  margin-top: 4px;
  color: var(--site-muted);
  font-size: 0.75rem;
  line-height: 1.55;
}

.notification-setting :deep(.v-switch) {
  flex: 0 0 auto;
}

.account-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-3);
  margin-top: var(--site-space-4);
}

.account-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-2);
}

.back-home {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--site-muted);
  text-decoration: none;
}

.back-home:hover {
  color: var(--site-accent);
}

.profile-editor {
  border: 1px solid var(--site-border);
}

.password-form {
  display: grid;
  gap: var(--site-space-1);
}

.password-error {
  margin: 0;
  color: rgb(var(--v-theme-error));
  font-size: 0.875rem;
}

@media (max-width: 600px) {
  .account-page {
    padding-block: 40px 64px;
  }

  .account-heading {
    margin-bottom: var(--site-space-3);
  }

  .profile-banner {
    height: 150px;
  }

  .banner-edit-button {
    width: 52px !important;
    height: 52px !important;
  }

  .banner-edit-button :deep(.v-btn__content),
  .banner-edit-button :deep(.v-btn__loader) {
    top: 5px;
    right: 5px;
  }

  .profile-content {
    padding-inline: 20px;
  }

  .profile-summary {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--site-space-2);
  }

  .account-avatar-editor {
    width: 72px;
    height: 72px;
    margin-top: -36px;
  }

  .profile-identity {
    padding-top: 14px;
  }

  .account-warning {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .account-warning .v-btn {
    margin-left: 26px;
  }

  .account-details > div {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .detail-value {
    align-items: flex-start;
  }

  .account-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .account-action-buttons {
    flex-direction: column;
  }

  .account-action-buttons,
  .account-action-buttons .v-btn,
  .account-actions .v-btn,
  .back-home {
    width: 100%;
    justify-content: center;
  }
}

@media (hover: none) {
  .avatar-edit-button {
    inset: auto -2px -2px auto;
    width: 32px !important;
    height: 32px !important;
    border: 2px solid var(--site-surface);
    background: rgb(var(--v-theme-primary)) !important;
    opacity: 1;
  }
}
</style>
