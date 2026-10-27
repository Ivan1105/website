import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  deleteToken as deleteMessagingToken,
  getMessaging,
  getToken as getMessagingToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
  type Unsubscribe,
} from 'firebase/messaging'
import { isApiError, useNotificationApi } from '@/api'
import type { PushRefreshSignal } from '@/stores/notifications'

export type FirebasePushSupport = 'checking' | 'supported' | 'unconfigured' | 'unsupported'

interface PublicFirebaseConfig extends FirebaseOptions {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  vapidKey: string
}

interface DisablePushOptions {
  force?: boolean
}

interface DisablePushResult {
  disabled: boolean
  warning: string | null
}

const FIREBASE_APP_NAME = 'miku-push'
const TOKEN_STORAGE_KEY = 'notification:fcm-registration-id'
const VALID_SOURCES = new Set(['chat', 'proactive', 'reminder', 'journal', 'mail'])

const toConfigString = (value: unknown): string => (
  value === null || value === undefined ? '' : String(value).trim()
)

let firebaseApp: FirebaseApp | null = null
let firebaseMessaging: Messaging | null = null
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null

const parsePushSignal = (payload: MessagePayload): PushRefreshSignal | null => {
  const data = payload.data
  const agentId = data?.agentId
  const eventId = data?.eventId
  const messageId = data?.messageId
  const runId = data?.runId
  const threadId = data?.threadId
  if (!data
    || data.eventType !== 'chat.message.ready'
    || data.notificationTitle !== 'Miku'
    || data.notificationBody !== '你有一条新消息'
    || !VALID_SOURCES.has(data.source ?? '')
    || typeof eventId !== 'string'
    || !/^\d+$/.test(eventId)
    || typeof agentId !== 'string'
    || !/^\d+$/.test(agentId)
    || typeof runId !== 'string'
    || !runId
    || typeof messageId !== 'string'
    || typeof threadId !== 'string'
    || !threadId) return null

  return {
    agentId,
    eventId,
    threadId,
  }
}

const errorMessage = (error: unknown, fallback: string) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : fallback
)

