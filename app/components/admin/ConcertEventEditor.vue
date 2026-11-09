<template>
  <div class="event-editor">
    <header class="editor-header">
      <div><p class="eyebrow">EVENT / 演出场次</p><h2>{{ editorTitle }}</h2></div>
      <v-btn icon="mdi-close" variant="text" aria-label="关闭编辑器" :disabled="saving" @click="$emit('cancel')" />
    </header>

    <v-alert
      v-if="error" type="error" variant="tonal" density="comfortable" :closable="!relationsLoadFailed"
      @click:close="error = null"
    >{{ error }}</v-alert>
    <v-alert v-if="success" type="success" variant="tonal" density="compact" closable @click:close="success = null">{{ success }}</v-alert>
    <v-alert v-if="copyingMode && relationsLoading" type="info" variant="tonal" density="compact">
      正在复制原场次的歌单，请稍候。
    </v-alert>

    <v-form class="event-form" @submit.prevent="save">
      <section class="form-section">
        <div class="section-heading"><div><p class="eyebrow">BASIC</p><h3>基础信息</h3></div></div>
        <v-text-field v-model.trim="form.official_name" label="官方场次名称 *" :rules="requiredRules" />
        <v-text-field v-model.trim="form.slug" label="Slug *" :rules="slugRules" />
        <div class="form-grid">
          <v-autocomplete
            v-model="form.tour_id" label="所属巡演" :items="tourOptions" item-title="name" item-value="id"
            clearable :loading="optionLoading.tours" no-data-text="noData.tours" @update:search="searchTours"
          />
          <v-autocomplete
            v-model="form.venue_id" label="场地" :items="venueOptions" item-title="name" item-value="id"
            clearable :loading="optionLoading.venues" no-data-text="noData.venues" @update:search="searchVenues"
          />
          <v-select v-model="form.event_type" label="演出类型" :items="eventTypeItems" />
          <v-text-field v-model.trim="form.city" label="城市" />
          <v-combobox v-model.trim="form.timezone" label="IANA 时区 *" :items="timezoneSuggestions" :rules="requiredRules" />
          <v-select v-model="form.status" label="状态" :items="eventStatusItems" />
          <v-select v-model="form.confidence" label="确认级别" :items="confidenceItems" />
        </div>
      </section>

      <section class="form-section">
        <div class="section-heading"><div><p class="eyebrow">SCHEDULE</p><h3>演出时间</h3></div></div>
        <div class="form-grid">
          <v-text-field v-model="form.local_date" label="当地日期" type="date" />
          <v-text-field v-model="form.local_start_time" label="当地开始时间" type="time" step="60" :disabled="!form.local_date" />
        </div>
        <div v-if="timePreview || timeError" class="time-preview" :class="{ 'time-preview-error': timeError }">
          <v-icon :icon="timeError ? 'mdi-alert-circle-outline' : 'mdi-clock-check-outline'" size="18" />
          <span>{{ timeError || timePreview }}</span>
        </div>
        <v-textarea v-model="form.notes" label="备注" rows="3" auto-grow />
      </section>

      <template v-if="canEditRelations">
        <section class="form-section">
          <div class="section-heading">
            <div><p class="eyebrow">SETLIST</p><h3>歌单</h3><p class="muted">拖动手柄调整顺序，保存时将整单覆盖。</p></div>
            <div class="section-actions">
              <v-btn variant="text" color="secondary" size="small" prepend-icon="mdi-music-note-plus" :disabled="relationsLoading" @click="addSetlistItem">添加歌曲</v-btn>
              <v-btn variant="text" color="secondary" size="small" prepend-icon="mdi-content-copy" :disabled="setlistActionsDisabled" @click="copySetlistJson">复制 JSON</v-btn>
              <v-btn variant="text" color="secondary" size="small" prepend-icon="mdi-content-paste" :disabled="setlistActionsDisabled" @click="pasteSetlistJson">粘贴 JSON</v-btn>
              <v-btn variant="text" color="secondary" size="small" @click="$emit('switch-resource', 'songs')">维护歌曲库</v-btn>
            </div>
          </div>

          <div v-if="relationsLoading" class="relation-loading"><v-progress-circular indeterminate size="24" width="2" color="primary" /> 正在加载歌单…</div>
          <div v-else-if="!setlist.length" class="relation-empty">尚未添加歌单。</div>
          <VueDraggable v-else v-model="setlist" handle=".setlist-drag-handle" :animation="180" class="setlist-list">
            <article v-for="(item, index) in setlist" :key="item.key" class="setlist-row">
              <button type="button" class="setlist-drag-handle" :aria-label="`拖动第 ${index + 1} 首歌曲`"><v-icon icon="mdi-drag" /></button>
              <span class="setlist-position">{{ index + 1 }}</span>
              <div class="setlist-fields">
                <v-autocomplete
                  v-model="item.song_id" label="标准歌曲" :items="songOptions" item-title="title" item-value="id"
                  density="compact" clearable :custom-key-filter="songCustomKeyFilter" :filter-keys="songFilterKeys"
                  no-data-text="noData.songs" :loading="optionLoading.songs"
                  @update:menu="handleSongMenuUpdate" @update:search="searchSongs"
                />
                <v-text-field v-model.trim="item.version_label" label="版本" density="compact" />
                <v-select v-model="item.confidence" label="确认级别" :items="confidenceItems" density="compact" />
                <div class="setlist-flags">
                  <v-checkbox v-model="item.is_encore" label="安可" density="compact" hide-details />
                  <v-checkbox v-model="item.is_medley" label="组曲" density="compact" hide-details />
                </div>
              </div>
              <div class="setlist-actions">
                <v-btn icon="mdi-arrow-up" size="x-small" variant="text" :disabled="index === 0" :aria-label="`上移第 ${index + 1} 首`" @click="moveSetlist(index, -1)" />
                <v-btn icon="mdi-arrow-down" size="x-small" variant="text" :disabled="index === setlist.length - 1" :aria-label="`下移第 ${index + 1} 首`" @click="moveSetlist(index, 1)" />
                <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" :aria-label="`删除第 ${index + 1} 首`" @click="setlist.splice(index, 1)" />
              </div>
            </article>
          </VueDraggable>
        </section>

      </template>

      <v-alert v-else type="info" variant="tonal" density="comfortable">
        请先保存基础信息。创建场次后即可维护歌单。
      </v-alert>

      <footer class="editor-actions">
        <v-btn variant="text" :disabled="saving" @click="$emit('cancel')">关闭</v-btn>
        <v-btn
          type="submit" color="primary" :loading="saving" :disabled="relationsLoading || relationsLoadFailed"
          prepend-icon="mdi-content-save-outline"
        >
          {{ currentEvent ? '保存全部' : '保存并继续编辑' }}
        </v-btn>
      </footer>
    </v-form>

  </div>
