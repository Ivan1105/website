import { defineStore } from 'pinia'
import type { NotificationData } from '@/api'

interface SnackbarItem {
  id: string
  notification: NotificationData
}

const storageKey = (name: string, userId: number) => `notification:${name}:${userId}`

const parseUnread = (value: string | null): Record<string, number> => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => (
      typeof entry[1] === 'number' && Number.isSafeInteger(entry[1]) && entry[1] > 0
    )))
  } catch {
    return {}
  }
}

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    userId: null as number | null,
    lastEventId: '',
    catchupComplete: false,
    unreadByThread: {} as Record<string, number>,
    desktopEnabled: false,
    latestNotification: null as NotificationData | null,
    notificationRevision: 0,
    snackbarQueue: [] as SnackbarItem[],
    activeSnackbar: null as SnackbarItem | null,
  }),
  getters: {
    activeSnackbarNotification: state => state.activeSnackbar?.notification ?? null,
  },
  actions: {
    initialize(userId: number) {
      this.userId = userId
      this.lastEventId = window.localStorage.getItem(storageKey('last-event-id', userId)) ?? ''
      this.catchupComplete = window.localStorage.getItem(storageKey('catchup-complete', userId)) === '1'
      this.unreadByThread = parseUnread(window.localStorage.getItem(storageKey('unread', userId)))
      this.desktopEnabled = window.localStorage.getItem(storageKey('desktop-enabled', userId)) === '1'
      this.latestNotification = null
      this.notificationRevision = 0
      this.snackbarQueue = []
      this.activeSnackbar = null
    },

    reset() {
      this.userId = null
      this.lastEventId = ''
      this.catchupComplete = false
      this.unreadByThread = {}
      this.desktopEnabled = false
      this.latestNotification = null
      this.notificationRevision = 0
      this.snackbarQueue = []
      this.activeSnackbar = null
    },

    persistCursor(id: string) {
      if (this.userId === null) return
      this.lastEventId = id
      window.localStorage.setItem(storageKey('last-event-id', this.userId), id)
    },

    markCatchupComplete() {
      if (this.userId === null) return
      this.catchupComplete = true
      window.localStorage.setItem(storageKey('catchup-complete', this.userId), '1')
    },

    publishNotification(notification: NotificationData) {
      this.latestNotification = notification
      this.notificationRevision += 1
    },

    setUnread(unread: Record<string, number>) {
      if (this.userId === null) return
      this.unreadByThread = { ...unread }
      window.localStorage.setItem(storageKey('unread', this.userId), JSON.stringify(this.unreadByThread))
    },

    incrementUnread(threadId: string) {
      this.setUnread({
        ...this.unreadByThread,
        [threadId]: (this.unreadByThread[threadId] ?? 0) + 1,
      })
    },

    clearUnread(threadId: string) {
      if (!this.unreadByThread[threadId]) return
      const unread = { ...this.unreadByThread }
      delete unread[threadId]
      this.setUnread(unread)
    },

    setDesktopEnabled(enabled: boolean) {
      if (this.userId === null) return
      this.desktopEnabled = enabled
      window.localStorage.setItem(storageKey('desktop-enabled', this.userId), enabled ? '1' : '0')
    },

    enqueueSnackbar(notification: NotificationData) {
      const item = { id: `${notification.id}:${crypto.randomUUID()}`, notification }
      if (!this.activeSnackbar) {
        this.activeSnackbar = item
        return
      }
      this.snackbarQueue.push(item)
    },

    dismissSnackbar() {
      this.activeSnackbar = this.snackbarQueue.shift() ?? null
    },
  },
})
