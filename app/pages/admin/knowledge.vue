<template>
  <div class="knowledge-page site-container">
    <section class="knowledge-shell" aria-labelledby="knowledge-title">
      <header class="knowledge-heading">
        <div>
          <p class="eyebrow">KNOWLEDGE / 资料库</p>
          <h1 id="knowledge-title">演唱会资料维护<span>。</span></h1>
          <p class="muted">维护巡演、演出场次、歌单、场地、歌曲和资料来源。</p>
        </div>
        <div class="knowledge-heading-actions">
          <v-btn to="/admin" variant="text" color="secondary" prepend-icon="mdi-arrow-left">返回管理中心</v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">新增{{ currentConfig.singular }}</v-btn>
        </div>
      </header>

      <v-card class="knowledge-card surface-card">
        <v-tabs :model-value="section" color="secondary" show-arrows class="knowledge-tabs" @update:model-value="value => requestSection(String(value))">
          <v-tab v-for="item in sections" :key="item.value" :value="item.value"><v-icon :icon="item.icon" start />{{ item.label }}</v-tab>
        </v-tabs>

        <v-alert
          v-if="section === 'events' && selectedTourId" class="tour-context" color="secondary"
          icon="mdi-map-marker-path" variant="tonal" density="compact"
        >
          正在查看「{{ selectedTourLabel }}」的场次
          <template #append><v-btn variant="text" size="small" @click="clearTourFilter">查看全部场次</v-btn></template>
        </v-alert>

        <div class="knowledge-toolbar">
          <v-text-field
            v-model.trim="search" label="搜索" prepend-inner-icon="mdi-magnify" hide-details clearable
            :placeholder="currentConfig.searchPlaceholder" @keyup.enter="applyFilters" @click:clear="clearSearch"
          />
          <v-select
            v-if="filterItems.length" v-model="filter" class="knowledge-filter" :items="filterItems" label="筛选" hide-details clearable
            @update:model-value="applyFilters"
          />
          <v-btn variant="outlined" color="secondary" prepend-icon="mdi-filter-check-outline" :loading="loading" @click="applyFilters">应用</v-btn>
          <v-btn icon="mdi-refresh" variant="text" :loading="loading" aria-label="刷新列表" @click="loadItems(pagination.page)" />
        </div>

        <v-progress-linear v-if="loading && items.length" indeterminate color="primary" height="3" />
        <v-alert v-if="error" type="error" variant="tonal" density="comfortable" class="knowledge-alert">
          {{ error }}
          <template #append><v-btn variant="text" size="small" @click="loadItems(pagination.page)">重试</v-btn></template>
        </v-alert>

        <div v-if="loading && !items.length" class="knowledge-state" aria-live="polite">
          <v-progress-circular indeterminate color="primary" size="34" width="3" />
          <div><h2>正在加载{{ currentConfig.label }}</h2><p class="muted">请稍候。</p></div>
        </div>
        <div v-else-if="!items.length && !error" class="knowledge-state">
          <span class="knowledge-state-icon"><v-icon :icon="currentConfig.icon" size="30" /></span>
          <div><h2>暂无{{ currentConfig.label }}</h2><p class="muted">可以从右上角新增第一条记录。</p></div>
        </div>

        <div v-else class="knowledge-table-wrap" :aria-busy="loading">
          <v-table class="knowledge-table" hover>
            <thead><tr><th v-if="section === 'songs'" class="vocalist-column"><span class="sr-only">歌手颜色</span></th><th>{{ currentConfig.primaryColumn }}</th><th>{{ currentConfig.secondaryColumn }}</th><th v-if="section === 'events'">葱含量</th><th>状态</th><th class="actions-column">操作</th></tr></thead>
            <tbody>
              <tr v-for="item in items" :key="`${section}-${item.id}`">
                <td v-if="section === 'songs'" class="vocalist-column">
                  <span class="vocalist-marker" role="img" :aria-label="vocalistColorLabel(item)">
                    <span
                      v-for="color in vocalistColors(item)" :key="color"
                      class="vocalist-marker-segment" :style="{ backgroundColor: `var(--vocalist-${color})` }"
                    />
                  </span>
                </td>
                <td>
                  <div class="primary-cell">
                    <a
                      v-if="isTour(item)" :href="tourEventsHref(item)" class="tour-name-link"
                      @click.prevent="openTourEvents(item)"
                    >
                      {{ primaryText(item) }}
                    </a>
                    <button v-else-if="isEvent(item)" type="button" class="event-name-link" @click="openSetlist(item)">{{ primaryText(item) }}</button>
                    <strong v-else>{{ primaryText(item) }}</strong>
                    <span>{{ itemSlug(item) }}</span>
                  </div>
                </td>
                <td>{{ secondaryText(item) }}</td>
                <td v-if="section === 'events'">{{ isEvent(item) && item.miku_percent !== null ? `${item.miku_percent}%` : '—' }}</td>
                <td><v-chip size="small" variant="tonal" :color="statusColor(item)">{{ statusText(item) }}</v-chip></td>
                <td class="actions-column">
                  <v-btn
                    v-if="section === 'events'" icon="mdi-content-copy" variant="text" size="small"
                    :aria-label="`复制${primaryText(item)}`" @click="openCopy(item)"
                  />
                  <v-btn icon="mdi-pencil-outline" variant="text" size="small" aria-label="编辑" @click="openEdit(item)" />
                  <v-btn icon="mdi-delete-outline" variant="text" color="error" size="small" aria-label="删除" @click="openDelete(item)" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <footer v-if="pagination.total > PAGE_SIZE" class="knowledge-pagination">
          <span>共 {{ pagination.total }} 条 · 第 {{ pagination.page + 1 }} / {{ totalPages }} 页</span>
          <v-pagination :model-value="pagination.page + 1" :length="totalPages" :disabled="loading" :total-visible="5" rounded="circle" @update:model-value="page => loadItems(page - 1)" />
        </footer>
      </v-card>
    </section>

    <v-navigation-drawer
      :model-value="editorOpen" location="right" temporary :width="mobile ? '100%' : 800" class="knowledge-drawer"
      @update:model-value="handleDrawerModel"
    >
      <ConcertEventEditor
        v-if="section === 'events'" :record="editingRecord as EventDTO | null" :copy-source="copyingRecord"
        @saved="handleEventSaved" @cancel="requestCloseEditor" @dirty-change="dirty = $event" @switch-resource="requestSection"
      />
      <ConcertReferenceEditor
        v-else :key="referenceEditorKey" :resource="section" :record="editingRecord as ReferenceRecord | null"
        @saved="handleReferenceSaved" @cancel="requestCloseEditor" @dirty-change="dirty = $event" @switch-resource="requestSection"
      />
    </v-navigation-drawer>

    <v-navigation-drawer v-model="setlistDrawerOpen" location="right" temporary :width="mobile ? '100%' : 560" class="setlist-drawer">
      <header class="setlist-drawer-header"><div><p class="eyebrow">SETLIST / 歌单</p><h2>{{ setlistEvent ? primaryText(setlistEvent) : '场次歌单' }}</h2><p v-if="setlistEvent" class="muted">{{ secondaryText(setlistEvent) }}</p></div><v-btn icon="mdi-close" variant="text" aria-label="关闭歌单" @click="closeSetlist" /></header>
      <v-alert v-if="setlistError" type="error" variant="tonal" density="comfortable" class="setlist-alert">{{ setlistError }}<template #append><v-btn variant="text" size="small" @click="setlistEvent && loadSetlist(setlistEvent)">重试</v-btn></template></v-alert>
      <div v-if="setlistLoading" class="setlist-state" aria-live="polite"><v-progress-circular indeterminate color="primary" size="30" width="3" /><span>正在加载歌单…</span></div>
      <div v-else-if="!setlistError && !setlistItems.length" class="setlist-state"><v-icon icon="mdi-music-note-off-outline" size="34" /><span>该场次尚未维护歌单。</span></div>
      <v-list v-else lines="two" class="setlist-list" aria-label="场次歌单"><v-list-item v-for="item in setlistItems" :key="item.id" class="setlist-item"><template #prepend><span class="setlist-vocalist-marker" role="img" :aria-label="`歌手颜色：${item.song?.singer || '其他或未设置'}`"><span v-for="color in setlistVocalistColors(item)" :key="color" class="setlist-vocalist-segment" :style="{ backgroundColor: `var(--vocalist-${color})` }" /></span><span class="setlist-position-wrap"><span class="setlist-position">{{ item.position }}</span><span v-if="item.is_tape_song" class="setlist-tape-mark" aria-label="彩带曲">🎊</span></span></template><v-list-item-title>{{ item.song?.title ?? `歌曲 #${item.song_id ?? '未知'}` }}<span v-if="item.version_label" class="setlist-version">（{{ item.version_label }}）</span></v-list-item-title><v-list-item-subtitle><span class="setlist-meta"><span>{{ [item.song?.singer || '歌手未设置', item.song?.producer].filter(Boolean).join(' / ') }}</span></span><span v-if="item.is_encore || item.is_medley || item.is_tape_song || item.notes" class="setlist-details">{{ [item.is_encore ? '返场' : '', item.is_medley ? 'Medley' : '', item.is_tape_song ? '彩带曲' : '', item.notes ?? ''].filter(Boolean).join(' · ') }}</span></v-list-item-subtitle></v-list-item></v-list>
    </v-navigation-drawer>

    <v-dialog v-model="deleteOpen" max-width="520" :persistent="deleting">
      <v-card title="确认删除">
        <v-card-text>
          <p>确定删除 <strong>{{ deletingItem ? primaryText(deletingItem) : '' }}</strong> 吗？</p>
          <p class="muted">若该记录仍被其他资料引用，后端将拒绝删除。</p>
          <v-alert v-if="deleteError" type="error" variant="tonal" density="compact" class="mt-4">{{ deleteError }}</v-alert>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" :disabled="deleting" @click="closeDelete">取消</v-btn><v-btn color="error" :loading="deleting" @click="confirmDelete">确认删除</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="discardOpen" max-width="500" persistent>
      <v-card title="放弃未保存的修改？">
        <v-card-text><p>当前编辑内容尚未保存。继续操作将丢失这些修改。</p></v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="cancelDiscard">继续编辑</v-btn><v-btn color="error" @click="confirmDiscard">放弃修改</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="successOpen" color="success" location="bottom" :timeout="2600">{{ successMessage }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { useDisplay } from 'vuetify'
import ConcertEventEditor from '@/components/admin/ConcertEventEditor.vue'
import ConcertReferenceEditor from '@/components/admin/ConcertReferenceEditor.vue'
import {
  EVENT_STATUSES, EVENT_TYPES, SONG_STATUSES, SOURCE_RELIABILITIES, SOURCE_TYPES, TOUR_STATUSES,
  isApiError, useConcertAdminApi,
  type BaseConcertDTO, type ConcertPaginationDTO, type ConcertResource, type EventDTO,
  type SetlistItemDTO, type SongDTO, type SourceDTO, type TourDTO, type VenueDTO,
} from '@/api'
import { useAppStore } from '@/stores/app'
import {
  confidenceLabels, enumItems, eventStatusLabels, eventTypeLabels, formatDate,
  songStatusLabels, sourceReliabilityLabels, sourceTypeLabels, tourStatusLabels,
} from '@/utils/concert-admin'

type KnowledgeRecord = EventDTO | TourDTO | VenueDTO | SongDTO | SourceDTO
type ReferenceRecord = TourDTO | VenueDTO | SongDTO | SourceDTO
type VocalistColor = 'miku' | 'rin' | 'len' | 'luka' | 'meiko' | 'kaito' | 'teto' | 'other'
interface SectionConfig { value: ConcertResource; label: string; singular: string; icon: string; primaryColumn: string; secondaryColumn: string; searchPlaceholder: string }

const PAGE_SIZE = 20
const vocalistColorMap: Readonly<Record<string, VocalistColor>> = {
  '初音ミク': 'miku',
  '鏡音リン': 'rin',
  '鏡音レン': 'len',
  '巡音ルカ': 'luka',
  MEIKO: 'meiko',
  KAITO: 'kaito',
  '重音テト': 'teto',
}
const sections: SectionConfig[] = [
  { value: 'tours', label: '巡演', singular: '巡演', icon: 'mdi-map-marker-path', primaryColumn: '巡演', secondaryColumn: '日期 / 主办方 / 场次', searchPlaceholder: '搜索巡演名称、主办方或 slug' },
  { value: 'events', label: '演出场次', singular: '场次', icon: 'mdi-calendar-star-outline', primaryColumn: '场次', secondaryColumn: '日期 / 城市', searchPlaceholder: '搜索场次名称、城市或 slug' },
  { value: 'venues', label: '场地', singular: '场地', icon: 'mdi-stadium-outline', primaryColumn: '场地', secondaryColumn: '位置 / 时区', searchPlaceholder: '搜索场地、城市或 slug' },
  { value: 'songs', label: '歌曲', singular: '歌曲', icon: 'mdi-music-note-outline', primaryColumn: '歌曲', secondaryColumn: '创作者', searchPlaceholder: '搜索歌名、创作者或 slug' },
  { value: 'sources', label: '资料来源', singular: '来源', icon: 'mdi-link-variant', primaryColumn: '来源', secondaryColumn: '发布方 / URL', searchPlaceholder: '搜索标题、发布方或 URL' },
]

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const { mobile } = useDisplay()
const { concertAdminApi } = useConcertAdminApi()
const section = ref<ConcertResource>(parseSection(route.query.section))
const selectedTourId = ref<number | null>(section.value === 'events' ? parseTourId(route.query.tour_id) : null)
const selectedTourName = ref<string | null>(null)
const items = ref<KnowledgeRecord[]>([])
const pagination = ref<ConcertPaginationDTO>({ page: 0, page_size: PAGE_SIZE, total: 0, has_more: false })
const search = ref('')
const filter = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const editorOpen = ref(false)
const referenceEditorVersion = ref(0)
const editingRecord = ref<KnowledgeRecord | null>(null)
const copyingRecord = ref<EventDTO | null>(null)
const dirty = ref(false)
const deleteOpen = ref(false)
const deletingItem = ref<KnowledgeRecord | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)
const discardOpen = ref(false)
const pendingAction = ref<(() => void) | null>(null)
const pendingRoute = ref<string | null>(null)
const successOpen = ref(false)
const successMessage = ref('保存成功')
const setlistDrawerOpen = ref(false)
const setlistEvent = ref<EventDTO | null>(null)
const setlistItems = ref<SetlistItemDTO[]>([])
const setlistLoading = ref(false)
const setlistError = ref<string | null>(null)
const referenceEditorKey = computed(() => `${section.value}-${editingRecord.value?.id ?? 'new'}-${referenceEditorVersion.value}`)

