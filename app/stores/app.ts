import { defineStore } from 'pinia'
import type { UserRole } from '@/api/user'

const TOKEN_KEY = 'token'
const USER_INFO_KEY = 'userInfo'

export interface UserInfo {
  username: string
  user_id: number
  nickname: string | null
  avatar?: string | null
  role: UserRole
}

const isUserInfo = (value: unknown): value is UserInfo => {
  if (!value || typeof value !== 'object') return false
  const info = value as Record<string, unknown>
  return typeof info.username === 'string'
    && typeof info.user_id === 'number'
    && (typeof info.nickname === 'string' || info.nickname === null)
    && (info.avatar === undefined || info.avatar === null || typeof info.avatar === 'string')
    && (info.role === 'admin' || info.role === 'user')
}

export const useAppStore = defineStore('app', {
  state: () => ({
    token: null as string | null,
    userInfo: null as UserInfo | null,
    authInitialized: false,
    userInfoLoading: false,
    userInfoError: null as string | null,
    notice: null as string | null,
  }),
  getters: {
    isLoggedIn: (state): boolean => !!state.token,
  },
  actions: {
    initFromStorage() {
      if (typeof window === 'undefined') return
      try {
        const token = window.localStorage.getItem(TOKEN_KEY)
        this.token = token || null

        const raw = window.localStorage.getItem(USER_INFO_KEY)
        if (raw) {
          const info = JSON.parse(raw) as unknown
          if (isUserInfo(info)) {
            this.userInfo = info
          } else {
            this.clearUserInfo()
          }
        }
      } catch (error) {
        console.warn('[appStore] initFromStorage failed', error)
        this.clearUserInfo()
      } finally {
        this.authInitialized = true
      }
    },

    setToken(token: string) {
      this.token = token
      this.authInitialized = true
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_KEY, token)
      }
    },

    setUserInfo(info: UserInfo) {
      this.userInfo = info
      this.userInfoError = null
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(info))
      }
    },

    clearUserInfo() {
      this.userInfo = null
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_INFO_KEY)
      }
    },

    setUserInfoLoading(loading: boolean) {
      this.userInfoLoading = loading
    },

    setUserInfoError(message: string | null) {
      this.userInfoError = message
    },

    setNotice(message: string | null) {
      this.notice = message
    },

    clearAuth() {
      this.token = null
      this.userInfo = null
      this.authInitialized = true
      this.userInfoLoading = false
      this.userInfoError = null
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TOKEN_KEY)
        window.localStorage.removeItem(USER_INFO_KEY)
      }
    },
  },
})
