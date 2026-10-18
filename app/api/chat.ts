import { ApiError, useHttp, unwrap, type Envelope, getToken } from './http'

export interface ConversationDTO {
  id: number
  name: string
  display_name: string
  avatar: string
  thread_id?: string
  proactive_enabled: boolean
  journal_enabled: boolean
}

export interface MessageDTO {
  id: string
  role: 'user' | 'assistant' | 'signal'
  content: string
  createdAt: string
}

export interface MessagePaginationDTO {
  page: number
  page_size: number
  total: number
  has_more: boolean
}

export interface ActiveRunUserMessageDTO {
  id: string
  role: 'user'
  content: string
  createdAt: string
}

export interface ActiveRunDTO {
  run_id: string
  status: 'running'
  started_at: string
  user_message: ActiveRunUserMessageDTO
}

export interface QueryMessagesDTO {
  messages: MessageDTO[]
  active_run: ActiveRunDTO | null
  pagination: MessagePaginationDTO
}

export interface SendMessageReq {
  content: string
  agentId: string
  threadId?: string
}

export interface SendMessageDTO {
  thread_id: string
  run_id: string
  status: 'running'
}

export interface UpdateProactiveReq {
  agentId: string
  enabled: boolean
}

export interface UpdateJournalReq {
  agentId: string
  enabled: boolean
}

export interface CreateThreadDTO {
  thread_id: string
}

export interface ChatRunMessageStartEvent {
  type: 'message_start'
  run_id: string
  message_id: string
}

export interface ChatRunTextEvent {
  type: 'text'
  run_id: string
  message_id: string
  content: string
}

export interface ChatRunToolCallEvent {
  type: 'tool_call'
  run_id: string
  message_id: string
  tool_call_id: string
  tool_name: string
}

export interface ChatRunToolResultEvent {
  type: 'tool_result'
  run_id: string
  message_id: string
  tool_call_id: string
  tool_name: string
  is_error: boolean
}

export interface ChatRunDoneEvent {
  type: 'done'
  run_id: string
}

export interface ChatRunErrorEvent {
  type: 'error'
  run_id: string
  message: string
}

export type ChatRunStreamEvent =
  | ChatRunMessageStartEvent
  | ChatRunTextEvent
  | ChatRunToolCallEvent
  | ChatRunToolResultEvent
  | ChatRunDoneEvent
  | ChatRunErrorEvent

