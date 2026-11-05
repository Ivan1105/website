<template>
  <div class="reference-editor">
    <header class="editor-header">
      <div><p class="eyebrow">{{ resourceEyebrow }}</p><h2>{{ record ? `编辑${resourceLabel}` : `新增${resourceLabel}` }}</h2></div>
      <v-btn icon="mdi-close" variant="text" aria-label="关闭编辑器" :disabled="saving" @click="$emit('cancel')" />
    </header>

    <v-alert v-if="error" type="error" variant="tonal" density="comfortable" closable @click:close="error = null">{{ error }}</v-alert>

    <v-form class="editor-form" @submit.prevent="save">
      <template v-if="resource === 'tours'">
        <v-text-field v-model.trim="form.name" label="巡演名称 *" :rules="requiredRules" />
        <v-text-field v-model.trim="form.name_original" label="原文名称" />
        <v-text-field v-model.trim="form.slug" label="Slug *" hint="仅小写字母、数字和连字符" persistent-hint :rules="slugRules" />
        <v-combobox v-model="form.aliases" label="别名" multiple chips closable-chips clearable />
        <v-text-field v-model.trim="form.organizer" label="主办方" />
        <div class="form-grid">
          <v-text-field v-model="form.start_date" label="开始日期" type="date" />
          <v-text-field v-model="form.end_date" label="结束日期" type="date" />
          <v-select v-model="form.status" label="状态" :items="tourStatusItems" />
          <v-select v-model="form.confidence" label="确认级别" :items="confidenceItems" />
        </div>
        <v-textarea v-model="form.notes" label="备注" rows="4" auto-grow />

        <section class="tour-sources-section">
          <div class="section-heading">
            <div><p class="eyebrow">SOURCES</p><h3>资料来源</h3><p class="muted">资料来源归属于整个巡演，可供该巡演的所有场次使用。</p></div>
            <div class="section-actions">
              <v-btn variant="text" color="secondary" size="small" prepend-icon="mdi-link-plus" :disabled="relationsLoading || !currentTour" @click="addTourSource">添加来源</v-btn>
              <v-btn variant="text" color="secondary" size="small" @click="$emit('switch-resource', 'sources')">维护来源库</v-btn>
            </div>
          </div>
          <v-alert v-if="!currentTour" type="info" variant="tonal" density="compact">请先保存巡演基础信息，再维护资料来源。</v-alert>
          <div v-else-if="relationsLoading" class="relation-state"><v-progress-circular indeterminate size="24" width="2" color="primary" /> 正在加载资料来源…</div>
          <div v-else-if="!tourSources.length" class="relation-state">尚未关联资料来源。</div>
          <div v-else class="source-list">
            <article v-for="(item, index) in tourSources" :key="item.key" class="source-row">
              <v-autocomplete
                v-model="item.source_id" label="资料来源 *" :items="sourceOptions" item-title="display_title" item-value="id"
                density="compact" clearable no-data-text="noData.sources" :loading="sourceOptionsLoading" @update:search="searchSources"
              />
              <v-select v-model="item.relation_type" label="关联类型" :items="sourceRelationItems" density="compact" />
              <v-checkbox v-model="item.is_primary" label="主要来源" density="compact" hide-details />
              <v-text-field v-model.trim="item.note" label="备注" density="compact" />
              <v-btn icon="mdi-delete-outline" variant="text" color="error" aria-label="删除来源关联" @click="tourSources.splice(index, 1)" />
            </article>
          </div>
        </section>
      </template>

      <template v-else-if="resource === 'venues'">
        <v-text-field v-model.trim="form.name" label="场地名称 *" :rules="requiredRules" />
        <v-text-field v-model.trim="form.name_original" label="原文名称" />
        <v-text-field v-model.trim="form.slug" label="Slug *" :rules="slugRules" />
        <div class="form-grid">
          <v-text-field v-model.trim="form.city" label="城市 *" :rules="requiredRules" />
          <v-text-field v-model.trim="form.prefecture" label="州、省或都道府县" />
          <v-text-field v-model.trim="form.country_code" label="国家代码" maxlength="2" hint="ISO 两位代码，如 JP" persistent-hint />
          <v-combobox v-model.trim="form.timezone" label="IANA 时区 *" :items="timezoneSuggestions" :rules="requiredRules" />
        </div>
        <v-text-field v-model.trim="form.address" label="详细地址" />
        <div class="form-grid">
          <v-text-field v-model.number="form.latitude" label="纬度" type="number" step="0.0000001" />
          <v-text-field v-model.number="form.longitude" label="经度" type="number" step="0.0000001" />
        </div>
        <v-text-field v-model.trim="form.official_url" label="官方网站" type="url" />
      </template>

      <template v-else-if="resource === 'songs'">
        <v-text-field v-model.trim="form.title" label="标准歌曲名称 *" :rules="requiredRules" />
        <v-text-field v-model.trim="form.slug" label="Slug *" :rules="slugRules" />
        <v-combobox v-model="form.aliases" label="别名" multiple chips closable-chips clearable />
        <div class="form-grid">
          <v-select v-model="form.singer" label="歌手" :items="songSingerItems" multiple chips closable-chips clearable />
          <v-combobox
            v-model.trim="form.producer" label="P主" :items="producerOptions" clearable no-filter
            no-data-text="noData.producers" :loading="producerLoading"
            @update:search="searchProducers"
          />
          <v-select v-model="form.status" label="状态" :items="songStatusItems" />
        </div>
        <v-textarea v-model="form.notes" label="备注" rows="4" auto-grow />
      </template>

      <template v-else>
        <v-text-field v-model.trim="form.url" label="来源 URL *" type="url" :rules="requiredRules" />
        <v-text-field v-model.trim="form.title" label="资料标题" />
        <v-text-field v-model.trim="form.publisher" label="发布方" />
        <div class="form-grid">
          <v-select v-model="form.source_type" label="来源类型" :items="sourceTypeItems" />
          <v-select v-model="form.reliability" label="可靠性" :items="sourceReliabilityItems" />
          <v-text-field v-model="form.published_at" label="发布时间" type="datetime-local" />
          <v-text-field v-model="form.accessed_at" label="访问时间" type="datetime-local" />
        </div>
        <v-text-field v-model.trim="form.archived_url" label="归档 URL" type="url" />
        <v-text-field v-model.trim="form.content_hash" label="内容 SHA-256" maxlength="64" counter="64" />
      </template>

      <footer class="editor-actions">
        <v-btn variant="text" :disabled="saving" @click="$emit('cancel')">取消</v-btn>
        <v-btn type="submit" color="primary" :loading="saving" :disabled="relationsLoading || relationsLoadFailed" prepend-icon="mdi-content-save-outline">{{ resource === 'tours' && !currentTour ? '保存并继续编辑' : '保存' }}</v-btn>
      </footer>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import {
  SONG_SINGERS,
  useConcertAdminApi,
  type SongSinger,
  type SongDTO,
  type SourceDTO,
  type TourDTO,
  type TourSourceInput,
  type VenueDTO,
} from '@/api'
import { isApiError } from '@/api'
import {
  confidenceLabels, enumItems, songStatusLabels, sourceRelationLabels, sourceReliabilityLabels,
  sourceTypeLabels, timezoneSuggestions, toNullable, tourStatusLabels,
} from '@/utils/concert-admin'

