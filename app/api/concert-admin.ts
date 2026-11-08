import { useHttp, unwrap, type Envelope } from './http'

export const TOUR_STATUSES = ['planned', 'ongoing', 'completed', 'cancelled', 'unknown'] as const
export const CONFIDENCE_LEVELS = ['confirmed', 'probable', 'unconfirmed', 'conflicting'] as const
export const SONG_STATUSES = ['active', 'deprecated', 'unknown'] as const
export const SONG_SINGERS = ['初音ミク', '鏡音リン', '鏡音レン', '巡音ルカ', 'MEIKO', 'KAITO', '重音テト'] as const
export const EVENT_TYPES = ['concert', 'festival', 'live_stream', 'special', 'unknown'] as const
export const EVENT_STATUSES = ['planned', 'completed', 'cancelled', 'postponed', 'unknown'] as const
export const SOURCE_TYPES = ['official', 'official_pdf', 'ticket', 'setlist', 'fan_report', 'video', 'database', 'unknown'] as const
export const SOURCE_RELIABILITIES = ['high', 'medium', 'low', 'unknown'] as const
export const SOURCE_RELATION_TYPES = ['tour_info', 'setlist', 'venue', 'schedule', 'media', 'other'] as const

export type TourStatus = typeof TOUR_STATUSES[number]
export type Confidence = typeof CONFIDENCE_LEVELS[number]
export type SongStatus = typeof SONG_STATUSES[number]
export type SongSinger = typeof SONG_SINGERS[number]
export type EventType = typeof EVENT_TYPES[number]
export type EventStatus = typeof EVENT_STATUSES[number]
export type SourceType = typeof SOURCE_TYPES[number]
export type SourceReliability = typeof SOURCE_RELIABILITIES[number]
export type SourceRelationType = typeof SOURCE_RELATION_TYPES[number]
export type ConcertResource = 'events' | 'tours' | 'venues' | 'songs' | 'sources'

export interface ConcertPaginationDTO {
  page: number
  page_size: number
  total: number
  has_more: boolean
}

export interface ConcertPageDTO<T> {
  items: T[]
  pagination: ConcertPaginationDTO
}

export interface BaseConcertDTO {
  id: number
  created_at: string
  updated_at: string
}

export interface TourDTO extends BaseConcertDTO {
  slug: string
  name: string
  name_original: string | null
  aliases: string[] | null
  organizer: string | null
  start_date: string | null
  end_date: string | null
  status: TourStatus
  confidence: Confidence
  notes: string | null
  event_count?: number
}

export interface TourInput {
  slug: string
  name: string
  name_original?: string | null
  aliases?: string[] | null
  organizer?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: TourStatus
  confidence?: Confidence
  notes?: string | null
}

export interface VenueDTO extends BaseConcertDTO {
  slug: string
  name: string
  name_original: string | null
  city: string
  prefecture: string | null
  country_code: string | null
  address: string | null
  timezone: string
  latitude: number | null
  longitude: number | null
  official_url: string | null
}

export interface VenueInput {
  slug: string
  name: string
  name_original?: string | null
  city: string
  prefecture?: string | null
  country_code?: string | null
  address?: string | null
  timezone: string
  latitude?: number | null
  longitude?: number | null
  official_url?: string | null
}

export interface SongDTO extends BaseConcertDTO {
  slug: string
  title: string
  aliases: string[] | null
  singer: string | null
  producer: string | null
  status: SongStatus
  notes: string | null
  callbook_count: number
}

export interface SongInput {
  slug: string
  title: string
  aliases?: string[] | null
  singer?: string | null
  producer?: string | null
  status?: SongStatus
  notes?: string | null
}

export interface CallbookPageDTO extends BaseConcertDTO {
  callbook_id: number
  page_no: number
  image_reference: string
}

export interface CallbookDTO extends BaseConcertDTO {
  song_id: number
  song_title: string
  metadata_text: string
  source: string
  pages: CallbookPageDTO[]
}

export interface CallbookPatch {
  metadata_text: string
  source: string
}

export interface SourceDTO extends BaseConcertDTO {
  url: string
  title: string | null
  publisher: string | null
  source_type: SourceType
  reliability: SourceReliability
  published_at: string | null
  accessed_at: string | null
  content_hash: string | null
  archived_url: string | null
}

export interface SourceInput {
  url: string
  title?: string | null
  publisher?: string | null
  source_type?: SourceType
  reliability?: SourceReliability
  published_at?: string | null
  accessed_at?: string | null
  content_hash?: string | null
  archived_url?: string | null
}

export interface EventDTO extends BaseConcertDTO {
  tour_id: number | null
  venue_id: number | null
  slug: string
  official_name: string
  event_type: EventType
  city: string | null
  timezone: string
  starts_at_utc: string | null
  ends_at_utc: string | null
  local_date: string | null
  local_start_time: string | null
  status: EventStatus
  confidence: Confidence
  notes: string | null
}

export interface EventInput {
  tour_id?: number | null
  venue_id?: number | null
  slug: string
  official_name: string
  event_type?: EventType
  city?: string | null
  timezone: string
  starts_at_utc?: string | null
  ends_at_utc?: string | null
  local_date?: string | null
  local_start_time?: string | null
  status?: EventStatus
  confidence?: Confidence
  notes?: string | null
}

export interface TourSourceInput {
  source_id: number
  relation_type: SourceRelationType
  is_primary?: boolean
  note?: string | null
}

export interface TourSourceDTO extends Required<Pick<TourSourceInput, 'source_id' | 'relation_type'>> {
  tour_id: number
  is_primary: boolean
  note: string | null
  source: SourceDTO | null
}