const currentConfig = computed(() => sections.find(item => item.value === section.value) ?? sections[0]!)
const totalPages = computed(() => Math.max(1, Math.ceil(pagination.value.total / pagination.value.page_size)))
const selectedTourLabel = computed(() => selectedTourName.value ?? `巡演 #${selectedTourId.value}`)
const filterItems = computed(() => {
  if (section.value === 'events') return enumItems(eventStatusLabels)
  if (section.value === 'tours') return enumItems(tourStatusLabels)
  if (section.value === 'songs') return enumItems(songStatusLabels)
  if (section.value === 'sources') return enumItems(sourceTypeLabels)
  return []
})

useSeoMeta({ title: '资料库维护 · Ivan1105' })

let pageOverflow = { html: '', body: '' }
let pageScrollLocked = false
watch([editorOpen, setlistDrawerOpen], ([editorOpenValue, setlistOpen]) => {
  if (!import.meta.client) return
  const shouldLock = editorOpenValue || setlistOpen
  if (shouldLock && !pageScrollLocked) {
    pageOverflow = { html: document.documentElement.style.overflow, body: document.body.style.overflow }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    pageScrollLocked = true
  } else if (!shouldLock && pageScrollLocked) {
    document.documentElement.style.overflow = pageOverflow.html
    document.body.style.overflow = pageOverflow.body
    pageScrollLocked = false
  }
})
onBeforeUnmount(() => {
  if (!import.meta.client) return
  if (pageScrollLocked) {
    document.documentElement.style.overflow = pageOverflow.html
    document.body.style.overflow = pageOverflow.body
  }
})