type ReferenceResource = 'tours' | 'venues' | 'songs' | 'sources'
type ReferenceRecord = TourDTO | VenueDTO | SongDTO | SourceDTO
interface EditableTourSource extends Omit<TourSourceInput, 'source_id'> { key: string; source_id: number | null; is_primary: boolean; note: string }
type SourceOption = SourceDTO & { display_title: string }

interface ReferenceFormState {
  slug: string; name: string; name_original: string; aliases: string[]; organizer: string
  start_date: string; end_date: string; status: string; confidence: string; notes: string
  city: string; prefecture: string; country_code: string; address: string; timezone: string
  latitude: number | null; longitude: number | null; official_url: string
  title: string; singer: SongSinger[]; producer: string
  url: string; publisher: string; source_type: string; reliability: string; published_at: string; accessed_at: string
  content_hash: string; archived_url: string
}

const props = defineProps<{ resource: ReferenceResource; record: ReferenceRecord | null }>()
const emit = defineEmits<{ saved: [record: ReferenceRecord]; cancel: []; 'dirty-change': [dirty: boolean]; 'switch-resource': [resource: 'sources'] }>()
const { concertAdminApi } = useConcertAdminApi()
const saving = ref(false)
const error = ref<string | null>(null)
const baseline = ref('')
const currentTour = ref<TourDTO | null>(null)
const tourSources = ref<EditableTourSource[]>([])
const sourceOptions = ref<SourceOption[]>([])
const relationsLoading = ref(false)
const relationsLoadFailed = ref(false)
const sourceOptionsLoading = ref(false)
let resetVersion = 0
let sourceRequest = 0
const producerOptions = ref<string[]>([])
const producerLoading = ref(false)
let producerRequest = 0
const form = reactive<ReferenceFormState>(emptyForm())

