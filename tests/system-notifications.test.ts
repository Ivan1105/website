import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'
import type { NotificationData, NotificationSource, NotificationStreamHandlers } from '../app/api/notifications'

// Run the actual composable with browser and Nuxt dependencies replaced by narrow mocks.
function loadTs<T>(path: string, globals: Record<string, unknown>, dependencies: Record<string, unknown>): T {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const exports = {}
  const context = vm.createContext({ exports, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, console, ...globals })
  vm.runInContext(outputText, context)
  return exports as T
}

const system = (id = '1'): Extract<NotificationData, { type: 'system.notification' }> => ({
  id, type: 'system.notification', source: 'system', agent_id: null, thread_id: null, run_id: null, message_id: null,
  preview: '采集完成', created_at: '2026-11-16T04:00:00Z',
  payload: { kind: 'activity.crawl.completed', title: '公告采集完成', body: '【公告采集完成】\n批次：#12', target: { section: 'runs', id: 12 } },
})
const chat = (source: Exclude<NotificationSource, 'system'>, id: string): Extract<NotificationData, { type: 'chat.message.ready' }> => ({ id, type: 'chat.message.ready', source, agent_id: 1, thread_id: 'thread',
  run_id: 'run', message_id: null, preview: '消息', created_at: '2026-11-16T04:00:00Z' })

function notificationHarness(catchupComplete = true) {
  interface ChannelMessage { type: string, tabId?: string, presence?: { tabId: string, visible: boolean, activeThreadId: string | null, updatedAt: number }, notification?: NotificationData }
  const channels: Channel[] = [], timers: Array<() => void> = [], published: NotificationData[] = [], snackbars: NotificationData[] = []
  let handlers: NotificationStreamHandlers | undefined
  const storage = new Map<string, string>()
  const store = {
    lastEventId: '', catchupComplete, desktopEnabled: false, unreadByThread: {} as Record<string, number>,
    initialize() {}, reset() {},
    incrementUnread(id: string) { this.unreadByThread[id] = (this.unreadByThread[id] ?? 0) + 1 },
    publishNotification(value: NotificationData) { published.push(value) },
    enqueueSnackbar(value: NotificationData) { snackbars.push(value) },
    persistCursor(id: string) { this.lastEventId = id },
    markCatchupComplete() { this.catchupComplete = true },
    setUnread(value: Record<string, number>) { this.unreadByThread = value },
  }
  class Channel {
    messages: ChannelMessage[] = []
    listener: (event: { data: ChannelMessage }) => void = () => {}
    constructor() { channels.push(this) }
    addEventListener(_name: string, listener: (event: { data: ChannelMessage }) => void) { this.listener = listener }
    postMessage(message: ChannelMessage) { this.messages.push(message) }
    close() {}
  }
  const document = { visibilityState: 'visible' }
  const window = Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } })
  const exports = loadTs<{ useNotificationService(): { start(userId: number): void, stop(): void } }>('../app/composables/useNotifications.ts', {
    window, document, crypto: webcrypto, BroadcastChannel: Channel, AbortController, DOMException,
    navigator: { locks: { request: async (_name: string, _options: unknown, callback: () => Promise<void>) => callback() } },
    shallowRef: <T>(value: T) => ({ value }), onMounted() {}, onBeforeUnmount() {},
    useAuthSession: () => ({ refreshUserInfo: async () => {} }),
    useFirebasePush: () => ({ refreshRegistration: async () => false, support: { value: 'unsupported' } }),
  }, {
    '@vuetify/v0': { useTimer: (callback: () => void) => { timers.push(callback); return { start() {}, stop() {} } } },
    '@/api': { NotificationStreamError: class extends Error {}, useNotificationApi: () => ({
      streamNotifications: async (_cursor: string, value: NotificationStreamHandlers, signal: AbortSignal) => {
        handlers = value
        await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
      },
    }) }, '@/stores/app': { useAppStore: () => ({ token: 'test' }) }, '@/stores/notifications': { useNotificationStore: () => store },
  })
  const service = exports.useNotificationService()
  service.start(7)
  assert.ok(handlers)
  return { service, store, published, snackbars, channel: channels[0]!, handlers, timers, document }
}

test('系统通知跨标签页同步及提示，不增加会话未读；重复事件被忽略', async () => {
  const h = notificationHarness()
  try {
    await h.handlers.onNotification(system())
    assert.equal(h.published.length, 1); assert.equal(h.snackbars.length, 1)
    assert.deepEqual(h.store.unreadByThread, {})
    assert.equal(h.store.lastEventId, '1')
    assert.ok(h.channel.messages.some(message => message.type === 'notification'))
    await h.handlers.onNotification(system())
    assert.equal(h.snackbars.length, 1)
    h.channel.listener({ data: { type: 'snackbar', tabId: h.channel.messages[0]!.presence!.tabId, notification: system('2') } })
    assert.equal(h.snackbars.length, 2)
  } finally { h.service.stop() }
})