watch(() => [route.query.section, route.query.tour_id] as const, ([sectionQuery, tourIdQuery]) => {
  const nextSection = parseSection(sectionQuery)
  const nextTourId = nextSection === 'events' ? parseTourId(tourIdQuery) : null
  if (nextSection === section.value && nextTourId === selectedTourId.value) return
  section.value = nextSection
  selectedTourId.value = nextTourId
  selectedTourName.value = null
  search.value = ''
  filter.value = null
  items.value = []
  void loadSelectedTour()
  void loadItems(0)
})
watch(dirty, value => { if (!value) pendingRoute.value = null })

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void loadSelectedTour()
  void loadItems(0)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave((to) => {
  if (!dirty.value) return true
  pendingRoute.value = to.fullPath
  discardOpen.value = true
  return false
})

async function loadItems(page: number) {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    const query: Record<string, string | number | undefined> = { page, page_size: PAGE_SIZE, q: search.value || undefined }
    if (section.value === 'events' && selectedTourId.value) query.tour_id = selectedTourId.value
    if (filter.value) {
      if (section.value === 'sources') query.source_type = filter.value
      else query.status = filter.value
    }
    const result = section.value === 'events' ? await concertAdminApi.listEvents(query)
      : section.value === 'tours' ? await concertAdminApi.listTours(query)
        : section.value === 'venues' ? await concertAdminApi.listVenues(query)
          : section.value === 'songs' ? await concertAdminApi.listSongs(query)
            : await concertAdminApi.listSources(query)
    items.value = result.items
    pagination.value = result.pagination
  } catch (caught) {
    handleApiError(caught, '暂时无法加载资料，请稍后重试。')
  } finally {
    loading.value = false
  }
}

