<template>
  <div class="oauth-result-page site-container">
    <v-card class="oauth-result-card surface-card" aria-labelledby="oauth-result-title">
      <div v-if="loading" class="oauth-result-state" role="status" aria-live="polite">
        <span class="oauth-result-icon oauth-result-icon-loading" aria-hidden="true">
          <v-progress-circular indeterminate color="secondary" size="38" width="3" />
        </span>
        <p class="eyebrow">OAUTH RESULT</p>
        <h1 id="oauth-result-title">正在确认授权结果</h1>
        <p class="oauth-result-description">正在读取第三方服务信息，请稍候…</p>
      </div>

      <div v-else class="oauth-result-state" :role="callbackStatus === 'success' ? 'status' : 'alert'"
        aria-live="polite">
        <span class="oauth-result-icon" :class="`oauth-result-icon-${resultTone}`" aria-hidden="true">
          <v-icon :icon="resultIcon" :color="resultTone" size="42" />
        </span>
        <p class="eyebrow">OAUTH RESULT</p>
        <h1 id="oauth-result-title">{{ resultTitle }}</h1>
        <p class="oauth-result-description">{{ resultDescription }}</p>

        <div v-if="validCallback" class="oauth-application">
          <v-avatar size="52" color="surface-variant" class="oauth-application-icon">
            <v-img v-if="applicationIconUrl" :src="applicationIconUrl" :alt="`${applicationName} 图标`" cover>
              <template #error>
                <v-icon icon="mdi-apps" color="secondary" size="26" aria-hidden="true" />
              </template>
            </v-img>
            <v-icon v-else icon="mdi-apps" color="secondary" size="26" aria-hidden="true" />
          </v-avatar>
          <div class="oauth-application-details">
            <span>第三方服务</span>
            <strong>{{ applicationName }}</strong>
            <code>{{ applicationKey }}</code>
          </div>
        </div>

        <v-alert v-if="applicationInfoError" type="warning" variant="tonal" density="comfortable"
          class="oauth-result-alert">
          {{ applicationInfoError }}
        </v-alert>

        <p v-if="callbackStatus === 'success' && !closeAttempted" class="oauth-close-note">
          此页面将在 {{ countdownSeconds }} 秒后自动关闭。
        </p>
        <p v-else-if="callbackStatus === 'success'" class="oauth-close-note">
          如果页面未能自动关闭，可以返回聊天页面继续使用。
        </p>

        <div class="oauth-result-actions">
          <v-btn v-if="callbackStatus === 'success' && !closeAttempted" color="primary"
            prepend-icon="mdi-close" @click="attemptClose">
            立即关闭
          </v-btn>
          <v-btn v-if="callbackStatus !== 'success' || closeAttempted" to="/chatbox" color="primary"
            append-icon="mdi-arrow-right">
            返回聊天
          </v-btn>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { IN_BROWSER, useTimer } from '@vuetify/v0'
import { isApiError, useOAuthApi, type OAuthServiceDTO } from '@/api'

type OAuthCallbackStatus = 'success' | 'error'
type OAuthResultTone = 'success' | 'error' | 'warning'

const AUTO_CLOSE_DELAY = 3000
const route = useRoute()
const { oauthApi } = useOAuthApi()
const { assetUrl } = useAssetUrl()

const firstQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : ''
  }
  return typeof value === 'string' ? value.trim() : ''
}

const statusQuery = computed(() => firstQueryValue(route.query.oauth_status))
const applicationKey = computed(() => firstQueryValue(route.query.application))
const reason = computed(() => firstQueryValue(route.query.reason))
const callbackStatus = computed<OAuthCallbackStatus | null>(() => {
  return statusQuery.value === 'success' || statusQuery.value === 'error'
    ? statusQuery.value
    : null
})
const validCallback = computed(() => callbackStatus.value !== null && applicationKey.value.length > 0)

const loading = shallowRef(true)
const application = shallowRef<OAuthServiceDTO | null>(null)
const applicationInfoError = shallowRef('')
const closeAttempted = shallowRef(false)

const applicationName = computed(() => application.value?.displayName || applicationKey.value)
const applicationIconUrl = computed(() => assetUrl(application.value?.iconPath, 'apps'))
const resultTone = computed<OAuthResultTone>(() => {
  if (!validCallback.value) return 'warning'
  return callbackStatus.value === 'success' ? 'success' : 'error'
})
const resultIcon = computed(() => {
  if (!validCallback.value) return 'mdi-alert-outline'
  return callbackStatus.value === 'success' ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'
})
const resultTitle = computed(() => {
  if (!validCallback.value) return '授权结果无效'
  return callbackStatus.value === 'success' ? `${applicationName.value}授权成功` : '授权未完成'
})
const resultDescription = computed(() => {
  if (!validCallback.value) return '缺少必要的授权结果信息，请返回聊天页面重新发起授权。'
  if (callbackStatus.value === 'success') return `已成功连接${applicationName.value}，现在可以在对话中使用对应的服务能力。`
  if (reason.value === 'invalid_state') return '授权请求已失效或状态校验失败，请返回聊天页面重新发起授权。'
  if (reason.value) return `第三方服务返回错误：${reason.value}。请返回聊天页面重新发起授权。`
  return '第三方服务未能完成授权，请返回聊天页面重新尝试。'
})