export interface SetlistItemInput {
  song_id: number
  version_label?: string | null
  is_encore?: boolean
  is_medley?: boolean
  confidence?: Confidence
  notes?: string | null
}

export interface SetlistItemDTO extends BaseConcertDTO {
  event_id: number
  position: number
  song_id: number | null
  version_label: string | null
  is_encore: boolean
  is_medley: boolean
  confidence: Confidence
  notes: string | null
  song: SongDTO | null
}

export interface ListQuery {
  page?: number
  page_size?: number
  q?: string
  [key: string]: string | number | undefined
}

const encodeId = (id: number) => encodeURIComponent(String(id))

export const useConcertAdminApi = () => {
  const { $api } = useHttp()

  const get = async <T>(path: string, query?: ListQuery): Promise<T> => {
    const response = await $api<T | Envelope<T>>(path, { method: 'GET', query })
    return unwrap(response)
  }

  const post = async <T, B extends object = object>(path: string, body: B): Promise<T> => {
    const response = await $api<T | Envelope<T>>(path, { method: 'POST', body })
    return unwrap(response)
  }

  const patch = async <T, B extends object = object>(path: string, body: B): Promise<T> => {
    const response = await $api<T | Envelope<T>>(path, { method: 'PATCH', body })
    return unwrap(response)
  }

  const put = async <T, B extends object = object>(path: string, body: B): Promise<T> => {
    const response = await $api<T | Envelope<T>>(path, { method: 'PUT', body })
    return unwrap(response)
  }

  const remove = async (path: string): Promise<{ id: number }> => {
    const response = await $api<{ id: number } | Envelope<{ id: number }>>(path, { method: 'DELETE' })
    return unwrap(response)
  }

  const base = '/admin/concerts'
  const concertAdminApi = {
    listTours: (query: ListQuery = {}) => get<ConcertPageDTO<TourDTO>>(`${base}/tours`, query),
    getTour: (id: number) => get<TourDTO>(`${base}/tours/${encodeId(id)}`),
    createTour: (input: TourInput) => post<TourDTO>(`${base}/tours`, input),
    updateTour: (id: number, input: Partial<TourInput>) => patch<TourDTO>(`${base}/tours/${encodeId(id)}`, input),
    deleteTour: (id: number) => remove(`${base}/tours/${encodeId(id)}`),
    getTourSources: (id: number) => get<TourSourceDTO[]>(`${base}/tours/${encodeId(id)}/sources`),
    replaceTourSources: (id: number, items: TourSourceInput[]) => put<TourSourceDTO[]>(`${base}/tours/${encodeId(id)}/sources`, { items }),

    listVenues: (query: ListQuery = {}) => get<ConcertPageDTO<VenueDTO>>(`${base}/venues`, query),
    getVenue: (id: number) => get<VenueDTO>(`${base}/venues/${encodeId(id)}`),
    createVenue: (input: VenueInput) => post<VenueDTO>(`${base}/venues`, input),
    updateVenue: (id: number, input: Partial<VenueInput>) => patch<VenueDTO>(`${base}/venues/${encodeId(id)}`, input),
    deleteVenue: (id: number) => remove(`${base}/venues/${encodeId(id)}`),

    listSongs: (query: ListQuery = {}) => get<ConcertPageDTO<SongDTO>>(`${base}/songs`, query),
    listSongProducers: (q?: string) => get<string[]>(`${base}/songs/producers`, q ? { q } : undefined),
    getSong: (id: number) => get<SongDTO>(`${base}/songs/${encodeId(id)}`),
    createSong: (input: SongInput) => post<SongDTO>(`${base}/songs`, input),
    updateSong: (id: number, input: Partial<SongInput>) => patch<SongDTO>(`${base}/songs/${encodeId(id)}`, input),
    deleteSong: (id: number) => remove(`${base}/songs/${encodeId(id)}`),
    getSongCallbooks: (id: number) => get<CallbookDTO[]>(`${base}/songs/${encodeId(id)}/callbooks`),
    updateCallbook: (id: number, input: CallbookPatch) => patch<CallbookDTO>(`${base}/callbooks/${encodeId(id)}`, input),

    listSources: (query: ListQuery = {}) => get<ConcertPageDTO<SourceDTO>>(`${base}/sources`, query),
    getSource: (id: number) => get<SourceDTO>(`${base}/sources/${encodeId(id)}`),
    createSource: (input: SourceInput) => post<SourceDTO>(`${base}/sources`, input),
    updateSource: (id: number, input: Partial<SourceInput>) => patch<SourceDTO>(`${base}/sources/${encodeId(id)}`, input),
    deleteSource: (id: number) => remove(`${base}/sources/${encodeId(id)}`),

    listEvents: (query: ListQuery = {}) => get<ConcertPageDTO<EventDTO>>(`${base}/events`, query),
    getEvent: (id: number) => get<EventDTO>(`${base}/events/${encodeId(id)}`),
    createEvent: (input: EventInput) => post<EventDTO>(`${base}/events`, input),
    updateEvent: (id: number, input: Partial<EventInput>) => patch<EventDTO>(`${base}/events/${encodeId(id)}`, input),
    deleteEvent: (id: number) => remove(`${base}/events/${encodeId(id)}`),
    getSetlist: (id: number) => get<SetlistItemDTO[]>(`${base}/events/${encodeId(id)}/setlist`),
    replaceSetlist: (id: number, items: SetlistItemInput[]) => put<SetlistItemDTO[]>(`${base}/events/${encodeId(id)}/setlist`, { items }),
  }

  return { concertAdminApi }
}