function applyFilters() { void loadItems(0) }
function clearSearch() { search.value = ''; void loadItems(0) }
function openCreate() { referenceEditorVersion.value += 1; editingRecord.value = null; copyingRecord.value = null; dirty.value = false; editorOpen.value = true }
function openEdit(item: KnowledgeRecord) { editingRecord.value = item; copyingRecord.value = null; dirty.value = false; editorOpen.value = true }
function openSetlist(item: EventDTO) { runGuarded(() => { setlistEvent.value = item; setlistItems.value = []; setlistError.value = null; setlistDrawerOpen.value = true; void loadSetlist(item) }) }
async function loadSetlist(event: EventDTO) {
  setlistLoading.value = true
  try {
    const result = await concertAdminApi.getSetlist(event.id)
    if (setlistEvent.value?.id === event.id) setlistItems.value = result
  } catch (caught) {
    if (setlistEvent.value?.id === event.id) setlistError.value = isApiError(caught) ? caught.message : '暂时无法加载歌单，请稍后重试。'
  } finally {
    if (setlistEvent.value?.id === event.id) setlistLoading.value = false
  }
}
function closeSetlist() { setlistDrawerOpen.value = false; setlistEvent.value = null; setlistItems.value = []; setlistError.value = null }
function setlistVocalistColors(item: SetlistItemDTO): VocalistColor[] {
  if (!item.song?.singer?.trim()) return ['other']
  return [...new Set(item.song.singer.split(/[、,，/]+/).map(singer => vocalistColorMap[singer.trim()] ?? 'other'))]
}
function tourEventsHref(tour: TourDTO): string { return `/admin/knowledge?section=events&tour_id=${tour.id}` }
function openTourEvents(tour: TourDTO) {
  runGuarded(() => {
    editorOpen.value = false
    editingRecord.value = null
    copyingRecord.value = null
    dirty.value = false
    void router.push({ query: { ...route.query, section: 'events', tour_id: tour.id } })
  })
}
function openCopy(item: KnowledgeRecord) {
  if (!('official_name' in item)) return
  editingRecord.value = null
  copyingRecord.value = item
  dirty.value = false
  editorOpen.value = true
}
function handleDrawerModel(open: boolean) { if (!open) requestCloseEditor() }
function requestCloseEditor() { runGuarded(() => { editorOpen.value = false; editingRecord.value = null; copyingRecord.value = null; dirty.value = false }) }