</template>

<script setup lang="ts">
import { useTimer } from '@vuetify/v0'
import { VueDraggable } from 'vue-draggable-plus'
import type { FilterFunction } from 'vuetify'
import {
  isApiError,
  CONFIDENCE_LEVELS,
  useConcertAdminApi,
  type ConcertResource,
  type EventDTO,
  type EventInput,
  type SetlistItemInput,
  type SongDTO,
  type TourDTO,
  type VenueDTO,
} from '@/api'
import {
  confidenceLabels, enumItems, eventStatusLabels, eventTypeLabels,
  timezoneSuggestions, toLocalDateTimeInput, toNullable, zonedLocalToUtc,
} from '@/utils/concert-admin'

interface EventFormState {
  tour_id: number | null; venue_id: number | null; slug: string; official_name: string
  event_type: EventDTO['event_type']; city: string; timezone: string
  local_date: string; local_start_time: string
  status: EventDTO['status']; confidence: EventDTO['confidence']; notes: string
}
interface EditableSetlistItem extends Omit<SetlistItemInput, 'song_id'> { key: string; song_id: number | null; version_label: string; confidence: EventDTO['confidence']; notes: string; is_encore: boolean; is_medley: boolean }
interface SetlistJsonItem { song_id: number; title: string; version_label: string | null; is_encore: boolean; is_medley: boolean; confidence: EventDTO['confidence']; notes: string | null }
interface SetlistJsonDocument { format_version: 1; items: SetlistJsonItem[] }

