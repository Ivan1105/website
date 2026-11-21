/* global firebase */

function isSystemNotification(data) {
  return data && data.eventType === 'system.notification' && data.source === 'system'
    && /^\d+$/.test(data.eventId || '')
    && ['runs', 'announcements'].includes(data.section)
    && /^\d+$/.test(data.targetId || '') && Number.isSafeInteger(Number(data.targetId)) && Number(data.targetId) > 0
    && typeof data.notificationTitle === 'string' && !!data.notificationTitle.trim()
    && typeof data.notificationBody === 'string' && !!data.notificationBody.trim()
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data
  const system = isSystemNotification(data)
  const target = new URL(system ? '/admin/activities' : '/chatbox', self.location.origin)
  if (system) {
    target.searchParams.set('section', data.section)
    target.searchParams.set('id', data.targetId)
  }
  if (!system && data && typeof data.threadId === 'string' && data.threadId) {
    target.searchParams.set('thread', data.threadId)
  }
  if (!system && data && typeof data.agentId === 'string' && data.agentId) {
    target.searchParams.set('agent', data.agentId)
  }

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) {
      await existing.navigate(target.toString())
      await existing.focus()
      return
    }
    await clients.openWindow(target.toString())
  })())
})

importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js')

const params = new URL(self.location.href).searchParams
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
}

const hasConfig = Object.values(firebaseConfig).every(value => typeof value === 'string' && value.length > 0)

if (hasConfig) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()
  const validSources = new Set(['chat', 'proactive', 'reminder', 'mail', 'activity'])

  messaging.onBackgroundMessage((payload) => {
    const data = payload && payload.data
    if (isSystemNotification(data)) {
      return self.registration.showNotification(data.notificationTitle, {
        body: data.notificationBody, icon: '/favicon.ico', tag: `miku-system:${data.eventId}`, data,
      })
    }
    if (!data
      || data.eventType !== 'chat.message.ready'
      || data.notificationTitle !== 'Miku'
      || data.notificationBody !== '你有一条新消息'
      || !validSources.has(data.source)
      || !/^\d+$/.test(data.eventId || '')
      || !/^\d+$/.test(data.agentId || '')
      || typeof data.runId !== 'string'
      || !data.runId
      || typeof data.messageId !== 'string'
      || typeof data.threadId !== 'string'
      || !data.threadId) return undefined

    return self.registration.showNotification('Miku', {
      body: '你有一条新消息',
      icon: '/favicon.ico',
      tag: `miku-message:${data.eventId}`,
      data: {
        agentId: data.agentId,
        eventId: data.eventId,
        threadId: data.threadId,
      },
    })
  })
}