const attemptClose = () => {
  closeTimer.stop()
  closeAttempted.value = true
  if (IN_BROWSER) window.close()
}

const closeTimer = useTimer(attemptClose, { duration: AUTO_CLOSE_DELAY })
const countdownSeconds = computed(() => Math.max(1, Math.ceil(closeTimer.remaining.value / 1000)))

const loadApplication = async (appKey: string, status: OAuthCallbackStatus) => {
  loading.value = true
  application.value = null
  applicationInfoError.value = ''
  closeAttempted.value = false
  closeTimer.stop()

  try {
    application.value = await oauthApi.getService(appKey)
  } catch (error) {
    applicationInfoError.value = isApiError(error) && error.status === 401
      ? '登录状态已失效，暂时无法读取应用信息。请返回聊天页面重新登录。'
      : '暂时无法读取应用信息，已使用应用标识展示授权结果。'
  } finally {
    loading.value = false
    if (status === 'success') closeTimer.start()
  }
}

useSeoMeta({
  title: '第三方服务授权 · Ivan1105',
  description: '第三方 OAuth 服务授权结果。',
})

onMounted(() => {
  watch([callbackStatus, applicationKey], ([status, appKey]) => {
    if (!status || !appKey) {
      loading.value = false
      return
    }

    void loadApplication(appKey, status)
  }, { immediate: true })
})
</script>

<style scoped>
.oauth-result-page {
  display: grid;
  place-items: center;
  min-height: calc(100dvh - var(--site-nav-height));
  padding-block: 48px;
}

.oauth-result-page::before {
  position: fixed;
  z-index: -1;
  inset: var(--site-nav-height) 0 0;
  content: '';
  background:
    radial-gradient(circle at 18% 16%, rgb(57 197 187 / 14%), transparent 34%),
    radial-gradient(circle at 82% 84%, rgb(24 119 111 / 8%), transparent 36%);
}

.oauth-result-card {
  width: min(560px, 100%);
  padding: 48px;
}

.oauth-result-state {
  display: grid;
  justify-items: center;
  text-align: center;
}

.oauth-result-icon {
  display: grid;
  place-items: center;
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  border-radius: 24px;
}

.oauth-result-icon-loading,
.oauth-result-icon-success {
  background: var(--site-soft);
}

.oauth-result-icon-error {
  background: rgb(var(--v-theme-error) / 10%);
}

.oauth-result-icon-warning {
  background: rgb(var(--v-theme-warning) / 12%);
}

.oauth-result-state .eyebrow {
  font-size: 0.65rem;
}

.oauth-result-state h1 {
  margin-top: 8px;
  font-size: clamp(1.55rem, 4vw, 2rem);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.oauth-result-description {
  max-width: 420px;
  margin-top: 14px;
  color: var(--site-muted);
  font-size: 0.92rem;
  line-height: 1.8;
}

.oauth-application {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 14px;
  margin-top: 28px;
  padding: 18px 20px;
  border: 1px solid var(--site-border);
  border-radius: var(--site-radius);
  background: var(--site-bg);
  text-align: left;
}

.oauth-application-icon {
  flex: 0 0 auto;
  border: 1px solid var(--site-border);
}

.oauth-application-details {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.oauth-application-details span {
  color: var(--site-muted);
  font-size: 0.72rem;
}

.oauth-application-details strong {
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.oauth-application-details code {
  color: var(--site-accent);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}

.oauth-result-alert {
  width: 100%;
  margin-top: 18px;
  text-align: left;
}

.oauth-close-note {
  min-height: 24px;
  margin-top: 22px;
  color: var(--site-muted);
  font-size: 0.8rem;
}

.oauth-result-actions {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

.oauth-result-actions .v-btn {
  min-width: 150px;
}

@media (max-width: 600px) {
  .oauth-result-page {
    padding-block: 24px;
  }

  .oauth-result-card {
    padding: 36px 24px;
  }

  .oauth-result-icon {
    width: 68px;
    height: 68px;
    border-radius: 20px;
  }

  .oauth-result-actions,
  .oauth-result-actions .v-btn {
    width: 100%;
  }
}
</style>