const props = defineProps<{ record: EventDTO | null; copySource: EventDTO | null }>()
const emit = defineEmits<{
  saved: [record: EventDTO]
  cancel: []
  'dirty-change': [dirty: boolean]
  'switch-resource': [resource: Extract<ConcertResource, 'songs'>]
}>()
const { concertAdminApi } = useConcertAdminApi()
const currentEvent = ref<EventDTO | null>(null)
const form = reactive<EventFormState>(emptyForm())
const setlist = ref<EditableSetlistItem[]>([])
const tourOptions = ref<TourDTO[]>([])
const venueOptions = ref<VenueDTO[]>([])
const songOptions = ref<SongDTO[]>([])
const visibleSongIds = shallowRef<ReadonlySet<number>>(new Set())
const songFilterKeys = ['title']
const filterVisibleSong: FilterFunction = (_value, _query, item) => {
  const song = item?.raw as unknown
  return isSongOption(song) && visibleSongIds.value.has(song.id)
}
const songCustomKeyFilter: Record<string, FilterFunction> = { title: filterVisibleSong }
const optionLoading = reactive({ tours: false, venues: false, songs: false })
const relationsLoading = ref(false)
const relationsLoadFailed = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const baseline = ref('')
const optionRequest = reactive({ tours: 0, venues: 0, songs: 0 })
const pendingSongSearch = shallowRef<string | undefined>()
let resetVersion = 0

const SONG_SEARCH_DEBOUNCE_MS = 300
const songSearchTimer = useTimer(() => {
  void loadSongs(pendingSongSearch.value)
}, { duration: SONG_SEARCH_DEBOUNCE_MS })

