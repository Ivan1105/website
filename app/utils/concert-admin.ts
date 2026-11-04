import type {
  Confidence,
  EventStatus,
  EventType,
  SongStatus,
  SourceRelationType,
  SourceReliability,
  SourceType,
  TourStatus,
} from '@/api'

export const confidenceLabels: Record<Confidence, string> = {
  confirmed: '已确认', probable: '较可信', unconfirmed: '未确认', conflicting: '存在冲突',
}
export const tourStatusLabels: Record<TourStatus, string> = {
  planned: '计划中', ongoing: '进行中', completed: '已结束', cancelled: '已取消', unknown: '未知',
}
export const songStatusLabels: Record<SongStatus, string> = {
  active: '有效', deprecated: '已停用', unknown: '未知',
}
export const eventTypeLabels: Record<EventType, string> = {
  concert: '演唱会', festival: '音乐节', live_stream: '线上直播', special: '特别活动', unknown: '未知',
}
export const eventStatusLabels: Record<EventStatus, string> = {
  planned: '计划中', completed: '已结束', cancelled: '已取消', postponed: '已延期', unknown: '未知',
}
export const sourceTypeLabels: Record<SourceType, string> = {
  official: '官方页面', official_pdf: '官方 PDF', ticket: '票务页面', setlist: '歌单资料',
  fan_report: '粉丝报告', video: '视频资料', database: '资料数据库', unknown: '未知',
}
export const sourceReliabilityLabels: Record<SourceReliability, string> = {
  high: '高', medium: '中', low: '低', unknown: '未知',
}
export const sourceRelationLabels: Record<SourceRelationType, string> = {
  event_info: '活动信息', setlist: '歌单', venue: '场地', schedule: '日程', media: '媒体资料', other: '其他',
}

export const timezoneSuggestions = [
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Seoul',
  'Europe/London', 'Europe/Paris', 'America/Los_Angeles', 'America/New_York', 'Australia/Sydney',
]

export function enumItems<T extends string>(labels: Record<T, string>) {
  return Object.entries(labels).map(([value, title]) => ({ value: value as T, title: String(title) }))
}

export function toNullable(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ''
  return text || null
}

export function toLocalDateTimeInput(value: string | null, timezone: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = zonedParts(date, timezone)
  return `${parts.date}T${parts.time.slice(0, 5)}`
}

export function zonedLocalToUtc(value: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) throw new Error('日期时间格式无效')
  assertTimezone(timezone)
  const target = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6] ?? 0),
  )
  let guess = target
  for (let index = 0; index < 4; index += 1) {
    const displayed = zonedParts(new Date(guess), timezone)
    const displayedUtc = Date.UTC(
      Number(displayed.date.slice(0, 4)), Number(displayed.date.slice(5, 7)) - 1,
      Number(displayed.date.slice(8, 10)), Number(displayed.time.slice(0, 2)),
      Number(displayed.time.slice(3, 5)), Number(displayed.time.slice(6, 8)),
    )
    const delta = target - displayedUtc
    guess += delta
    if (delta === 0) break
  }
  const result = new Date(guess)
  const roundTrip = zonedParts(result, timezone)
  const expected = `${value.slice(0, 16)}:00`
  if (`${roundTrip.date}T${roundTrip.time}` !== expected) {
    throw new Error('该当地时间在所选时区不存在，请检查夏令时切换')
  }
  return result.toISOString()
}

export function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0)
  } catch {
    throw new Error('请输入有效的 IANA 时区，例如 Asia/Tokyo')
  }
}

export function formatDate(value: string | null): string {
  if (!value) return '未设置'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(date)
}

export function formatTimestamp(value: string | null): string {
  if (!value) return '未设置'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function zonedParts(date: Date, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` }
}