function requestSection(value: string) {
  const next = parseSection(value)
  if (next === section.value && selectedTourId.value === null) return
  runGuarded(() => {
    editorOpen.value = false
    editingRecord.value = null
    copyingRecord.value = null
    dirty.value = false
    void router.push({ query: { ...route.query, section: next, tour_id: undefined } })
  })
}

function clearTourFilter() {
  void router.push({ query: { ...route.query, section: 'events', tour_id: undefined } })
}

async function loadSelectedTour() {
  const tourId = selectedTourId.value
  if (!tourId) { selectedTourName.value = null; return }
  try {
    const tour = await concertAdminApi.getTour(tourId)
    if (selectedTourId.value === tourId) selectedTourName.value = tour.name
  } catch {
    if (selectedTourId.value === tourId) selectedTourName.value = null
  }
}

function runGuarded(action: () => void) {
  if (!dirty.value) { action(); return }
  pendingAction.value = action
  discardOpen.value = true
}
function cancelDiscard() { discardOpen.value = false; pendingAction.value = null; pendingRoute.value = null }
function confirmDiscard() {
  discardOpen.value = false
  dirty.value = false
  const action = pendingAction.value
  const target = pendingRoute.value
  pendingAction.value = null
  pendingRoute.value = null
  if (action) action()
  else if (target) void navigateTo(target)
}