const eventTypeItems = enumItems(eventTypeLabels)
const eventStatusItems = enumItems(eventStatusLabels)
const confidenceItems = enumItems(confidenceLabels)
const requiredRules = [(value: string) => !!value?.trim() || '此项为必填']
const slugRules = [...requiredRules, (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || '只能包含小写字母、数字和连字符']
const copyingMode = computed(() => props.copySource !== null && props.record === null)
const canEditRelations = computed(() => currentEvent.value !== null || copyingMode.value)
const setlistActionsDisabled = computed(() => relationsLoading.value || relationsLoadFailed.value || saving.value)
const editorTitle = computed(() => currentEvent.value ? '编辑演出场次' : copyingMode.value ? '复制演出场次' : '新增演出场次')

const timeState = computed(() => {
  try {
    if (!form.local_date || !form.local_start_time) return { start: null, error: null }
    const start = zonedLocalToUtc(`${form.local_date}T${form.local_start_time.slice(0, 5)}`, form.timezone)
    return { start, error: null }
  } catch (caught) {
    return { start: null, error: caught instanceof Error ? caught.message : '时间换算失败' }
  }
})
const timeError = computed(() => timeState.value.error)
const timePreview = computed(() => timeState.value.start
  ? `UTC：${timeState.value.start}`
  : form.local_date ? '已记录当地日期；填写开始时间后将自动换算 UTC。' : '')

watch(() => [props.record, props.copySource] as const, reset, { immediate: true })
watch([form, setlist], () => emit('dirty-change', snapshot() !== baseline.value), { deep: true })
onBeforeUnmount(() => songSearchTimer.stop())

async function reset() {
  const version = ++resetVersion
  songSearchTimer.stop()
  pendingSongSearch.value = undefined
  currentEvent.value = props.record
  Object.assign(form, emptyForm())
  setlist.value = []
  relationsLoading.value = false
  relationsLoadFailed.value = false
  error.value = null
  success.value = null
  if (props.record) fillForm(props.record)
  else if (props.copySource) {
    fillCopyForm(props.copySource)
    markUnsavedCopy(version)
  }
  await Promise.all([loadTours(), loadVenues(), loadSongs()])
  if (version !== resetVersion) return
  const relationSource = props.record ?? props.copySource
  if (relationSource) await loadRelations(relationSource.id, version)
  if (version !== resetVersion) return
  if (!copyingMode.value) markClean(version)
}

function emptyForm(): EventFormState {
  return { tour_id: null, venue_id: null, slug: '', official_name: '', event_type: 'concert', city: '', timezone: 'Asia/Tokyo', local_date: '', local_start_time: '', status: 'unknown', confidence: 'confirmed', notes: '' }
}

function fillForm(record: EventDTO) {
  const startLocal = record.starts_at_utc ? toLocalDateTimeInput(record.starts_at_utc, record.timezone) : ''
  Object.assign(form, {
    tour_id: record.tour_id, venue_id: record.venue_id, slug: record.slug, official_name: record.official_name,
    event_type: record.event_type, city: record.city ?? '', timezone: record.timezone,
    local_date: startLocal.slice(0, 10) || record.local_date || '',
    local_start_time: startLocal.slice(11, 16) || record.local_start_time?.slice(0, 5) || '',
    status: record.status, confidence: record.confidence, notes: record.notes ?? '',
  })
}

function fillCopyForm(record: EventDTO) {
  fillForm(record)
}

async function loadRelations(id: number, version: number) {
  relationsLoading.value = true
  try {
    const setlistData = await concertAdminApi.getSetlist(id)
    if (version !== resetVersion) return
    setlist.value = setlistData.map(item => ({
      key: crypto.randomUUID(), song_id: item.song_id, version_label: item.version_label ?? '', is_encore: item.is_encore,
      is_medley: item.is_medley, confidence: item.confidence, notes: item.notes ?? '',
    }))
    mergeOptions(songOptions, setlistData.flatMap(item => item.song ? [item.song] : []))
  } catch (caught) {
    if (version !== resetVersion) return
    setlist.value = []
    relationsLoadFailed.value = true
    error.value = isApiError(caught) ? caught.message : '暂时无法加载歌单，请关闭后重试。'
  } finally {
    if (version === resetVersion) relationsLoading.value = false
  }
}

async function save() {
  if (saving.value || relationsLoading.value || relationsLoadFailed.value) return
  error.value = null
  success.value = null
  if (!form.official_name.trim() || !form.slug.trim() || !form.timezone.trim()) { error.value = '请填写所有必填项。'; return }
  if (timeError.value) { error.value = timeError.value; return }
  if (setlist.value.some(item => item.song_id === null)) { error.value = '请选择歌单中的每首标准歌曲。'; return }
  saving.value = true
  try {
    const input = buildInput()
    const saved = currentEvent.value
      ? await concertAdminApi.updateEvent(currentEvent.value.id, input)
      : await concertAdminApi.createEvent(input)
    currentEvent.value = saved
    fillForm(saved)
    if (props.record || props.copySource || setlist.value.length) {
      const savedSetlist = await concertAdminApi.replaceSetlist(saved.id, setlist.value.map(toSetlistInput))
      setlist.value = savedSetlist.map(item => ({ key: crypto.randomUUID(), song_id: item.song_id, version_label: item.version_label ?? '', is_encore: item.is_encore, is_medley: item.is_medley, confidence: item.confidence, notes: item.notes ?? '' }))
    }
    success.value = props.record ? '演出资料已保存。' : props.copySource ? '场次副本已创建，现在可以继续编辑。' : '场次已创建，现在可以继续维护歌单。'
    markClean()
    emit('saved', saved)
  } catch (caught) {
    error.value = isApiError(caught) ? caught.message : caught instanceof Error ? caught.message : '保存失败，请稍后重试。'
  } finally {
    saving.value = false
  }
}

function buildInput(): EventInput {
  return {
    tour_id: form.tour_id, venue_id: form.venue_id, slug: form.slug.trim(), official_name: form.official_name.trim(),
    event_type: form.event_type, city: toNullable(form.city), timezone: form.timezone.trim(),
    local_date: form.local_date || null, local_start_time: form.local_start_time ? `${form.local_start_time.slice(0, 5)}:00` : null,
    starts_at_utc: timeState.value.start,
    status: form.status, confidence: form.confidence, notes: toNullable(form.notes),
  }
}

function addSetlistItem() { setlist.value.push({ key: crypto.randomUUID(), song_id: null, version_label: '', is_encore: false, is_medley: false, confidence: 'confirmed', notes: '' }) }
function moveSetlist(index: number, delta: number) { const target = index + delta; if (target < 0 || target >= setlist.value.length) return; const [item] = setlist.value.splice(index, 1); if (item) setlist.value.splice(target, 0, item) }
function toSetlistInput(item: EditableSetlistItem): SetlistItemInput { return { song_id: item.song_id!, version_label: toNullable(item.version_label), is_encore: item.is_encore, is_medley: item.is_medley, confidence: item.confidence, notes: toNullable(item.notes) } }

async function copySetlistJson() {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('当前浏览器不支持剪贴板写入。')
    if (setlist.value.some(item => item.song_id === null)) throw new Error('请先为歌单中的每一项选择标准歌曲。')
    const document: SetlistJsonDocument = {
      format_version: 1,
      items: setlist.value.map((item) => {
        const song = songOptions.value.find(option => option.id === item.song_id)
        return {
          song_id: item.song_id!, title: song?.title ?? '', version_label: toNullable(item.version_label),
          is_encore: item.is_encore, is_medley: item.is_medley, confidence: item.confidence, notes: toNullable(item.notes),
        }
      }),
    }
    await navigator.clipboard.writeText(JSON.stringify(document, null, 2))
    success.value = '歌单 JSON 已复制到剪贴板。'
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '复制歌单 JSON 失败。'
  }
}

