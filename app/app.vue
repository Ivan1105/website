<template>
  <v-app>
    <a href="#main-content" class="skip-link">跳至主要内容</a>
    <v-app-bar flat class="app-nav" height="76">
      <div class="site-container nav-container">
        <nuxt-link to="/" class="nav-brand" aria-label="Ivan1105 首页">
          <img class="brand-mark" src="/favicon.ico" alt="" aria-hidden="true">
          <span class="brand-copy"><strong>Ivan1105<span>.</span></strong><span>PERSONAL SPACE</span></span>
        </nuxt-link>
        <nav class="nav-panel" aria-label="主导航">
          <nuxt-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link">{{ item.label }}</nuxt-link>
          <span v-if="!appStore.authInitialized" class="nav-account-placeholder" aria-hidden="true" />
          <nuxt-link
            v-else-if="appStore.isLoggedIn && appStore.userInfo"
            to="/account"
            class="nav-link nav-account"
            :aria-label="`个人中心：${accountName}`"
            :title="accountName"
          >
            <v-avatar size="24" color="surface-variant" class="nav-account-avatar" aria-hidden="true">
              <v-img v-if="accountAvatarUrl" :src="accountAvatarUrl" alt="" cover>
                <template #error><v-icon icon="mdi-account-outline" size="17" /></template>
              </v-img>
              <v-icon v-else icon="mdi-account-outline" size="17" />
            </v-avatar>
            <span class="nav-account-name">{{ accountName }}</span>
          </nuxt-link>
          <span
            v-else-if="appStore.isLoggedIn && appStore.userInfoLoading"
            class="nav-account-placeholder"
            aria-label="正在加载账户信息"
            role="status"
          />
          <nuxt-link
            v-else-if="appStore.isLoggedIn"
            to="/account"
            class="nav-link nav-account"
            aria-label="个人中心"
          >
            <v-icon icon="mdi-account-circle-outline" size="20" aria-hidden="true" />
            <span class="nav-account-name">个人中心</span>
          </nuxt-link>
          <nuxt-link v-else to="/login" class="nav-link">登录</nuxt-link>
        </nav>
        <span class="nav-note" aria-hidden="true">愛言葉 <span>♥</span></span>
      </div>
    </v-app-bar>
    <v-main id="main-content" tabindex="-1"><nuxt-page /></v-main>
    <v-snackbar
      v-model="notificationSnackbarOpen"
      class="notification-snackbar"
      location="top end"
      :timeout="7000"
    >
      <div class="notification-snackbar-copy">
        <strong>{{ notificationTitle }}</strong>
        <span>{{ notificationStore.activeSnackbarNotification?.preview || '有一条新消息' }}</span>
      </div>
      <template #actions>
        <v-btn variant="text" @click="openNotification">查看</v-btn>
        <v-btn icon="mdi-close" variant="text" aria-label="关闭提醒" @click="notificationStore.dismissSnackbar()" />
      </template>
    </v-snackbar>
    <v-snackbar
      :model-value="appStore.notice !== null"
      location="bottom center"
      :timeout="7000"
      @update:model-value="open => { if (!open) appStore.setNotice(null) }"
    >
      {{ appStore.notice }}
      <template #actions>
        <v-btn variant="text" @click="appStore.setNotice(null)">关闭</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script lang="ts" setup>
import { useAuthSession } from '@/composables/useAuthSession'
import { useAppStore } from '@/stores/app'
import { useNotificationStore } from '@/stores/notifications'

const appStore = useAppStore()
const notificationStore = useNotificationStore()
const { initializeAuth } = useAuthSession()
const { start: startNotifications, stop: stopNotifications } = useNotificationService()
const { assetUrl } = useAssetUrl()

const navItems = [
  { label: '首页', to: '/' },
  { label: '智能体', to: '/chatbox' },
]

const accountName = computed(() => appStore.userInfo?.username ?? '个人中心')
const accountAvatarUrl = computed(() => assetUrl(appStore.userInfo?.avatar, 'icon'))

const notificationTitles = {
  chat: '聊天回复',
  reminder: '提醒消息',
  proactive: '主动消息',
  journal: '日记已完成',
} as const
const notificationTitle = computed(() => {
  const source = notificationStore.activeSnackbarNotification?.source
  return source ? notificationTitles[source] : '新消息'
})
const notificationSnackbarOpen = computed({
  get: () => notificationStore.activeSnackbar !== null,
  set: (open: boolean) => {
    if (!open) notificationStore.dismissSnackbar()
  },
})