const labels: Record<ReferenceResource, string> = { tours: '巡演', venues: '场地', songs: '歌曲', sources: '资料来源' }
const resourceLabel = computed(() => labels[props.resource])
const resourceEyebrow = computed(() => props.resource.toUpperCase())
const requiredRules = [(value: string) => !!value?.trim() || '此项为必填']
const slugRules = [
  ...requiredRules,
  (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || '只能包含小写字母、数字和连字符',
]
const tourStatusItems = enumItems(tourStatusLabels)
const confidenceItems = enumItems(confidenceLabels)
const songStatusItems = enumItems(songStatusLabels)
const songSingerItems = [...SONG_SINGERS]
const sourceTypeItems = enumItems(sourceTypeLabels)
const sourceReliabilityItems = enumItems(sourceReliabilityLabels)
const sourceRelationItems = enumItems(sourceRelationLabels)

watch(() => [props.resource, props.record] as const, reset, { immediate: true })
watch([form, tourSources], () => emit('dirty-change', snapshot() !== baseline.value), { deep: true })

function emptyForm(): ReferenceFormState {
  return {
    slug: '', name: '', name_original: '', aliases: [], organizer: '', start_date: '', end_date: '',
    status: 'unknown', confidence: 'confirmed', notes: '', city: '', prefecture: '', country_code: '',
    address: '', timezone: 'Asia/Tokyo', latitude: null, longitude: null, official_url: '', title: '',
    singer: [], producer: '', url: '', publisher: '',
    source_type: 'unknown', reliability: 'unknown', published_at: '', accessed_at: '', content_hash: '', archived_url: '',
  }
}

async function reset() {
  const version = ++resetVersion
  const next = emptyForm()
  const record = props.record
  currentTour.value = props.resource === 'tours' && record && 'name' in record ? record as TourDTO : null
  tourSources.value = []
  relationsLoading.value = false
  relationsLoadFailed.value = false
  if (record) {
    Object.assign(next, record)
    if ('aliases' in record) next.aliases = record.aliases ? [...record.aliases] : []
    if ('singer' in record) next.singer = record.singer ? record.singer.split('、').filter(isSongSinger) : []
    if ('published_at' in record) {
      next.published_at = toDateTimeLocal(record.published_at)
      next.accessed_at = toDateTimeLocal(record.accessed_at)
    }
  }
  Object.assign(form, next)
  error.value = null
  nextTick(() => {
    baseline.value = snapshot()
    emit('dirty-change', false)
  })
  if (props.resource === 'songs') void loadProducerOptions()
  if (props.resource === 'tours') {
    await loadSourceOptions()
    if (currentTour.value) await loadTourSources(currentTour.value.id, version)
    if (version === resetVersion) markClean()
  }
}

async function save() {
  if (saving.value) return
  error.value = null
  if (props.resource === 'tours' && tourSources.value.some(item => item.source_id === null)) { error.value = '请选择每条关联的资料来源。'; return }
  if (props.resource === 'tours' && hasDuplicatePrimarySources()) { error.value = '同一关联类型最多只能有一个主要来源。'; return }
  saving.value = true
  try {
    let saved: ReferenceRecord
    if (props.resource === 'tours') {
      const input = {
        slug: form.slug.trim(), name: form.name.trim(), name_original: toNullable(form.name_original),
        aliases: normalizedAliases(), organizer: toNullable(form.organizer), start_date: form.start_date || null,
        end_date: form.end_date || null, status: form.status as TourDTO['status'],
        confidence: form.confidence as TourDTO['confidence'], notes: toNullable(form.notes),
      }
      saved = props.record ? await concertAdminApi.updateTour(props.record.id, input) : await concertAdminApi.createTour(input)
    } else if (props.resource === 'venues') {
      const input = {
        slug: form.slug.trim(), name: form.name.trim(), name_original: toNullable(form.name_original),
        city: form.city.trim(), prefecture: toNullable(form.prefecture), country_code: toNullable(form.country_code)?.toUpperCase() ?? null,
        address: toNullable(form.address), timezone: form.timezone.trim(), latitude: numberOrNull(form.latitude),
        longitude: numberOrNull(form.longitude), official_url: toNullable(form.official_url),
      }
      saved = props.record ? await concertAdminApi.updateVenue(props.record.id, input) : await concertAdminApi.createVenue(input)
    } else if (props.resource === 'songs') {
      const input = {
        slug: form.slug.trim(), title: form.title.trim(), aliases: normalizedAliases(),
        singer: form.singer.length ? form.singer.join('、') : null,
        producer: toNullable(form.producer), status: form.status as SongDTO['status'],
        notes: toNullable(form.notes),
      }
      saved = props.record ? await concertAdminApi.updateSong(props.record.id, input) : await concertAdminApi.createSong(input)
    } else {
      const input = {
        url: form.url.trim(), title: toNullable(form.title), publisher: toNullable(form.publisher),
        source_type: form.source_type as SourceDTO['source_type'], reliability: form.reliability as SourceDTO['reliability'],
        published_at: localInputToIso(form.published_at), accessed_at: localInputToIso(form.accessed_at),
        content_hash: toNullable(form.content_hash)?.toLowerCase() ?? null, archived_url: toNullable(form.archived_url),
      }
      saved = props.record ? await concertAdminApi.updateSource(props.record.id, input) : await concertAdminApi.createSource(input)
    }
    if (props.resource === 'tours') {
      const tour = saved as TourDTO
      currentTour.value = tour
      if (props.record) {
        const savedSources = await concertAdminApi.replaceTourSources(tour.id, tourSources.value.map(toTourSourceInput))
        tourSources.value = savedSources.map(item => ({
          key: crypto.randomUUID(), source_id: item.source_id, relation_type: item.relation_type,
          is_primary: item.is_primary, note: item.note ?? '',
        }))
      }
    }
    baseline.value = snapshot()
    emit('dirty-change', false)
    emit('saved', saved)
  } catch (caught) {
    error.value = isApiError(caught) ? caught.message : caught instanceof Error ? caught.message : '保存失败，请稍后重试。'
  } finally {
    saving.value = false
  }
}

function normalizedAliases(): string[] | null {
  const aliases = [...new Set(form.aliases.map(item => item.trim()).filter(Boolean))]
  return aliases.length ? aliases : null
}
function addTourSource() { tourSources.value.push({ key: crypto.randomUUID(), source_id: null, relation_type: 'tour_info', is_primary: false, note: '' }) }
function toTourSourceInput(item: EditableTourSource): TourSourceInput { return { source_id: item.source_id!, relation_type: item.relation_type, is_primary: item.is_primary, note: toNullable(item.note) } }
function hasDuplicatePrimarySources() { const types = tourSources.value.filter(item => item.is_primary).map(item => item.relation_type); return new Set(types).size !== types.length }
function snapshot() { return JSON.stringify({ form, tourSources: tourSources.value.map(({ key: _key, ...item }) => item) }) }
function markClean() { nextTick(() => { baseline.value = snapshot(); emit('dirty-change', false) }) }
async function loadTourSources(tourId: number, version: number) {
  relationsLoading.value = true
  try {
    const items = await concertAdminApi.getTourSources(tourId)
    if (version !== resetVersion) return
    tourSources.value = items.map(item => ({ key: crypto.randomUUID(), source_id: item.source_id, relation_type: item.relation_type, is_primary: item.is_primary, note: item.note ?? '' }))
    mergeSourceOptions(items.flatMap(item => item.source ? [item.source] : []))
  } catch (caught) {
    if (version !== resetVersion) return
    relationsLoadFailed.value = true
    error.value = isApiError(caught) ? caught.message : '暂时无法加载巡演资料来源，请关闭后重试。'
  } finally {
    if (version === resetVersion) relationsLoading.value = false
  }
}
async function loadSourceOptions(q?: string) {
  const request = ++sourceRequest
  sourceOptionsLoading.value = true
  try {
    const result = await concertAdminApi.listSources({ page_size: 50, q })
    if (request === sourceRequest) mergeSourceOptions(result.items)
  } catch { /* 已选来源仍可继续编辑 */ }
  finally { if (request === sourceRequest) sourceOptionsLoading.value = false }
}
function searchSources(value: string) { void loadSourceOptions(value?.trim() || undefined) }
function mergeSourceOptions(items: SourceDTO[]) {
  const options = new Map(sourceOptions.value.map(item => [item.id, item]))
  items.forEach(item => options.set(item.id, { ...item, display_title: item.title || item.publisher || item.url }))
  sourceOptions.value = [...options.values()]
}
function isSongSinger(value: string): value is SongSinger { return SONG_SINGERS.includes(value as SongSinger) }
function searchProducers(value: string) { void loadProducerOptions(value?.trim() || undefined) }
async function loadProducerOptions(q?: string) {
  const request = ++producerRequest
  producerLoading.value = true
  try {
    const items = await concertAdminApi.listSongProducers(q)
    if (request === producerRequest) producerOptions.value = items
  } catch { /* 仍允许直接输入新名称 */ }
  finally { if (request === producerRequest) producerLoading.value = false }
}
function numberOrNull(value: number | null): number | null { return value === null || !Number.isFinite(Number(value)) ? null : Number(value) }
function toDateTimeLocal(value: string | null): string { return value ? new Date(value).toISOString().slice(0, 16) : '' }
function localInputToIso(value: string): string | null { return value ? new Date(value).toISOString() : null }
</script>

<style scoped>
.reference-editor { min-height: 100%; display: flex; flex-direction: column; }
.editor-header { position: sticky; z-index: 2; top: 0; padding: 24px 26px 18px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; background: rgb(var(--v-theme-surface)); border-bottom: 1px solid var(--site-border); }
.editor-header h2 { margin: 4px 0 0; font-size: 1.5rem; }
.editor-form { padding: 24px 26px; display: grid; gap: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.tour-sources-section { display: grid; gap: 14px; margin-top: 8px; padding-top: 22px; border-top: 1px solid var(--site-border); }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-heading h3 { margin: 3px 0 2px; font-size: 1.12rem; }
.section-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.relation-state { min-height: 72px; padding: 20px; border: 1px dashed var(--site-border); border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--site-muted); }
.source-list { display: grid; gap: 10px; }
.source-row { padding: 12px; border: 1px solid var(--site-border); border-radius: 14px; display: grid; grid-template-columns: minmax(180px, 1.6fr) minmax(130px, 1fr) auto minmax(140px, 1fr) auto; gap: 8px; align-items: start; }
.editor-actions { position: sticky; bottom: 0; margin: 12px -26px -24px; padding: 16px 26px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--site-border); background: rgb(var(--v-theme-surface)); }
@media (max-width: 620px) { .editor-header, .editor-form { padding-inline: 18px; } .form-grid, .source-row { grid-template-columns: 1fr; } .section-heading { flex-direction: column; } .section-actions { justify-content: flex-start; } .editor-actions { margin-inline: -18px; padding-inline: 18px; } }
</style>