function handleReferenceSaved(record: ReferenceRecord) {
  successMessage.value = `${currentConfig.value.singular}已保存`
  successOpen.value = true
  dirty.value = false
  if (section.value === 'tours') editingRecord.value = record
  else if (section.value !== 'songs') {
    editorOpen.value = false
    editingRecord.value = null
  }
  copyingRecord.value = null
  void loadItems(pagination.value.page)
}
function handleEventSaved(record: EventDTO) {
  const copied = copyingRecord.value !== null
  copyingRecord.value = null
  editingRecord.value = record
  dirty.value = false
  successMessage.value = copied ? '场次副本已创建' : '演出资料已保存'
  successOpen.value = true
  void loadItems(pagination.value.page)
}

function openDelete(item: KnowledgeRecord) { deletingItem.value = item; deleteError.value = null; deleteOpen.value = true }
function closeDelete() { if (deleting.value) return; deleteOpen.value = false; deletingItem.value = null; deleteError.value = null }
async function confirmDelete() {
  const item = deletingItem.value
  if (!item || deleting.value) return
  deleting.value = true
  deleteError.value = null
  try {
    if (section.value === 'events') await concertAdminApi.deleteEvent(item.id)
    else if (section.value === 'tours') await concertAdminApi.deleteTour(item.id)
    else if (section.value === 'venues') await concertAdminApi.deleteVenue(item.id)
    else if (section.value === 'songs') await concertAdminApi.deleteSong(item.id)
    else await concertAdminApi.deleteSource(item.id)
    closeDelete()
    successMessage.value = `${currentConfig.value.singular}已删除`
    successOpen.value = true
    await loadItems(items.value.length === 1 && pagination.value.page > 0 ? pagination.value.page - 1 : pagination.value.page)
  } catch (caught) {
    deleteError.value = isApiError(caught) ? caught.message : '删除失败，请稍后重试。'
  } finally {
    deleting.value = false
  }
}

