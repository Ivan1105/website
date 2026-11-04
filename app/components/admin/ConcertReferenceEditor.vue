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
        <v-btn type="submit" color="primary" :loading="saving" prepend-icon="mdi-content-save-outline">保存</v-btn>
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
  type VenueDTO,
} from '@/api'
import { isApiError } from '@/api'
import {
  confidenceLabels, enumItems, songStatusLabels, sourceReliabilityLabels,
  sourceTypeLabels, timezoneSuggestions, toNullable, tourStatusLabels,
} from '@/utils/concert-admin'

type ReferenceResource = 'tours' | 'venues' | 'songs' | 'sources'
type ReferenceRecord = TourDTO | VenueDTO | SongDTO | SourceDTO

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
const emit = defineEmits<{ saved: [record: ReferenceRecord]; cancel: []; 'dirty-change': [dirty: boolean] }>()
const { concertAdminApi } = useConcertAdminApi()
const saving = ref(false)
const error = ref<string | null>(null)
const baseline = ref('')
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

watch(() => [props.resource, props.record] as const, reset, { immediate: true })
watch(form, () => emit('dirty-change', JSON.stringify(form) !== baseline.value), { deep: true })

function emptyForm(): ReferenceFormState {
  return {
    slug: '', name: '', name_original: '', aliases: [], organizer: '', start_date: '', end_date: '',
    status: 'unknown', confidence: 'confirmed', notes: '', city: '', prefecture: '', country_code: '',
    address: '', timezone: 'Asia/Tokyo', latitude: null, longitude: null, official_url: '', title: '',
    singer: [], producer: '', url: '', publisher: '',
    source_type: 'unknown', reliability: 'unknown', published_at: '', accessed_at: '', content_hash: '', archived_url: '',
  }
}

function reset() {
  const next = emptyForm()
  const record = props.record
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
    baseline.value = JSON.stringify(form)
    emit('dirty-change', false)
  })
  if (props.resource === 'songs') void loadProducerOptions()
}

async function save() {
  if (saving.value) return
  error.value = null
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
    baseline.value = JSON.stringify(form)
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
.editor-actions { position: sticky; bottom: 0; margin: 12px -26px -24px; padding: 16px 26px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--site-border); background: rgb(var(--v-theme-surface)); }
@media (max-width: 620px) { .editor-header, .editor-form { padding-inline: 18px; } .form-grid { grid-template-columns: 1fr; } .editor-actions { margin-inline: -18px; padding-inline: 18px; } }
</style>
