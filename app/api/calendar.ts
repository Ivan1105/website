import { useHttp, unwrap, type Envelope } from './http'

export type CalendarType = 'birthday' | 'concert' | 'ticket_deadline' | 'other'
export type CalendarStatus = 'active' | 'cancelled'
export interface CalendarInput {
  title: string
  description: string | null
  event_type: CalendarType
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  timezone: string
  recurrence: 'none' | 'yearly'
  status: CalendarStatus
  source_url: string | null
}
export interface CalendarEvent extends CalendarInput {
  id: number
  user_id: number | null
  created_at: string
  updated_at: string
}
export interface CalendarOccurrence extends CalendarEvent {
  event_id: number
  occurrence_start_date: string
  occurrence_end_date: string
}
export const calendarTypes: Array<{ title: string; value: CalendarType }> = [
  { title: '生日', value: 'birthday' }, { title: '演出', value: 'concert' },
  { title: '抽票截止', value: 'ticket_deadline' }, { title: '其他', value: 'other' },
]
export const calendarTypeLabel = (type: CalendarType) => calendarTypes.find(item => item.value === type)?.title ?? '其他'

export function useCalendarApi() {
  const { $api } = useHttp()
  return {
    async occurrences(query: { date_from: string; date_to: string; event_type?: CalendarType; status: CalendarStatus }, admin: boolean) {
      return unwrap(await $api<Envelope<{ items: CalendarOccurrence[] }>>(`${admin ? '/admin' : ''}/calendar/occurrences`, { query }))
    },
    async detail(id: number, admin: boolean) {
      return unwrap(await $api<Envelope<CalendarEvent>>(`${admin ? '/admin' : ''}/calendar/events/${id}`))
    },
    async save(input: CalendarInput, id?: number) {
      return unwrap(await $api<Envelope<CalendarEvent>>(`/admin/calendar/events${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: input }))
    },
    async status(id: number, status: CalendarStatus) {
      return unwrap(await $api<Envelope<CalendarEvent>>(`/admin/calendar/events/${id}`, { method: 'PATCH', body: { status } }))
    },
    async remove(id: number) {
      return unwrap(await $api<Envelope<{ id: number }>>(`/admin/calendar/events/${id}`, { method: 'DELETE' }))
    },
  }
}