async function pasteSetlistJson() {
  try {
    if (!navigator.clipboard?.readText) throw new Error('当前浏览器不支持从剪贴板读取。')
    const text = await navigator.clipboard.readText()
    if (!text.trim()) throw new Error('剪贴板中没有可粘贴的内容。')
    const imported = parseSetlistJson(text)
    setlist.value = imported.map(item => ({
      key: crypto.randomUUID(), song_id: item.song_id, version_label: item.version_label ?? '',
      is_encore: item.is_encore, is_medley: item.is_medley, confidence: item.confidence, notes: item.notes ?? '',
    }))
    success.value = `已导入 ${imported.length} 首歌曲，保存后生效。`
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '读取或解析歌单 JSON 失败。'
  }
}

function parseSetlistJson(text: string): SetlistJsonItem[] {
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('JSON 格式无效，请检查是否完整复制。') }
  if (!isRecord(value) || value.format_version !== 1 || !Array.isArray(value.items)) throw new Error('歌单 JSON 格式无效，需要 format_version: 1 和 items 数组。')
  const result: SetlistJsonItem[] = []
  value.items.forEach((raw, index) => {
    if (!isRecord(raw) || !Number.isInteger(raw.song_id) || typeof raw.is_encore !== 'boolean' || typeof raw.is_medley !== 'boolean' || typeof raw.confidence !== 'string') throw new Error(`第 ${index + 1} 首歌曲的字段格式无效。`)
    if (!CONFIDENCE_LEVELS.includes(raw.confidence as EventDTO['confidence'])) throw new Error(`第 ${index + 1} 首歌曲的确认级别无效。`)
    const song = songOptions.value.find(option => option.id === raw.song_id)
    if (!song) throw new Error(`找不到歌曲 ID ${raw.song_id}，请先维护歌曲库或重新加载歌单。`)
    if (typeof raw.title !== 'string' || (raw.version_label !== null && typeof raw.version_label !== 'string')) throw new Error(`第 ${index + 1} 首歌曲的文本字段无效。`)
    if (raw.notes !== null && typeof raw.notes !== 'string') throw new Error(`第 ${index + 1} 首歌曲的备注字段无效。`)
    result.push({ song_id: raw.song_id as number, title: song.title, version_label: raw.version_label as string | null, is_encore: raw.is_encore as boolean, is_medley: raw.is_medley as boolean, confidence: raw.confidence as EventDTO['confidence'], notes: raw.notes as string | null })
  })
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

async function loadTours(q?: string) { await loadOption('tours', () => concertAdminApi.listTours({ page_size: 50, q }), result => mergeOptions(tourOptions, result.items)) }
async function loadVenues(q?: string) { await loadOption('venues', () => concertAdminApi.listVenues({ page_size: 50, q }), result => mergeOptions(venueOptions, result.items)) }
async function loadSongs(q?: string) {
  await loadOption('songs', () => concertAdminApi.listSongs({ page_size: 50, q }), (result) => {
    visibleSongIds.value = new Set(result.items.map(song => song.id))
    mergeOptions(songOptions, result.items)
  })
}
function searchTours(value: string) { void loadTours(value?.trim() || undefined) }
function searchVenues(value: string) { void loadVenues(value?.trim() || undefined) }
function searchSongs(value: string) {
  pendingSongSearch.value = value?.trim() || undefined
  visibleSongIds.value = new Set()
  songSearchTimer.stop()
  songSearchTimer.start()
}
function handleSongMenuUpdate(open: boolean) {
  if (open) void loadSongs()
}

