import { ApiError, getToken, unwrap, useHttp, type Envelope } from './http'

export type NotificationSource = 'chat' | 'reminder' | 'proactive' | 'journal' | 'mail'

export interface NotificationData {
  id: string
  type: 'chat.message.ready'
  source: NotificationSource
  agent_id: number
  thread_id: string
  run_id: string
  message_id: string | null
  preview: string
  created_at: string
}

export interface NotificationPingData {
  last_event_id: string
}

export interface RegisterNotificationInstallationReq {
  registrationId: string
  registrationKind: 'token'
}

export interface UnregisterNotificationInstallationReq {
  registrationId: string
}

export interface NotificationInstallationDTO {
  registered: boolean
}

export interface NotificationStreamHandlers {
  onNotification: (notification: NotificationData) => Promise<void>
  onPing?: (ping: NotificationPingData) => void
  onRetry?: (milliseconds: number) => void
}

export class NotificationStreamError extends ApiError {
  constructor(message: string, status: number, data?: unknown) {
    super(message, status, data)
    this.name = 'NotificationStreamError'
  }
}

const UNSIGNED_INTEGER_PATTERN = /^\d+$/

const requireString = (value: unknown, field: string, payload: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new NotificationStreamError(`通知字段 ${field} 格式错误`, 200, payload)
  }
  return value
}

const parseNotification = (payload: unknown): NotificationData => {
  if (!payload || typeof payload !== 'object') {
    throw new NotificationStreamError('通知数据格式错误', 200, payload)
  }

  const event = payload as Record<string, unknown>
  const id = requireString(event.id, 'id', payload)
  const source = event.source
  if (!UNSIGNED_INTEGER_PATTERN.test(id)) {
    throw new NotificationStreamError('通知字段 id 格式错误', 200, payload)
  }
  if (event.type !== 'chat.message.ready') {
    throw new NotificationStreamError('通知字段 type 格式错误', 200, payload)
  }
  if (source !== 'chat' && source !== 'reminder' && source !== 'proactive' && source !== 'journal' && source !== 'mail') {
    throw new NotificationStreamError('通知字段 source 格式错误', 200, payload)
  }
  if (!Number.isSafeInteger(event.agent_id) || (event.agent_id as number) < 0) {
    throw new NotificationStreamError('通知字段 agent_id 格式错误', 200, payload)
  }
  if (event.message_id !== null && typeof event.message_id !== 'string') {
    throw new NotificationStreamError('通知字段 message_id 格式错误', 200, payload)
  }

  const createdAt = requireString(event.created_at, 'created_at', payload)
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new NotificationStreamError('通知字段 created_at 格式错误', 200, payload)
  }

  return {
    id,
    type: event.type,
    source,
    agent_id: event.agent_id as number,
    thread_id: requireString(event.thread_id, 'thread_id', payload),
    run_id: requireString(event.run_id, 'run_id', payload),
    message_id: event.message_id as string | null,
    preview: typeof event.preview === 'string' ? event.preview : '',
    created_at: createdAt,
  }
}

const parseJson = (data: string, label: string): unknown => {
  try {
    return JSON.parse(data)
  } catch {
    throw new NotificationStreamError(`${label}数据格式错误`, 200, data)
  }
}

export const useNotificationApi = () => {
  const { $api } = useHttp()
  const runtimeConfig = useRuntimeConfig()
  const baseURL = runtimeConfig.public.apiUrl ?? ''

  const streamNotifications = async (
    lastEventId: string,
    handlers: NotificationStreamHandlers,
    signal: AbortSignal,
  ): Promise<void> => {
    const token = getToken()
    if (!token) throw new NotificationStreamError('登录状态已失效', 401)

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    }
    const query = lastEventId ? `?after_id=${encodeURIComponent(lastEventId)}` : ''

    const response = await fetch(`${baseURL}/notifications/stream${query}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal,
    })

    if (!response.ok) {
      let data: unknown
      let message = `通知连接失败: HTTP ${response.status}`
      try {
        data = await response.clone().json()
        if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
          message = data.message
        }
      } catch {
        // 非 JSON 响应保留 HTTP 状态信息。
      }
      throw new NotificationStreamError(message, response.status, data)
    }
    if (!response.body) {
      throw new NotificationStreamError('通知响应不包含可读流', response.status)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = 'message'
    let eventId = ''
    let dataLines: string[] = []

    const dispatchEvent = async () => {
      const currentEventName = eventName
      const currentEventId = eventId
      const data = dataLines.join('\n')
      eventName = 'message'
      eventId = ''
      dataLines = []

      if (!data && currentEventName === 'message') return
      if (currentEventName === 'ping') {
        const payload = parseJson(data, '通知心跳')
        if (!payload || typeof payload !== 'object') {
          throw new NotificationStreamError('通知心跳数据格式错误', 200, payload)
        }
        const lastEventIdValue = (payload as Record<string, unknown>).last_event_id
        if (typeof lastEventIdValue !== 'string' || !UNSIGNED_INTEGER_PATTERN.test(lastEventIdValue)) {
          throw new NotificationStreamError('通知心跳游标格式错误', 200, payload)
        }
        handlers.onPing?.({ last_event_id: lastEventIdValue })
        return
      }
      if (currentEventName === 'error') {
        const payload = data ? parseJson(data, '通知错误') : null
        const message = payload && typeof payload === 'object' && 'message' in payload
          && typeof payload.message === 'string'
          ? payload.message
          : '通知流发生错误'
        throw new NotificationStreamError(message, 200, payload)
      }
      if (currentEventName !== 'notification') return

      const notification = parseNotification(parseJson(data, '通知'))
      if (currentEventId && currentEventId !== notification.id) {
        throw new NotificationStreamError('通知事件 ID 不匹配', 200, notification)
      }
      await handlers.onNotification(notification)
    }

    const processLine = async (rawLine: string) => {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
      if (line === '') {
        await dispatchEvent()
        return
      }
      if (line.startsWith(':')) return
      const separator = line.indexOf(':')
      const field = separator < 0 ? line : line.slice(0, separator)
      let value = separator < 0 ? '' : line.slice(separator + 1)
      if (value.startsWith(' ')) value = value.slice(1)

      if (field === 'event') eventName = value
      else if (field === 'id') eventId = value
      else if (field === 'data') dataLines.push(value)
      else if (field === 'retry' && UNSIGNED_INTEGER_PATTERN.test(value)) {
        const retry = Number(value)
        if (Number.isSafeInteger(retry)) handlers.onRetry?.(retry)
      }
    }

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) await processLine(line)
      }

      if (!signal.aborted) {
        buffer += decoder.decode()
        if (buffer) await processLine(buffer)
        if (dataLines.length > 0 || eventName !== 'message') await dispatchEvent()
        throw new NotificationStreamError('通知连接已断开', response.status)
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }
  }

  const registerInstallation = async (
    request: RegisterNotificationInstallationReq,
  ): Promise<NotificationInstallationDTO> => {
    const response = await $api<NotificationInstallationDTO | Envelope<NotificationInstallationDTO>>(
      '/notifications/installations',
      {
        method: 'POST',
        body: request,
      },
    )
    return unwrap(response)
  }

  const unregisterInstallation = async (
    request: UnregisterNotificationInstallationReq,
  ): Promise<NotificationInstallationDTO> => {
    const response = await $api<NotificationInstallationDTO | Envelope<NotificationInstallationDTO>>(
      '/notifications/installations',
      {
        method: 'DELETE',
        body: request,
      },
    )
    return unwrap(response)
  }

  return { registerInstallation, streamNotifications, unregisterInstallation }
}