const openNotification = async () => {
  const notification = notificationStore.activeSnackbarNotification
  if (!notification) return
  notificationStore.dismissSnackbar()
  await navigateTo({ path: '/chatbox', query: { thread: notification.thread_id } })
}

watch(() => appStore.userInfo?.user_id ?? null, (userId) => {
  if (userId && appStore.token) startNotifications(userId)
  else stopNotifications()
})

onMounted(async () => {
  await initializeAuth()
  if (appStore.token && appStore.userInfo) startNotifications(appStore.userInfo.user_id)
})
</script>

<style scoped>
.app-nav {
  background: var(--site-bg) !important;
  border-bottom: 1px solid var(--site-border);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-3);
  height: 100%;
}

.nav-brand {
  display: inline-flex;
  min-height: 44px;
  gap: 12px;
  align-items: center;
  text-decoration: none;
  color: var(--site-text);
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  object-fit: contain;
}

.brand-copy {
  display: grid;
  line-height: 1.3;
}

.brand-copy strong {
  font-size: 1.1rem;
  letter-spacing: -0.04em;
}

.brand-copy strong span {
  color: var(--site-accent);
}

.brand-copy > span {
  font-size: 8px;
  letter-spacing: 0.16em;
  color: var(--site-muted);
  margin-top: 3px;
}

.nav-panel {
  display: flex;
  align-items: center;
  gap: var(--site-space-1);
}

.nav-link {
  min-height: 44px;
  padding: 10px 22px;
  display: flex;
  align-items: center;
  text-decoration: none;
  color: var(--site-muted);
  font-size: 0.9rem;
  border-radius: var(--site-radius);
  transition: background var(--site-transition), color var(--site-transition);
}

.nav-link:hover {
  color: var(--site-accent);
  background: var(--site-soft);
}

.nav-link.router-link-exact-active {
  background: var(--site-soft);
  color: var(--site-accent);
  font-weight: 700;
}

.nav-account {
  gap: 7px;
  max-width: 190px;
}

.nav-account-avatar {
  flex: 0 0 auto;
}

.nav-account-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-account-placeholder {
  width: 112px;
  height: 44px;
  border-radius: var(--site-radius);
  background: linear-gradient(90deg, var(--site-soft), #f8fcfb, var(--site-soft));
  background-size: 200% 100%;
  animation: account-loading 1.4s ease-in-out infinite;
}

.notification-snackbar-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.notification-snackbar-copy strong {
  color: rgb(var(--v-theme-primary));
  font-size: 0.82rem;
}

.notification-snackbar-copy span {
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

:global(.notification-snackbar .v-snackbar__wrapper) {
  max-width: min(440px, calc(100vw - 24px));
  border: 1px solid var(--site-border);
  border-left: 4px solid rgb(var(--v-theme-primary));
  border-radius: var(--site-radius);
  background: var(--site-surface);
  color: var(--site-text);
}

@keyframes account-loading {
  to {
    background-position: -200% 0;
  }
}

.nav-note {
  color: var(--site-muted);
  font-size: 0.75rem;
}

.nav-note span {
  color: var(--site-accent);
  margin-left: 18px;
}

@media (max-width: 900px) {
  .nav-note {
    display: none;
  }
}

@media (max-width: 600px) {
  .app-nav {
    height: var(--site-nav-height) !important;
  }
  .app-nav :deep(.v-toolbar__content) {
    height: var(--site-nav-height) !important;
  }
  .nav-container {
    gap: var(--site-space-1);
  }
  .brand-mark {
    width: 30px;
    height: 30px;
  }
  .nav-brand {
    gap: var(--site-space-1);
  }
  .brand-copy strong {
    font-size: 1rem;
  }
  .brand-copy > span {
    font-size: 7px;
  }
  .nav-panel {
    gap: 0;
  }
  .nav-link {
    padding-inline: 10px;
    font-size: 0.85rem;
  }
  .nav-account {
    max-width: 92px;
  }
  .nav-account-placeholder {
    width: 72px;
  }
}
</style>