async function loadOption<K extends keyof typeof optionLoading, T>(key: K, operation: () => Promise<T>, apply: (result: T) => void) {
  const request = ++optionRequest[key]
  optionLoading[key] = true
  try { const result = await operation(); if (request === optionRequest[key]) apply(result) } catch { /* 表单仍可继续编辑 */ } finally { if (request === optionRequest[key]) optionLoading[key] = false }
}
function mergeOptions<T extends { id: number }>(target: Ref<T[]>, incoming: T[]) { const map = new Map(target.value.map(item => [item.id, item])); incoming.forEach(item => map.set(item.id, item)); target.value = [...map.values()] }
function isSongOption(value: unknown): value is Pick<SongDTO, 'id'> {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'number'
}
function snapshot() { return JSON.stringify({ form, setlist: setlist.value.map(({ key: _key, ...item }) => item) }) }
function markClean(version = resetVersion) { nextTick(() => { if (version !== resetVersion) return; baseline.value = snapshot(); emit('dirty-change', false) }) }
function markUnsavedCopy(version: number) { nextTick(() => { if (version !== resetVersion) return; baseline.value = '__unsaved_copy__'; emit('dirty-change', true) }) }
</script>

<style scoped>
.event-editor { min-height: 100%; display: flex; flex-direction: column; }
.editor-header { position: sticky; z-index: 3; top: 0; padding: 24px 26px 18px; display: flex; justify-content: space-between; align-items: flex-start; background: rgb(var(--v-theme-surface)); border-bottom: 1px solid var(--site-border); }
.editor-header h2 { margin: 4px 0 0; font-size: 1.5rem; }
.event-form { padding: 22px 26px; display: grid; gap: 22px; }
.form-section { display: grid; gap: 14px; padding-bottom: 22px; border-bottom: 1px solid var(--site-border); }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-heading h3 { margin: 3px 0 2px; font-size: 1.12rem; }
.section-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.time-preview { padding: 10px 12px; border-radius: 11px; display: flex; gap: 8px; color: rgb(var(--v-theme-success)); background: color-mix(in srgb, rgb(var(--v-theme-success)) 10%, transparent); font-size: .82rem; overflow-wrap: anywhere; }
.time-preview-error { color: rgb(var(--v-theme-error)); background: color-mix(in srgb, rgb(var(--v-theme-error)) 10%, transparent); }
.relation-loading, .relation-empty { min-height: 72px; padding: 20px; border: 1px dashed var(--site-border); border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--site-muted); }
.setlist-list { display: grid; gap: 10px; }
.setlist-row { padding: 12px; border: 1px solid var(--site-border); border-radius: 14px; display: grid; grid-template-columns: auto auto 1fr auto; gap: 10px; background: rgb(var(--v-theme-surface)); }
.setlist-drag-handle { width: 32px; height: 42px; border: 0; border-radius: 9px; display: grid; place-items: center; color: var(--site-muted); background: transparent; cursor: grab; }
.setlist-drag-handle:active { cursor: grabbing; }
.setlist-position { width: 28px; height: 28px; margin-top: 7px; border-radius: 9px; display: grid; place-items: center; font-size: .75rem; font-weight: 800; color: #183b38; background: rgb(57 197 187 / 22%); }
.setlist-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.setlist-flags { display: flex; gap: 12px; align-items: center; }
.setlist-actions { display: flex; flex-direction: column; }
.editor-actions { position: sticky; z-index: 3; bottom: 0; margin: 8px -26px -22px; padding: 16px 26px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--site-border); background: rgb(var(--v-theme-surface)); }
@media (max-width: 760px) { .editor-header, .event-form { padding-inline: 18px; } .form-grid, .setlist-fields { grid-template-columns: 1fr; } .section-heading { flex-direction: column; } .section-actions { justify-content: flex-start; } .setlist-row { grid-template-columns: auto auto 1fr; } .setlist-actions { grid-column: 3; flex-direction: row; justify-content: flex-end; } .editor-actions { margin-inline: -18px; padding-inline: 18px; } }
</style>