function primaryText(item: KnowledgeRecord): string {
  if ('official_name' in item) return item.official_name
  if ('name' in item) return item.name
  if ('producer' in item) return item.title
  if ('url' in item) return item.title || item.publisher || item.url
  return '未命名资料'
}
function isTour(item: KnowledgeRecord): item is TourDTO { return section.value === 'tours' && 'organizer' in item }
function isEvent(item: KnowledgeRecord): item is EventDTO { return section.value === 'events' && 'official_name' in item }
function itemSlug(item: KnowledgeRecord): string { return 'slug' in item ? item.slug : `ID ${item.id}` }
function secondaryText(item: KnowledgeRecord): string {
  if ('official_name' in item) return [formatDate(item.local_date), item.city].filter(Boolean).join(' · ')
  if ('organizer' in item) return [[item.start_date, item.end_date].filter(Boolean).join(' — ') || '日期未设置', item.organizer, `共 ${item.event_count ?? 0} 场`].filter(Boolean).join(' · ')
  if ('timezone' in item && 'address' in item) return `${item.city}${item.prefecture ? ` · ${item.prefecture}` : ''} · ${item.timezone}`
  if ('producer' in item) return [item.singer, item.producer].filter(Boolean).join(' / ') || '歌手与 P主未设置'
  if ('url' in item) return [item.publisher, item.url].filter(Boolean).join(' · ')
  return '—'
}
function vocalistColors(item: KnowledgeRecord): VocalistColor[] {
  if (!('producer' in item) || !item.singer?.trim()) return ['other']
  const colors = item.singer
    .split(/[、,，/]+/)
    .map(singer => vocalistColorMap[singer.trim()] ?? 'other')
  return [...new Set(colors)]
}
function vocalistColorLabel(item: KnowledgeRecord): string {
  return 'producer' in item && item.singer?.trim() ? `歌手颜色：${item.singer}` : '歌手颜色：其他或未设置'
}
function statusText(item: KnowledgeRecord): string {
  if ('event_type' in item) return `${eventTypeLabels[item.event_type]} · ${eventStatusLabels[item.status]}`
  if ('organizer' in item) return tourStatusLabels[item.status]
  if ('producer' in item) return songStatusLabels[item.status]
  if ('source_type' in item) return `${sourceTypeLabels[item.source_type]} · ${sourceReliabilityLabels[item.reliability]}`
  return '有效'
}
function statusColor(item: KnowledgeRecord): string | undefined {
  if ('confidence' in item && item.confidence === 'conflicting') return 'error'
  if ('status' in item && item.status === 'cancelled') return 'error'
  if ('status' in item && (item.status === 'completed' || item.status === 'active')) return 'success'
  return undefined
}
function parseSection(value: unknown): ConcertResource {
  const candidate = Array.isArray(value) ? value[0] : value
  return sections.some(item => item.value === candidate) ? candidate as ConcertResource : 'tours'
}
function parseTourId(value: unknown): number | null {
  const candidate = Array.isArray(value) ? value[0] : value
  const parsed = typeof candidate === 'string' && /^\d+$/.test(candidate) ? Number(candidate) : NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}
function beforeUnload(event: BeforeUnloadEvent) { if (!dirty.value) return; event.preventDefault(); event.returnValue = '' }
function handleApiError(caught: unknown, fallback: string) {
  if (isApiError(caught) && caught.status === 401) { appStore.clearAuth(); return }
  error.value = isApiError(caught) ? caught.message : fallback
}
</script>