export const useChatApi = () => {
  const { $api } = useHttp()

  const chatApi = {
    async getConversations(): Promise<ConversationDTO[]> {
      const resp = await $api<ConversationDTO[] | Envelope<ConversationDTO[]>>('/chatbox/queryConversations', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async getMessages(threadId: string, page = 0, pageSize = 20): Promise<QueryMessagesDTO> {
      const resp = await $api<QueryMessagesDTO | Envelope<QueryMessagesDTO>>(`/chatbox/queryMessages/${encodeURIComponent(threadId)}`, {
        method: 'GET',
        query: {
          page,
          page_size: pageSize,
        },
      })
      return unwrap(resp)
    },

    async createThread(agentName: string): Promise<CreateThreadDTO> {
      const resp = await $api<CreateThreadDTO | Envelope<CreateThreadDTO>>('/chatbox/createThread', {
        method: 'POST',
        body: { agentName },
      })
      return unwrap(resp)
    },

    async updateProactive(req: UpdateProactiveReq): Promise<void> {
      const resp = await $api<unknown>('/chatbox/proactive', {
        method: 'POST',
        body: req,
      })
      unwrap(resp)
    },

    async updateJournal(req: UpdateJournalReq): Promise<void> {
      const resp = await $api<unknown>('/chatbox/journal', {
        method: 'POST',
        body: req,
      })
      unwrap(resp)
    },

    async sendMessage(data: SendMessageReq): Promise<SendMessageDTO> {
      const resp = await $api<SendMessageDTO | Envelope<SendMessageDTO>>('/chatbox/sendMessage', {
        method: 'POST',
        body: data,
      })
      return unwrap(resp)
    },

    async streamRun(runId: string, onEvent: (event: ChatRunStreamEvent) => void, signal?: AbortSignal): Promise<void> {
      const runtimeConfig = useRuntimeConfig()
      const baseURL = runtimeConfig.public.apiUrl ?? ''

      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
      }
      const token = getToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const resp = await fetch(`${baseURL}/chatbox/runs/${encodeURIComponent(runId)}/stream`, {
        method: 'GET',
        headers,
        signal,
      })

      if (!resp.ok) {
        let message = `HTTP ${resp.status}`
        let data: unknown
        try {
          data = await resp.clone().json()
          if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
            message = data.message
          }
        } catch {
          // 非 JSON 错误响应保留 HTTP 状态信息
        }
        throw new ApiError(message, resp.status, data)
      }
      if (!resp.body) {
        throw new ApiError('响应内容为空', resp.status)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = ''
      let eventData: string[] = []
      let streamDone = false

      const requireString = (event: Record<string, unknown>, field: string, payload: unknown) => {
        const value = event[field]
        if (typeof value !== 'string' || !value.trim()) {
          throw new ApiError(`回复流字段 ${field} 格式错误`, resp.status, payload)
        }
        return value
      }

      const dispatchEvent = () => {
        const currentEventName = eventName
        const chunk = eventData.join('\n')
        eventName = ''
        eventData = []

        if (!currentEventName && !chunk) return
        if (currentEventName === 'ping') return
        if (!['message_start', 'text', 'tool_call', 'tool_result', 'done', 'error'].includes(currentEventName)) return

        let payload: unknown
        try {
          payload = JSON.parse(chunk)
        } catch {
          throw new ApiError('回复流数据格式错误', resp.status, chunk)
        }

        if (!payload || typeof payload !== 'object') {
          throw new ApiError('回复流数据格式错误', resp.status, payload)
        }

        const event = payload as Record<string, unknown>
        const eventRunId = requireString(event, 'run_id', payload)
        if (eventRunId !== runId) {
          throw new ApiError('回复流运行标识不匹配', resp.status, payload)
        }

        switch (currentEventName) {
          case 'message_start':
            onEvent({
              type: currentEventName,
              run_id: eventRunId,
              message_id: requireString(event, 'message_id', payload),
            })
            break
          case 'text':
            if (typeof event.content !== 'string') {
              throw new ApiError('回复流文本内容格式错误', resp.status, payload)
            }
            onEvent({
              type: currentEventName,
              run_id: eventRunId,
              message_id: requireString(event, 'message_id', payload),
              content: event.content,
            })
            break
          case 'tool_call':
            onEvent({
              type: currentEventName,
              run_id: eventRunId,
              message_id: requireString(event, 'message_id', payload),
              tool_call_id: requireString(event, 'tool_call_id', payload),
              tool_name: requireString(event, 'tool_name', payload),
            })
            break
          case 'tool_result':
            if (typeof event.is_error !== 'boolean') {
              throw new ApiError('回复流工具结果格式错误', resp.status, payload)
            }
            onEvent({
              type: currentEventName,
              run_id: eventRunId,
              message_id: requireString(event, 'message_id', payload),
              tool_call_id: requireString(event, 'tool_call_id', payload),
              tool_name: requireString(event, 'tool_name', payload),
              is_error: event.is_error,
            })
            break
          case 'done':
            onEvent({ type: currentEventName, run_id: eventRunId })
            streamDone = true
            break
          case 'error': {
            const message = requireString(event, 'message', payload)
            onEvent({ type: currentEventName, run_id: eventRunId, message })
            streamDone = true
            break
          }
        }
      }

      const processLine = (part: string) => {
        let line = part
        // 去除 CRLF 的 \r
        if (line.endsWith('\r')) line = line.slice(0, -1)

        if (line.startsWith('event:')) {
          eventName = line.slice(6)
          if (eventName.startsWith(' ')) eventName = eventName.slice(1)
          return
        }
        // 跳过其余 SSE 控制行（id/retry/comment）
        if (/^(id|retry):/i.test(line) || line.startsWith(':')) return
        // 空行表示当前 SSE 事件结束
        if (line === '') {
          dispatchEvent()
          return
        }

        if (line.startsWith('data:')) {
          let chunk = line.slice(5)
          // SSE 规范：data: 后有一个可选空格
          if (chunk.startsWith(' ')) chunk = chunk.slice(1)
          eventData.push(chunk)
        }
      }

      for (; !streamDone;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 按行处理，保留不完整的行在 buffer 中
        const parts = buffer.split('\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          processLine(part)
          if (streamDone) break
        }
      }

      if (streamDone) {
        await reader.cancel()
        return
      }

      // 解码并处理最后一条未以换行符结尾的数据
      buffer += decoder.decode()
      if (buffer) processLine(buffer)
      dispatchEvent()
    },
  }

  return {
    chatApi,
  }
}
