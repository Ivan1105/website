import assert from 'node:assert/strict'
import test from 'node:test'
import { calendarDays, eventsOnDate, validateCalendarInput } from '../app/utils/calendar.ts'
import type { CalendarInput, CalendarOccurrence } from '../app/api/calendar.ts'

const input: CalendarInput = {
  title: '生日', description: null, event_type: 'birthday', start_date: '2024-02-29', end_date: '2024-02-29',
  all_day: true, start_time: null, end_time: null, timezone: 'Asia/Shanghai', recurrence: 'yearly', status: 'active', source_url: null,
}
test('月历为周一开始的六周网格，覆盖跨年和闰日', () => {
  const days = calendarDays('2026-01')
  assert.equal(days.length, 42)
  assert.equal(days[0], '2025-12-29')
  assert.equal(days[41], '2026-02-08')
  assert.ok(calendarDays('2024-02').includes('2024-02-29'))
  assert.ok(!calendarDays('2025-02').includes('2025-02-29'))
})
test('跨日事件覆盖两端，重复事件使用实际发生日期', () => {
  const event: CalendarOccurrence = {
    ...input, id: 1, user_id: null, concert_event_id: null, event_id: 1, created_at: '', updated_at: '',
    occurrence_start_date: '2028-02-29', occurrence_end_date: '2028-03-01',
  }
  assert.equal(eventsOnDate([event], '2028-02-29').length, 1)
  assert.equal(eventsOnDate([event], '2028-03-01').length, 1)
  assert.equal(eventsOnDate([event], '2024-02-29').length, 0)
})
test('表单校验日期、重复、时间、时区和安全来源链接', () => {
  assert.equal(validateCalendarInput(input), null)
  for (const patch of [
    { title: '' }, { start_date: '2025-02-29' }, { timezone: 'Invalid/Zone' },
    { recurrence: 'yearly', end_date: '2024-03-01' }, { all_day: false },
    { source_url: 'javascript:alert(1)' },
    { recurrence: 'none', all_day: false, start_time: '18:00:00', end_time: '09:00:00' },
  ]) assert.notEqual(validateCalendarInput({ ...input, ...patch } as CalendarInput), null)
  assert.equal(validateCalendarInput({ ...input, recurrence: 'none', all_day: false, start_time: '18:00:00', end_date: '2024-03-01', end_time: '09:00:00' }), null)
})