export const useFirebasePush = () => {
  const runtimeConfig = useRuntimeConfig()
  const { registerInstallation, unregisterInstallation } = useNotificationApi()
  const support = useState<FirebasePushSupport>('firebase-push:support', () => 'checking')
  const permission = useState<NotificationPermission | 'unsupported'>('firebase-push:permission', () => 'unsupported')
  const busy = useState<boolean>('firebase-push:busy', () => false)
  const error = useState<string | null>('firebase-push:error', () => null)

  const config = (): PublicFirebaseConfig => {
    const value = runtimeConfig.public.firebase
    return {
      apiKey: toConfigString(value.apiKey),
      authDomain: toConfigString(value.authDomain),
      projectId: toConfigString(value.projectId),
      storageBucket: toConfigString(value.storageBucket),
      messagingSenderId: toConfigString(value.messagingSenderId),
      appId: toConfigString(value.appId),
      vapidKey: toConfigString(value.vapidKey),
    }
  }

  const hasCompleteConfig = () => Object.values(config()).every(value => (
    typeof value === 'string' && value.trim().length > 0
  ))

  const refreshSupport = async (): Promise<FirebasePushSupport> => {
    if (!import.meta.client || !hasCompleteConfig()) {
      support.value = 'unconfigured'
      permission.value = 'unsupported'
      return support.value
    }
    if (!('Notification' in window)
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
      || !(await isSupported())) {
      support.value = 'unsupported'
      permission.value = 'unsupported'
      return support.value
    }
    support.value = 'supported'
    permission.value = window.Notification.permission
    return support.value
  }

  const getResources = async (): Promise<{
    messaging: Messaging
    registration: ServiceWorkerRegistration
  }> => {
    if (await refreshSupport() !== 'supported') {
      throw new Error(support.value === 'unconfigured' ? '消息推送尚未配置。' : '当前浏览器不支持消息推送。')
    }

    const firebaseConfig = config()
    if (!serviceWorkerRegistration) {
      const workerUrl = new URL('/firebase-messaging-sw.js', window.location.origin)
      workerUrl.searchParams.set('apiKey', firebaseConfig.apiKey)
      workerUrl.searchParams.set('authDomain', firebaseConfig.authDomain)
      workerUrl.searchParams.set('projectId', firebaseConfig.projectId)
      workerUrl.searchParams.set('storageBucket', firebaseConfig.storageBucket)
      workerUrl.searchParams.set('messagingSenderId', firebaseConfig.messagingSenderId)
      workerUrl.searchParams.set('appId', firebaseConfig.appId)
      serviceWorkerRegistration = await navigator.serviceWorker.register(workerUrl.toString(), { scope: '/' })
    }

    if (!firebaseApp) {
      firebaseApp = getApps().some(app => app.name === FIREBASE_APP_NAME)
        ? getApp(FIREBASE_APP_NAME)
        : initializeApp(firebaseConfig, FIREBASE_APP_NAME)
    }
    firebaseMessaging ??= getMessaging(firebaseApp)

    return { messaging: firebaseMessaging, registration: serviceWorkerRegistration }
  }

  const obtainToken = async (): Promise<string> => {
    const { messaging, registration } = await getResources()
    const registrationId = await getMessagingToken(messaging, {
      vapidKey: config().vapidKey,
      serviceWorkerRegistration: registration,
    })
    if (!registrationId) throw new Error('浏览器未能生成消息推送标识。')
    window.localStorage.setItem(TOKEN_STORAGE_KEY, registrationId)
    return registrationId
  }

  const refreshRegistration = async (): Promise<boolean> => {
    error.value = null
    if (await refreshSupport() !== 'supported' || permission.value !== 'granted') return false

    try {
      const registrationId = await obtainToken()
      const result = await registerInstallation({ registrationId, registrationKind: 'token' })
      if (!result.registered) throw new Error('服务端未确认消息推送注册。')
      return true
    } catch (cause) {
      error.value = errorMessage(cause, '注册消息推送失败。')
      console.warn('[firebase-push] registration failed', cause)
      return false
    }
  }

  const enablePush = async (): Promise<{ enabled: boolean, message: string }> => {
    if (busy.value) return { enabled: false, message: '消息推送设置正在更新。' }
    busy.value = true
    error.value = null
    try {
      if (await refreshSupport() !== 'supported') {
        const message = support.value === 'unconfigured' ? '消息推送尚未配置。' : '当前浏览器不支持消息推送。'
        error.value = message
        return { enabled: false, message }
      }

      const result = await window.Notification.requestPermission()
      permission.value = result
      if (result !== 'granted') {
        const message = result === 'denied'
          ? '浏览器已阻止通知，请在网站权限中修改。'
          : '未授予通知权限，将继续使用站内提醒。'
        error.value = message
        return { enabled: false, message }
      }

      const enabled = await refreshRegistration()
      const message = enabled ? '桌面通知已开启。' : (error.value ?? '注册消息推送失败。')
      return { enabled, message }
    } finally {
      busy.value = false
    }
  }

  const disablePush = async (options: DisablePushOptions = {}): Promise<DisablePushResult> => {
    if (busy.value && !options.force) {
      return { disabled: false, warning: '消息推送设置正在更新。' }
    }
    busy.value = true
    error.value = null
    const warnings: string[] = []

    try {
      let registrationId = import.meta.client
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null

      if (!registrationId && import.meta.client && window.Notification?.permission === 'granted') {
        try {
          registrationId = await obtainToken()
        } catch (cause) {
          console.warn('[firebase-push] token lookup failed', cause)
        }
      }

      if (registrationId) {
        try {
          await unregisterInstallation({ registrationId })
        } catch (cause) {
          const message = errorMessage(cause, '服务端消息推送注销失败。')
          if (!options.force) {
            error.value = message
            return { disabled: false, warning: message }
          }
          warnings.push('服务端消息推送注销失败')
          console.warn('[firebase-push] unregistration failed during logout', cause)
        }
      }

      try {
        if (await refreshSupport() === 'supported') {
          const { messaging } = await getResources()
          await deleteMessagingToken(messaging)
        }
      } catch (cause) {
        warnings.push('本地消息推送标识删除失败')
        console.warn('[firebase-push] local token deletion failed', cause)
      } finally {
        if (import.meta.client) window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      }

      const warning = warnings.length > 0 ? `${warnings.join('，')}。` : null
      error.value = warning
      return { disabled: true, warning }
    } finally {
      busy.value = false
    }
  }

  const subscribeForeground = async (
    handler: (signal: PushRefreshSignal) => void,
  ): Promise<Unsubscribe | null> => {
    if (await refreshSupport() !== 'supported' || permission.value !== 'granted') return null
    const { messaging } = await getResources()
    return onMessage(messaging, (payload) => {
      const signal = parsePushSignal(payload)
      if (signal) handler(signal)
    })
  }

  return {
    busy,
    disablePush,
    enablePush,
    error,
    permission,
    refreshRegistration,
    refreshSupport,
    subscribeForeground,
    support,
  }
}
