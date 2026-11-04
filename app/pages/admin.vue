<template>
  <div class="admin-root">
    <div v-if="isAuthLoading" class="site-container admin-root-state" aria-live="polite">
      <v-card class="surface-card admin-access-card">
        <v-progress-circular indeterminate color="primary" size="34" width="3" />
        <div><h1>正在确认访问权限</h1><p class="muted">请稍候，我们正在获取你的账户信息。</p></div>
      </v-card>
    </div>

    <nuxt-page v-else-if="isAdmin" />

    <div v-else class="site-container admin-root-state">
      <v-card class="surface-card admin-access-card" role="alert">
        <span class="admin-access-icon"><v-icon icon="mdi-shield-lock-outline" size="32" /></span>
        <div><p class="eyebrow">ACCESS DENIED</p><h1>无权访问管理中心</h1><p class="muted">此区域仅限管理员访问。</p></div>
        <v-btn to="/account" color="primary" prepend-icon="mdi-arrow-left">返回个人中心</v-btn>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthSession } from '@/composables/useAuthSession'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const { initializeAuth } = useAuthSession()
const isAuthLoading = computed(() => !appStore.authInitialized || appStore.userInfoLoading)
const isAdmin = computed(() => appStore.isLoggedIn && appStore.userInfo?.role === 'admin')

onMounted(() => initializeAuth())
</script>

<style scoped>
.admin-root { min-height: calc(100dvh - var(--site-nav-height)); }
.admin-root-state { min-height: calc(100dvh - var(--site-nav-height)); display: grid; place-items: center; padding-block: 64px; }
.admin-access-card { width: min(100%, 680px); padding: 34px; display: flex; align-items: center; gap: 22px; }
.admin-access-card h1 { margin: 0 0 6px; font-size: clamp(1.35rem, 3vw, 2rem); }
.admin-access-icon { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; color: rgb(var(--v-theme-error)); background: color-mix(in srgb, rgb(var(--v-theme-error)) 12%, transparent); }
@media (max-width: 959px) { .admin-access-card { align-items: flex-start; flex-direction: column; } }
</style>