<style scoped>
.knowledge-page { padding-block: 48px 88px; }
.knowledge-shell { width: 100%; }
.knowledge-heading { margin-bottom: 26px; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.knowledge-heading h1 { margin: 6px 0 8px; font-size: clamp(2rem, 5vw, 3.3rem); letter-spacing: -.05em; }
.knowledge-heading h1 span { color: #39c5bb; }
.knowledge-heading-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.knowledge-card { overflow: hidden; border: 1px solid var(--site-border); }
.knowledge-tabs { border-bottom: 1px solid var(--site-border); }
.tour-context { margin: 16px 20px 0; }
.knowledge-toolbar { padding: 18px 20px; display: grid; grid-template-columns: minmax(240px, 1fr) minmax(150px, 240px) auto auto; gap: 12px; align-items: center; }
.knowledge-alert { margin: 0 20px 18px; }
.knowledge-state { min-height: 300px; padding: 44px 24px; display: flex; align-items: center; justify-content: center; text-align: left; gap: 18px; }
.knowledge-state h2 { margin: 0 0 6px; }
.knowledge-state-icon { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; color: #183b38; background: rgb(57 197 187 / 22%); }
.knowledge-table-wrap { overflow-x: auto; }
.knowledge-table { min-width: 820px; }
.knowledge-table th { white-space: nowrap; color: var(--site-muted); font-size: .76rem; text-transform: uppercase; letter-spacing: .07em; }
.vocalist-column { width: 28px; min-width: 28px; padding: 0 0 0 12px !important; }
.vocalist-marker { width: 8px; height: 38px; overflow: hidden; display: flex; flex-direction: column; border-radius: 999px; box-shadow: 0 0 0 1px rgb(24 59 56 / 8%); }
.vocalist-marker-segment { min-height: 4px; flex: 1; }
.primary-cell { min-width: 210px; display: grid; gap: 3px; }
.primary-cell span { color: var(--site-muted); font-size: .75rem; }
.tour-name-link { width: fit-content; color: inherit; font-weight: 700; text-decoration: none; text-underline-offset: 3px; }
.tour-name-link:hover, .tour-name-link:focus-visible { color: rgb(var(--v-theme-secondary)); text-decoration: underline; }
.event-name-link { width: fit-content; padding: 0; border: 0; color: inherit; background: transparent; font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
.event-name-link:hover, .event-name-link:focus-visible { color: rgb(var(--v-theme-secondary)); text-decoration: underline; }
.setlist-drawer :deep(.v-navigation-drawer__content) { overflow-y: auto; }
.setlist-drawer.v-navigation-drawer { transition: transform 240ms cubic-bezier(.4, 0, .2, 1) !important; }
.setlist-drawer-header { padding: 24px 26px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--site-border); }
.setlist-drawer-header h2 { margin: 6px 0; font-size: 1.35rem; }
.setlist-alert { margin: 18px 20px; }
.setlist-state { min-height: 180px; padding: 32px 24px; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--site-muted); text-align: center; }
.setlist-list { padding: 12px 16px; }
.setlist-item { border-bottom: 1px solid var(--site-border); }
.setlist-position-wrap { position: relative; width: 30px; height: 30px; margin-right: 12px; }
.setlist-position { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; color: #183b38; background: rgb(57 197 187 / 22%); font-size: .8rem; font-weight: 800; }
.setlist-tape-mark { position: absolute; top: -9px; right: -10px; z-index: 1; width: 20px; height: 20px; display: grid; place-items: center; border: 2px solid rgb(var(--v-theme-surface)); border-radius: 999px; background: #fff4d6; box-shadow: 0 2px 5px rgb(34 56 53 / 18%); font-size: 12px; line-height: 1; }
.setlist-meta, .setlist-details { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.setlist-details { margin-top: 3px; }
.setlist-version { color: var(--site-muted); font-weight: 500; }
.setlist-vocalist-marker { width: 8px; height: 30px; margin-right: 10px; overflow: hidden; display: inline-flex; flex-direction: column; border-radius: 999px; }
.setlist-vocalist-segment { min-height: 3px; flex: 1; }
@media (prefers-reduced-motion: reduce) {
  .setlist-drawer.v-navigation-drawer { transition-duration: 240ms !important; }
}
.actions-column { width: 152px; white-space: nowrap; text-align: right !important; }
.knowledge-pagination { padding: 16px 20px; border-top: 1px solid var(--site-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; color: var(--site-muted); font-size: .85rem; }
.knowledge-drawer :deep(.v-navigation-drawer__content) { overflow-y: auto; }
.knowledge-drawer.v-navigation-drawer { transition: transform 240ms cubic-bezier(.4, 0, .2, 1) !important; }
@media (max-width: 760px) { .knowledge-page { padding-block: 34px 64px; } .knowledge-heading { align-items: flex-start; flex-direction: column; } .knowledge-heading-actions { width: 100%; flex-direction: column-reverse; } .knowledge-heading-actions .v-btn { width: 100%; } .knowledge-toolbar { grid-template-columns: 1fr auto; } .knowledge-toolbar > :first-child { grid-column: 1 / -1; } .knowledge-pagination { align-items: flex-start; flex-direction: column; } }
</style>
