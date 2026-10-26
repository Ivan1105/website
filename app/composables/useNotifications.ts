import { useTimer } from '@vuetify/v0'
import { NotificationStreamError, useNotificationApi, type NotificationData } from '@/api'
import { useAppStore } from '@/stores/app'
import { useNotificationStore } from '@/stores/notifications'

interface TabPresence {
  tabId: string
  visible: boolean
  activeThreadId: string | null
  updatedAt: number
}

type ChannelMessage =
  | { type: 'presence', presence: TabPresence }
  | { type: 'notification', notification: NotificationData }
  | { type: 'cursor', id: string }
  | { type: 'catchup-complete' }
  | { type: 'unread', unread: Record<string, number> }
  | { type: 'read', threadId: string }
  | { type: 'snackbar', tabId: string, notification: NotificationData }
  | { type: 'desktop-setting', enabled: boolean }
  | { type: 'auth-invalid' }

const LEASE_DURATION = 15_000
const PRESENCE_MAX_AGE = 15_000
const MAX_RECONNECT_DELAY = 30_000

const parseLease = (raw: string | null): { owner: string, expiresAt: number } | null => {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object') return null
    const lease = value as Record<string, unknown>
    if (typeof lease.owner !== 'string' || typeof lease.expiresAt !== 'number') return null
    return { owner: lease.owner, expiresAt: lease.expiresAt }
  } catch {
    return null
  }
}

const isNewerEventId = (candidate: string, cursor: string) => {
  if (!cursor) return true
  try {
    return BigInt(candidate) > BigInt(cursor)
  } catch {
    return candidate !== cursor
  }
}

export const useNotificationCenter = () => {
  const store = useNotificationStore()
  const {
    busy: pushBusy,
    disablePush,
    enablePush,
    error: pushError,
    permission,
    refreshSupport: refreshPushSupport,
    support: pushSupport,
  } = useFirebasePush()

  const requestDesktopPermission = async () => {
    const result = await enablePush()
    if (result.enabled) {
      store.setDesktopEnabled(true)
      window.dispatchEvent(new CustomEvent('notification:desktop-setting', { detail: true }))
    }
    return result
  }

  const setDesktopEnabled = async (enabled: boolean) => {
    if (enabled) return requestDesktopPermission()

    const result = await disablePush()
    if (result.disabled) {
      store.setDesktopEnabled(false)
      window.dispatchEvent(new CustomEvent('notification:desktop-setting', { detail: false }))
    }
    return {
      enabled: !result.disabled,
      message: result.warning ?? (result.disabled ? '桌面通知已关闭。' : '关闭桌面通知失败。'),
    }
  }

  const clearUnread = (threadId: string) => {
    store.clearUnread(threadId)
    window.dispatchEvent(new CustomEvent('notification:read', { detail: threadId }))
  }

  const setActiveThread = (threadId: string | null) => {
    window.dispatchEvent(new CustomEvent('notification:active-thread', { detail: threadId }))
  }

  return {
    store,
    permission,
    pushBusy,
    pushError,
    pushSupport,
    refreshPushSupport,
    requestDesktopPermission,
    setDesktopEnabled,
    clearUnread,
    setActiveThread,
  }
}

