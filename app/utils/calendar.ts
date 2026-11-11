import type { CalendarInput, CalendarOccurrence } from '@/api/calendar'

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function calendarDays(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first)
    day.setUTCDate(1 - offset + index)
    return day.toISOString().slice(0, 10)
  })
}
export function eventsOnDate(events: CalendarOccurrence[], date: string) {
  return events.filter(event => event.occurrence_start_date <= date && event.occurrence_end_date >= date)
}
export function validateCalendarInput(input: CalendarInput): string | null {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= '1000-01-01' && value <= '9999-12-31'
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!input.title.trim() || input.title.length > 255) return '请输入标题，最多 255 字。'
  if (!validDate(input.start_date) || !validDate(input.end_date)) return '请输入有效日期。'
  if (input.end_date < input.start_date) return '结束日期不能早于开始日期。'
  if (input.recurrence === 'yearly' && (!input.all_day || input.start_date !== input.end_date)) return '每年重复仅支持单日全天事件。'
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
  if (!input.all_day && (!input.start_time || !time.test(input.start_time))) return '请输入有效开始时间。'
  if (input.end_time && !time.test(input.end_time)) return '请输入有效结束时间。'
  if (input.end_time && input.end_date === input.start_date && input.end_time < (input.start_time ?? '')) return '结束时间不能早于开始时间。'
  try { new Intl.DateTimeFormat('zh-CN', { timeZone: input.timezone }).format(0) } catch { return '请输入有效 IANA 时区。' }
  if (!input.timezone || input.timezone.length > 64) return '请输入有效 IANA 时区。'
  if (input.source_url) {
    try { const url = new URL(input.source_url); if (!['http:', 'https:'].includes(url.protocol)) return '来源链接须使用 HTTP 或 HTTPS。' } catch { return '来源链接无效。' }
    if (input.source_url.length > 1000) return '来源链接最多 1000 字。'
  }
  if ((input.description?.length ?? 0) > 65535) return '描述内容过长。'
  return null
}
