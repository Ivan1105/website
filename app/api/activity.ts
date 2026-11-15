import { useHttp, unwrap, type Envelope } from './http'

export type ReviewStatus = 'pending' | 'approved' | 'rejected'
export interface MonitorPageInput { name: string; url: string }
export interface MonitorPage extends MonitorPageInput {
  id: number; activity_id: number; sort_order: number
  last_checked_at: string | null; last_succeeded_at: string | null; last_error: string | null
}
export interface Activity {
  id: number
  original_title: string
  chinese_title: string | null
  summary: string | null
  official_url: string | null
  official_url_is_specific: number
  monitor_enabled: number
  monitor_page_count: number
  review_status: ReviewStatus
  reviewed_by: number | null
  reviewed_at: string | null
  review_note: string | null
  last_checked_at: string | null
  last_succeeded_at: string | null
  last_error: string | null
  updated_at: string
}
export interface ActivityDetail extends Activity {
  monitor_pages: MonitorPage[]
  source_items: { id: number; title: string; detail_url: string; fetch_status: string; processing_status: string; last_error: string | null }[]
  snapshots: { id: number; version_no: number; fetched_at: string; diff_text: string | null; page_url: string; page_name: string }[]
}
export interface Announcement {
  page_name?: string | null
  id: number
  activity_id: number
  activity_title: string
  title: string | null
  content: string | null
  importance: 'low' | 'medium' | 'high' | null
  importance_reason: string | null
  announcement_type: 'discovery' | 'update'
  generation_status: 'pending' | 'ready' | 'failed'
  source_url: string
  source_published_at: string | null
  discovered_at: string
  generated_at: string | null
  last_error: string | null
}
export interface CrawlRun {
  id: number
  trigger_type: 'manual' | 'scheduled'
  status: 'running' | 'succeeded' | 'partial' | 'failed' | 'interrupted'
  started_at: string
  finished_at: string | null
  new_item_count: number
  change_count: number
  announcement_count: number
  failure_count: number
  error_summary: string | null
}
export interface ActivityPage<T> { items: T[]; pagination: { page: number; page_size: number; total: number; has_more: boolean } }
export interface ActivityQuery {
  page: number; page_size: number; q?: string; review_status?: ReviewStatus
  importance?: string; announcement_type?: string; generation_status?: string; from?: string; to?: string
}
export interface ActivityPatch {
  original_title: string; chinese_title: string | null; summary: string | null
  monitor_pages: MonitorPageInput[]; official_url_is_specific: boolean; monitor_enabled?: boolean
}
export function useActivityApi() {
  const { $api } = useHttp()
  const get = async <T>(path: string, query?: ActivityQuery) => unwrap(await $api<Envelope<T>>(`/admin/activities/${path}`, { query, retry: 0 }))
  return {
    events: (query: ActivityQuery) => get<ActivityPage<Activity>>('events', query),
    event: (id: number) => get<ActivityDetail>(`events/${id}`),
    announcements: (query: ActivityQuery) => get<ActivityPage<Announcement>>('announcements', query),
    announcement: (id: number) => get<Announcement>(`announcements/${id}`),
    runs: (query: ActivityQuery) => get<ActivityPage<CrawlRun>>('crawl-runs', query),
    run: (id: number) => get<CrawlRun>(`crawl-runs/${id}`),
    update: async (id: number, body: ActivityPatch) => unwrap(await $api<Envelope<Activity>>(`/admin/activities/events/${id}`, { method: 'PATCH', body, retry: 0 })),
    review: async (id: number, status: 'approved' | 'rejected', note: string) => unwrap(await $api<Envelope<Activity>>(`/admin/activities/events/${id}/review`, { method: 'POST', body: { status, note }, retry: 0 })),
    start: async () => unwrap(await $api<Envelope<CrawlRun>>('/admin/activities/crawl-runs', { method: 'POST', retry: 0 })),
  }
}