export const useNotificationService = () => {
  const appStore = useAppStore()
  const store = useNotificationStore()
  const { streamNotifications } = useNotificationApi()
  const { refreshUserInfo } = useAuthSession()
  const {
    refreshRegistration,
    subscribeForeground,
    support: pushSupport,
  } = useFirebasePush()
  const tabId = crypto.randomUUID()
  const reconnectDuration = shallowRef(3000)
  const reconnectBaseDuration = shallowRef(3000)
  const peers = new Map<string, TabPresence>()

  let channel: BroadcastChannel | null = null
  let serviceController: AbortController | null = null
  let fallbackLeaderController: AbortController | null = null
  let activeThreadId: string | null = null
  let currentUserId: number | null = null
  let initialCatchup = false
  let reconnectAttempt = 0
  let reconnectResolve: (() => void) | null = null
  let foregroundUnsubscribe: (() => void) | null = null
  let pushStartVersion = 0

  const reconnectTimer = useTimer(() => {
    reconnectResolve?.()
    reconnectResolve = null
  }, { duration: reconnectDuration })

  const ownPresence = (): TabPresence => ({
    tabId,
    visible: document.visibilityState === 'visible',
    activeThreadId,
    updatedAt: Date.now(),
  })

  const post = (message: ChannelMessage) => {
    if (!channel) return
    // Pinia state is a Vue Proxy, which the structured-clone algorithm rejects.
    // Channel messages contain JSON-only data, so serialize once to guarantee a plain payload.
    const payload = JSON.parse(JSON.stringify(message)) as ChannelMessage
    channel.postMessage(payload)
  }

  const announcePresence = () => {
    const presence = ownPresence()
    peers.set(tabId, presence)
    post({ type: 'presence', presence })
  }

  const presenceTimer = useTimer(announcePresence, { duration: 5000, repeat: true })

  const updateUnread = (unread: Record<string, number>, broadcast = true) => {
    store.setUnread(unread)
    if (broadcast) post({ type: 'unread', unread })
  }

  const publishNotification = (notification: NotificationData) => {
    store.publishNotification(notification)
    post({ type: 'notification', notification })
  }

  const activePresences = () => {
    const now = Date.now()
    announcePresence()
    for (const [id, presence] of peers) {
      if (now - presence.updatedAt > PRESENCE_MAX_AGE) peers.delete(id)
    }
    return [...peers.values()]
  }

  const handleNotification = async (notification: NotificationData) => {
    if (!isNewerEventId(notification.id, store.lastEventId)) return
    reconnectAttempt = 0

    if (!initialCatchup) {
      const presences = activePresences()
      const targetVisible = presences.some(presence => (
        presence.visible && presence.activeThreadId === notification.thread_id
      ))

      store.incrementUnread(notification.thread_id)
      post({ type: 'unread', unread: store.unreadByThread })
      publishNotification(notification)
      if (!targetVisible) {
        const visibleTab = presences.find(presence => presence.visible)
        if (visibleTab) {
          if (visibleTab.tabId === tabId) store.enqueueSnackbar(notification)
          else post({ type: 'snackbar', tabId: visibleTab.tabId, notification })
        }
      }
    }

    store.persistCursor(notification.id)
    post({ type: 'cursor', id: notification.id })
  }

  const waitForReconnect = (signal: AbortSignal) => new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    reconnectResolve = resolve
    reconnectTimer.start()
    signal.addEventListener('abort', () => {
      reconnectTimer.stop()
      reconnectResolve?.()
      reconnectResolve = null
    }, { once: true })
  })

  const runLeader = async (signal: AbortSignal) => {
    initialCatchup = !store.catchupComplete
    while (!signal.aborted && appStore.token && currentUserId !== null) {
      try {
        await streamNotifications(store.lastEventId, {
          onNotification: handleNotification,
          onPing: () => {
            initialCatchup = false
            store.markCatchupComplete()
            post({ type: 'catchup-complete' })
            reconnectAttempt = 0
          },
          onRetry: milliseconds => {
            reconnectBaseDuration.value = Math.max(3000, Math.min(milliseconds, MAX_RECONNECT_DELAY))
          },
        }, signal)
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
        if (error instanceof NotificationStreamError && error.status === 401) {
          await refreshUserInfo()
          post({ type: 'auth-invalid' })
          serviceController?.abort()
          return
        }
        console.warn('[notifications] stream disconnected', error)
      }

      if (signal.aborted) return
      reconnectAttempt += 1
      reconnectDuration.value = Math.min(
        reconnectBaseDuration.value * (2 ** Math.max(0, reconnectAttempt - 1)),
        MAX_RECONNECT_DELAY,
      )
      await waitForReconnect(signal)
    }
  }

  const leaseKey = () => `notification:leader-lease:${currentUserId}`

  const tryFallbackLeadership = () => {
    if (!serviceController || serviceController.signal.aborted || currentUserId === null) return
    const key = leaseKey()
    const now = Date.now()
    const lease = parseLease(window.localStorage.getItem(key))
    if (lease && lease.owner !== tabId && lease.expiresAt > now) {
      fallbackLeaderController?.abort()
      fallbackLeaderController = null
      return
    }

    window.localStorage.setItem(key, JSON.stringify({ owner: tabId, expiresAt: now + LEASE_DURATION }))
    const claimed = parseLease(window.localStorage.getItem(key))
    if (claimed?.owner !== tabId) return
    if (fallbackLeaderController && !fallbackLeaderController.signal.aborted) return

    fallbackLeaderController = new AbortController()
    serviceController.signal.addEventListener('abort', () => fallbackLeaderController?.abort(), { once: true })
    void runLeader(fallbackLeaderController.signal)
  }

  const leaseTimer = useTimer(() => {
    if (currentUserId === null) return
    const key = leaseKey()
    const lease = parseLease(window.localStorage.getItem(key))
    if (lease?.owner === tabId) {
      window.localStorage.setItem(key, JSON.stringify({ owner: tabId, expiresAt: Date.now() + LEASE_DURATION }))
    }
    tryFallbackLeadership()
  }, { duration: 5000, repeat: true })

  const stopPushMessaging = () => {
    pushStartVersion += 1
    foregroundUnsubscribe?.()
    foregroundUnsubscribe = null
  }

  const startPushMessaging = async () => {
    stopPushMessaging()
    const startVersion = pushStartVersion
    const userId = currentUserId
    if (userId === null
      || !store.desktopEnabled
      || !('Notification' in window)
      || window.Notification.permission !== 'granted') return

    try {
      if (!(await refreshRegistration())) {
        if (pushSupport.value === 'unconfigured' || pushSupport.value === 'unsupported') {
          store.setDesktopEnabled(false)
          post({ type: 'desktop-setting', enabled: false })
        }
        return
      }
      if (pushStartVersion !== startVersion || currentUserId !== userId || !store.desktopEnabled) return

      const unsubscribe = await subscribeForeground((signal) => {
        if (currentUserId !== userId || !isNewerEventId(signal.eventId, store.lastEventId)) return
        store.publishPushSignal(signal)
      })
      if (pushStartVersion !== startVersion) unsubscribe?.()
      else foregroundUnsubscribe = unsubscribe
    } catch (error) {
      console.warn('[notifications] foreground push setup failed', error)
    }
  }

  const handleChannelMessage = (event: MessageEvent<ChannelMessage>) => {
    const message = event.data
    if (message.type === 'presence') peers.set(message.presence.tabId, message.presence)
    else if (message.type === 'notification') store.publishNotification(message.notification)
    else if (message.type === 'cursor') store.persistCursor(message.id)
    else if (message.type === 'catchup-complete') store.markCatchupComplete()
    else if (message.type === 'unread') updateUnread(message.unread, false)
    else if (message.type === 'read') store.clearUnread(message.threadId)
    else if (message.type === 'snackbar' && message.tabId === tabId) store.enqueueSnackbar(message.notification)
    else if (message.type === 'desktop-setting') {
      store.setDesktopEnabled(message.enabled)
      if (message.enabled) void startPushMessaging()
      else stopPushMessaging()
    }
    else if (message.type === 'auth-invalid') serviceController?.abort()
  }

  const stop = () => {
    const leaseOwner = currentUserId === null ? null : parseLease(window.localStorage.getItem(leaseKey()))?.owner
    if (leaseOwner === tabId) window.localStorage.removeItem(leaseKey())
    serviceController?.abort()
    fallbackLeaderController?.abort()
    serviceController = null
    fallbackLeaderController = null
    reconnectTimer.stop()
    presenceTimer.stop()
    leaseTimer.stop()
    stopPushMessaging()
    channel?.close()
    channel = null
    peers.clear()
    currentUserId = null
    activeThreadId = null
    store.reset()
  }

  const start = (userId: number) => {
    if (currentUserId === userId && serviceController && !serviceController.signal.aborted) return
    stop()
    currentUserId = userId
    store.initialize(userId)
    if (store.desktopEnabled && (!('Notification' in window) || window.Notification.permission !== 'granted')) {
      store.setDesktopEnabled(false)
    }
    initialCatchup = !store.catchupComplete
    reconnectAttempt = 0
    reconnectDuration.value = 3000
    reconnectBaseDuration.value = 3000
    const controller = new AbortController()
    serviceController = controller
    channel = new BroadcastChannel(`notification:${userId}`)
    channel.addEventListener('message', handleChannelMessage)
    announcePresence()
    presenceTimer.start()
    if (store.desktopEnabled) void startPushMessaging()

    if ('locks' in navigator) {
      void navigator.locks.request(`notification-sse:${userId}`, {
        mode: 'exclusive',
        signal: controller.signal,
      }, async () => {
        if (controller.signal.aborted) return
        await runLeader(controller.signal)
      }).catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('[notifications] Web Lock failed, using lease fallback', error)
          tryFallbackLeadership()
          leaseTimer.start()
        }
      })
    } else {
      tryFallbackLeadership()
      leaseTimer.start()
    }
  }

  const onVisibilityChange = () => announcePresence()
  const onActiveThread = (event: Event) => {
    activeThreadId = (event as CustomEvent<string | null>).detail
    announcePresence()
  }
  const onRead = (event: Event) => {
    const threadId = (event as CustomEvent<string>).detail
    store.clearUnread(threadId)
    post({ type: 'read', threadId })
  }
  const onDesktopSetting = (event: Event) => {
    const enabled = (event as CustomEvent<boolean>).detail
    post({ type: 'desktop-setting', enabled })
    if (enabled) void startPushMessaging()
    else stopPushMessaging()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('notification:active-thread', onActiveThread)
    window.addEventListener('notification:read', onRead)
    window.addEventListener('notification:desktop-setting', onDesktopSetting)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('notification:active-thread', onActiveThread)
    window.removeEventListener('notification:read', onRead)
    window.removeEventListener('notification:desktop-setting', onDesktopSetting)
    stop()
  })

  return { start, stop }
}