test('两种静默来源继续广播供会话刷新，单标签页和跨标签页都不弹提示', async () => {
  const h = notificationHarness()
  try {
    for (const [index, source] of (['chat', 'reminder'] as const).entries()) {
      const notification = chat(source, String(index + 1))
      await h.handlers.onNotification(notification)
      h.channel.listener({ data: { type: 'snackbar', tabId: h.channel.messages[0]!.presence!.tabId, notification } })
    }
    assert.equal(h.published.length, 2); assert.equal(h.store.unreadByThread.thread, 2); assert.equal(h.snackbars.length, 0)
    await h.handlers.onNotification(chat('mail', '4'))
    assert.equal(h.snackbars.length, 1)
  } finally { h.service.stop() }
})

test('主标签页将系统提示路由到可见标签页；首次补发只推进游标', async () => {
  const h = notificationHarness(false)
  try {
    await h.handlers.onNotification(system())
    assert.equal(h.published.length, 0); assert.equal(h.snackbars.length, 0); assert.equal(h.store.lastEventId, '1')
    h.handlers.onPing!({ last_event_id: '1' })
    h.document.visibilityState = 'hidden'
    h.channel.listener({ data: { type: 'presence', presence: {
      tabId: 'peer', visible: true, activeThreadId: null, updatedAt: Date.now(),
    } } })
    // The receiving tab handles the same source guard as a locally enqueued snackbar.
    await h.handlers.onNotification(system('2'))
    assert.equal(h.published.length, 1); assert.equal(h.snackbars.length, 0)
    assert.ok(h.channel.messages.some(message => message.type === 'snackbar' && message.tabId === 'peer'))
    assert.equal(h.store.catchupComplete, true)
  } finally { h.service.stop() }
})

test('SSE解析支持无会话系统通知并拒绝无效管理目标', async () => {
  class ApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } }
  let payload: unknown = system()
  const exports = loadTs<Pick<typeof import('../app/api/notifications'), 'useNotificationApi'>>('../app/api/notifications.ts', {
    useRuntimeConfig: () => ({ public: { apiUrl: 'https://api.test' } }), TextDecoder,
    fetch: async () => new Response(`id: 1\nevent: notification\ndata: ${JSON.stringify(payload)}\n\nevent: ping\ndata: {"last_event_id":"1"}\n\n`),
  }, { './http': { ApiError, getToken: () => 'test', useHttp: () => ({ $api() {} }) } })
  const controller = new AbortController(), notifications: NotificationData[] = []
  await exports.useNotificationApi().streamNotifications('', {
    onNotification: async value => { notifications.push(value) }, onPing: () => controller.abort(),
  }, controller.signal)
  assert.equal(notifications[0]!.type, 'system.notification'); assert.equal(notifications[0]!.thread_id, null)
  payload = { ...system(), payload: { ...system().payload, target: { section: 'events', id: 12 } } }
  await assert.rejects(exports.useNotificationApi().streamNotifications('', { onNotification: async () => assert.fail('invalid target') }, new AbortController().signal), /目标格式错误/)
})

test('后台FCM系统通知显示模板预览，点击只打开同站管理详情，聊天跳转保持原样', async () => {
  type PushData = Record<string, string>
  const listeners: Record<string, (event: { notification: { close(): void, data: PushData }, waitUntil(promise: Promise<unknown>): void }) => void> = {}
  const shown: Array<{ title: string, body: string, data: PushData }> = [], navigated: string[] = []
  let background: (payload: { data: PushData }) => Promise<unknown> | undefined = () => undefined
  const context = vm.createContext({ URL, console,
    self: { location: { origin: 'https://site.test', href: 'https://site.test/firebase-messaging-sw.js?apiKey=a&authDomain=a&projectId=a&storageBucket=a&messagingSenderId=a&appId=a' },
      addEventListener: (name: string, handler: typeof listeners[string]) => { listeners[name] = handler },
      registration: { showNotification: async (title: string, options: { body: string, data: PushData }) => { shown.push({ title, ...options }) } } },
    importScripts() {}, firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage: (handler: typeof background) => { background = handler } }) },
    clients: { matchAll: async () => [], openWindow: async (url: string) => navigated.push(url) },
  })
  vm.runInContext(readFileSync(new URL('../public/firebase-messaging-sw.js', import.meta.url), 'utf8'), context)
  const data = { eventType: 'system.notification', source: 'system', eventId: '1', notificationTitle: '公告采集完成', notificationBody: '结果：成功', section: 'runs', targetId: '12' }
  await background({ data })
  assert.equal(shown[0]!.title, data.notificationTitle); assert.equal(shown[0]!.body, data.notificationBody)
  let pending: Promise<unknown> | undefined
  listeners.notificationclick!({ notification: { close() {}, data: shown[0]!.data }, waitUntil: promise => { pending = promise } })
  await pending
  assert.equal(navigated[0], 'https://site.test/admin/activities?section=runs&id=12')
  await background({ data: { ...data, section: 'https://evil.test' } })
  assert.equal(shown.length, 1)
  listeners.notificationclick!({ notification: { close() {}, data: { threadId: 'thread', agentId: '1' } }, waitUntil: promise => { pending = promise } })
  await pending
  assert.equal(navigated[1], 'https://site.test/chatbox?thread=thread&agent=1')
})
