<script setup lang="ts">
import { useActivityApi, type Activity, type ActivityDetail, type ActivityPatch, type Announcement, type CrawlRun, type ReviewStatus, type ActivityStatus } from '@/api/activity'
import { isApiError } from '@/api/http'
import { activityDate, activityLabel, activityLink, activityTime } from '@/utils/activity'
import ActivityEditor from '@/components/admin/ActivityEditor.vue'
import ActivityReview from '@/components/admin/ActivityReview.vue'
import ActivityDetails from '@/components/admin/ActivityDetail.vue'
import ActivityAnnouncementPush from '@/components/admin/ActivityAnnouncementPush.vue'

useSeoMeta({ title: '官方新闻与活动 · 管理中心' })
const api = useActivityApi()
type Section = 'events' | 'announcements' | 'runs'
const section = ref<Section>('events')
const search = ref(''), review = ref<ReviewStatus | null>('pending'), importance = ref<string | null>(null), kind = ref<string | null>(null), generation = ref<string | null>(null)
const activityStatus = ref<ActivityStatus | null>(null)
const from = ref(''), to = ref('')
const events = ref<Activity[]>([]), announcements = ref<Announcement[]>([]), runs = ref<CrawlRun[]>([])
const pagination = reactive({ page: 0, page_size: 20, total: 0, has_more: false })
const loading = ref(false), error = ref(''), message = ref(''), starting = ref(false), saving = ref(false)
const detailOpen = ref(false), editorOpen = ref(false), reviewOpen = ref(false), detailLoading = ref(false), detailError = ref(''), mutationError = ref('')
const selectedEvent = ref<ActivityDetail | null>(null), selectedAnnouncement = ref<Announcement | null>(null), selectedRun = ref<CrawlRun | null>(null)
const detailKind = ref<Section>('events'), selectedId = ref(0), reviewAction = ref<'approved' | 'rejected'>('approved')
const reviewEvent = ref<ActivityDetail | null>(null)
const statusUpdatingId = ref<number | null>(null)
let requestVersion = 0, detailVersion = 0
const options = (values: string[]) => values.map(value => ({ title: activityLabel(value), value }))
const activeRunning = ref(false)
const hasRunning = computed(() => activeRunning.value || selectedRun.value?.status === 'running')
const rowsExist = computed(() => (section.value === 'events' ? events.value : section.value === 'announcements' ? announcements.value : runs.value).length > 0)
const failure = (e: unknown) => isApiError(e) && e.status === 409 ? '正在执行其他采集或管理操作，请稍后重试。' : e instanceof Error ? e.message : '请求失败，请重试'
async function refreshRuns() {
  try {
    const result = await api.runs({ page: 0, page_size: 20 })
    activeRunning.value = result.items.some(run => run.status === 'running')
    const id = selectedRun.value?.id
    if (id) { const run = await api.run(id); if (selectedRun.value?.id === id) selectedRun.value = run }
  } catch { /* The visible request supplies the actionable error. */ }
}
async function load(page = 0) {
  const version = ++requestVersion, current = section.value
  loading.value = true; error.value = ''
  try {
    if (current !== 'events' && from.value && to.value && from.value > to.value) throw new Error('起始日期不得晚于结束日期')
    const query = { page, page_size: 20, ...(current !== 'runs' && (search.value ?? '').trim() ? { q: (search.value ?? '').trim() } : {}),
      ...(current !== 'events' ? { from: activityDate(from.value), to: activityDate(to.value, true) } : {}) }
    const result = current === 'events' ? await api.events({ ...query, activity_status: activityStatus.value ?? undefined, review_status: review.value ?? undefined }) : current === 'announcements' ? await api.announcements({ ...query, importance: importance.value ?? undefined, announcement_type: kind.value ?? undefined, generation_status: generation.value ?? undefined }) : await api.runs(query)
    if (version !== requestVersion) return
    if (current === 'events') events.value = result.items as Activity[]
    else if (current === 'announcements') announcements.value = result.items as Announcement[]
    else runs.value = result.items as CrawlRun[]
    Object.assign(pagination, result.pagination)
    void refreshRuns()
  } catch (e) { if (version === requestVersion) error.value = failure(e) }
  finally { if (version === requestVersion) loading.value = false }
}
async function openDetail(type: Section, id: number) {
  const version = ++detailVersion
  detailKind.value = type; selectedId.value = id; detailOpen.value = true; detailLoading.value = true; detailError.value = ''
  selectedEvent.value = null; selectedAnnouncement.value = null; selectedRun.value = null
  try {
    if (type === 'events') { const item = await api.event(id); if (version === detailVersion) selectedEvent.value = item }
    else if (type === 'announcements') { const item = await api.announcement(id); if (version === detailVersion) selectedAnnouncement.value = item }
    else { const item = await api.run(id); if (version === detailVersion) selectedRun.value = item }
  } catch (e) { if (version === detailVersion) detailError.value = failure(e) }
  finally { if (version === detailVersion) detailLoading.value = false }
}
async function mutate(operation: () => Promise<unknown>, closeDetail = false) {
  if (saving.value) return
  saving.value = true; mutationError.value = ''
  try {
    await operation(); editorOpen.value = false; reviewOpen.value = false; message.value = '操作成功'
    if (closeDetail) detailOpen.value = false
    else if (detailOpen.value && selectedEvent.value) await openDetail('events', selectedEvent.value.id)
    await load(pagination.page)
  } catch (e) { mutationError.value = failure(e); if (isApiError(e) && e.status === 409) await refreshRuns() }
  finally { saving.value = false }
}
function save(patch: ActivityPatch) { if (selectedEvent.value) { const id = selectedEvent.value.id; void mutate(() => api.update(id, patch)) } }
async function toggleArchive(item: Activity) {
  if (saving.value) return
  const status = item.activity_status === 'ended' ? 'ongoing' : 'ended'
  saving.value = true; statusUpdatingId.value = item.id; error.value = ''; message.value = ''
  try {
    await api.update(item.id, { activity_status: status })
    message.value = status === 'ended' ? '活动已归档' : '活动已恢复为进行中'
    await load(pagination.page)
  } catch (e) { error.value = failure(e); if (isApiError(e) && e.status === 409) await refreshRuns() }
  finally { saving.value = false; statusUpdatingId.value = null }
}
function submitReview(note: string) { if (reviewEvent.value) { const id = reviewEvent.value.id; void mutate(() => api.review(id, reviewAction.value, note), true) } }
function beginReview(status: 'approved' | 'rejected') {
  if (!selectedEvent.value || saving.value) return
  reviewEvent.value = selectedEvent.value
  mutationError.value = ''; reviewAction.value = status; reviewOpen.value = true
}
async function start() {
  if (starting.value || hasRunning.value) return
  starting.value = true; error.value = ''
  try {
    const run = await api.start(); activeRunning.value = true; selectedRun.value = run; runs.value = [run, ...runs.value.filter(r => r.id !== run.id)]
    message.value = `采集批次 #${run.id} 已启动，请刷新查看进度。`
    if (section.value !== 'runs') section.value = 'runs'
    else await load(0)
    await openDetail('runs', run.id)
  } catch (e) { error.value = failure(e); if (isApiError(e) && e.status === 409) await refreshRuns() }
  finally { starting.value = false }
}
watch([section, activityStatus, review, importance, kind, generation, from, to], () => { void load(0) })
onMounted(() => { void load(); void refreshRuns() })
onBeforeUnmount(() => { requestVersion++; detailVersion++ })
</script>

<template>
  <div class="activity-page site-container">
    <header class="activity-heading">
      <div><p class="eyebrow">OFFICIAL NEWS / 官方资讯</p><h1>活动与公告<span>。</span></h1><p class="muted">每天北京时间12:00、21:00采集官方来源，高重要度公告自动推送到演出订阅群。</p></div>
      <div class="actions"><v-btn to="/admin" variant="text" prepend-icon="mdi-arrow-left">管理中心</v-btn><v-btn color="primary" prepend-icon="mdi-download-network-outline" :loading="starting" :disabled="hasRunning" @click="start">{{ hasRunning ? '采集执行中' : '手动采集' }}</v-btn></div>
    </header>
    <v-alert v-if="message" type="success" variant="tonal" closable class="mb-4" @click:close="message = ''">{{ message }}</v-alert>
    <v-card class="surface-card">
      <v-tabs v-model="section" color="secondary" show-arrows><v-tab value="events">活动信息</v-tab><v-tab value="announcements">公告</v-tab><v-tab value="runs">采集记录</v-tab></v-tabs>
      <v-form class="filters" @submit.prevent="load(0)">
        <v-text-field v-if="section !== 'runs'" v-model="search" label="关键词" clearable hide-details @click:clear="search = ''; load(0)" />
        <v-select v-if="section === 'events'" v-model="activityStatus" label="活动状态" :items="options(['ongoing', 'ended'])" clearable hide-details />
        <v-select v-if="section === 'events'" v-model="review" label="审批状态" :items="options(['pending', 'approved', 'rejected'])" clearable hide-details />
        <template v-if="section === 'announcements'">
          <v-select v-model="importance" label="重要程度" :items="options(['high', 'medium', 'low'])" clearable hide-details />
          <v-select v-model="kind" label="公告类型" :items="options(['discovery', 'update'])" clearable hide-details />
          <v-select v-model="generation" label="生成状态" :items="options(['pending', 'ready', 'failed'])" clearable hide-details />
        </template>
        <template v-if="section !== 'events'"><v-text-field v-model="from" type="date" label="起始日期（北京时间）" hide-details /><v-text-field v-model="to" type="date" label="结束日期（北京时间）" hide-details /></template>
        <v-btn type="submit" variant="outlined" :loading="loading">查询</v-btn><v-btn icon="mdi-refresh" variant="text" aria-label="刷新当前列表与采集状态" :loading="loading" @click="load(pagination.page); refreshRuns()" />
      </v-form>
      <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}<template #append><v-btn variant="text" @click="load(pagination.page)">重试</v-btn></template></v-alert>
      <v-progress-linear v-if="loading" indeterminate color="primary" aria-label="正在加载列表" />
      <div v-if="!rowsExist" class="empty" aria-live="polite">{{ loading ? '正在加载…' : error ? '列表加载失败' : '暂无符合条件的记录' }}</div>
      <div v-else class="table-wrap" :aria-busy="loading">
        <v-table v-if="section === 'events'" hover>
          <thead><tr><th>活动标题</th><th>监控页面</th><th>活动状态</th><th>审批</th><th>监控</th><th>更新时间（北京时间）</th><th>操作</th></tr></thead>
          <tbody><tr v-for="item in events" :key="item.id"><td class="title-cell">{{ item.chinese_title || item.original_title }}<small>#{{ item.id }}</small></td><td><small>{{ item.monitor_page_count }} 个页面</small><a v-if="activityLink(item.official_url)" :href="activityLink(item.official_url)" target="_blank" rel="noopener noreferrer">打开首个页面</a><span v-else>—</span></td><td><v-chip size="small" :color="item.activity_status === 'ended' ? undefined : 'primary'">{{ activityLabel(item.activity_status) }}</v-chip></td><td><v-chip size="small" :color="item.review_status === 'approved' ? 'success' : undefined">{{ activityLabel(item.review_status) }}</v-chip></td><td>{{ item.monitor_enabled ? '开启' : '关闭' }}</td><td>{{ activityTime(item.updated_at) }}</td><td><div class="row-actions"><v-btn variant="text" size="small" @click="openDetail('events', item.id)">查看与管理</v-btn><v-btn variant="tonal" color="primary" size="small" :aria-label="`${item.activity_status === 'ended' ? '恢复' : '归档'}活动 #${item.id}`" :loading="statusUpdatingId === item.id" :disabled="saving || loading" @click="toggleArchive(item)">{{ item.activity_status === 'ended' ? '恢复' : '归档' }}</v-btn></div></td></tr></tbody>
        </v-table>
        <v-table v-else-if="section === 'announcements'" hover>
          <thead><tr><th>公告标题</th><th>关联活动</th><th>重要程度</th><th>类型</th><th>生成状态</th><th>QQ群推送</th><th>发现时间（北京时间）</th><th>操作</th></tr></thead>
          <tbody><tr v-for="item in announcements" :key="item.id"><td class="title-cell">{{ item.title || '尚未生成标题' }}</td><td><v-btn variant="text" size="small" @click="openDetail('events', item.activity_id)">#{{ item.activity_id }}</v-btn></td><td><v-chip size="small" :color="item.importance === 'high' ? 'error' : undefined">{{ activityLabel(item.importance) }}</v-chip></td><td>{{ activityLabel(item.announcement_type) }}</td><td>{{ activityLabel(item.generation_status) }}</td><td>{{ item.push_batch_id ? '已触发（查看群状态）' : '尚未触发' }}</td><td>{{ activityTime(item.discovered_at) }}</td><td><v-btn variant="text" size="small" @click="openDetail('announcements', item.id)">查看 / 推送</v-btn></td></tr></tbody>
        </v-table>
        <v-table v-else hover>
          <thead><tr><th>批次</th><th>触发</th><th>状态</th><th>开始 / 结束（北京时间）</th><th>新增</th><th>变化</th><th>公告</th><th>失败</th><th>操作</th></tr></thead>
          <tbody><tr v-for="item in runs" :key="item.id"><td>#{{ item.id }}</td><td>{{ item.trigger_type === 'manual' ? '手动' : '定时' }}</td><td><v-chip size="small" :color="item.status === 'running' ? 'primary' : item.status === 'failed' ? 'error' : undefined">{{ activityLabel(item.status) }}</v-chip></td><td>{{ activityTime(item.started_at) }}<small>{{ activityTime(item.finished_at) }}</small></td><td>{{ item.new_item_count }}</td><td>{{ item.change_count }}</td><td>{{ item.announcement_count }}</td><td>{{ item.failure_count }}</td><td><v-btn variant="text" size="small" @click="openDetail('runs', item.id)">详情</v-btn></td></tr></tbody>
        </v-table>
      </div>
      <div class="pagination"><span>共 {{ pagination.total }} 条</span><v-pagination :model-value="pagination.page + 1" :length="Math.max(1, Math.ceil(pagination.total / pagination.page_size))" :total-visible="4" :disabled="loading" aria-label="列表分页" @update:model-value="page => load(page - 1)" /></div>
    </v-card>
    <v-dialog v-model="detailOpen" max-width="900" scrollable>
      <v-card :title="detailKind === 'events' ? '活动信息' : detailKind === 'announcements' ? '公告详情' : '采集批次详情'">
        <v-card-text>
          <v-progress-linear v-if="detailLoading" indeterminate color="primary" />
          <v-alert v-else-if="detailError" type="error" variant="tonal">{{ detailError }}<v-btn variant="text" @click="openDetail(detailKind, selectedId)">重试</v-btn></v-alert>
          <ActivityDetails v-else-if="selectedEvent" :activity="selectedEvent" />
          <div v-else-if="selectedAnnouncement" class="detail-content">
            <h3>{{ selectedAnnouncement.title || '公告尚未生成' }}</h3><p>{{ selectedAnnouncement.activity_title }} · {{ activityLabel(selectedAnnouncement.announcement_type) }}</p>
            <v-alert v-if="selectedAnnouncement.generation_status !== 'ready'" type="info" variant="tonal">{{ activityLabel(selectedAnnouncement.generation_status) }}，当前无已完成的公告正文。</v-alert>
            <p v-else class="preserve">{{ selectedAnnouncement.content }}</p>
            <p>重要程度：{{ activityLabel(selectedAnnouncement.importance) }} · {{ selectedAnnouncement.importance_reason || '—' }}</p>
            <p v-if="selectedAnnouncement.page_name">变化页面：{{ selectedAnnouncement.page_name }}</p><p>来源发布时间：{{ activityTime(selectedAnnouncement.source_published_at) }}</p><p>发现时间：{{ activityTime(selectedAnnouncement.discovered_at) }}</p><p>生成时间：{{ activityTime(selectedAnnouncement.generated_at) }}（以上均为北京时间）</p>
            <a v-if="activityLink(selectedAnnouncement.source_url)" :href="activityLink(selectedAnnouncement.source_url)" target="_blank" rel="noopener noreferrer">查看官方来源</a>
            <v-alert v-if="selectedAnnouncement.last_error" type="error" variant="tonal">{{ selectedAnnouncement.last_error }}</v-alert>
            <ActivityAnnouncementPush :key="selectedAnnouncement.id" :announcement-id="selectedAnnouncement.id" @changed="load(pagination.page)" />
          </div>
          <div v-else-if="selectedRun" class="detail-content">
            <h3>批次 #{{ selectedRun.id }} · {{ activityLabel(selectedRun.status) }}</h3><p>触发方式：{{ selectedRun.trigger_type === 'manual' ? '管理员手动' : '定时任务' }}</p>
            <p>开始：{{ activityTime(selectedRun.started_at) }} · 结束：{{ activityTime(selectedRun.finished_at) }}（北京时间）</p>
            <p>新增条目 {{ selectedRun.new_item_count }} · 官网变化 {{ selectedRun.change_count }} · 成功公告 {{ selectedRun.announcement_count }} · 失败 {{ selectedRun.failure_count }}</p>
            <v-alert v-if="selectedRun.status === 'running'" type="info" variant="tonal">任务仍在执行，请手动刷新查看进度。</v-alert>
            <pre class="preserve">{{ selectedRun.error_summary || '暂无错误记录' }}</pre>
            <v-btn variant="tonal" @click="openDetail('runs', selectedRun.id); load(pagination.page)">刷新进度</v-btn>
          </div>
        </v-card-text>
        <v-card-actions class="actions"><template v-if="selectedEvent && !detailLoading"><v-btn @click="mutationError = ''; editorOpen = true">编辑</v-btn><v-btn color="primary" @click="beginReview('approved')">批准</v-btn><v-btn color="error" @click="beginReview('rejected')">拒绝</v-btn></template><v-spacer /><v-btn @click="detailOpen = false">关闭</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="editorOpen" max-width="700" :persistent="saving" scrollable><ActivityEditor v-if="editorOpen && selectedEvent" :key="selectedEvent.id" :activity="selectedEvent" :saving="saving" :error="mutationError" @save="save" @cancel="editorOpen = false" /></v-dialog>
    <v-dialog v-model="reviewOpen" max-width="580" :persistent="saving"><ActivityReview v-if="reviewOpen && reviewEvent" :key="`${reviewEvent.id}-${reviewAction}`" :activity="reviewEvent" :status="reviewAction" :saving="saving" :error="mutationError" @submit="submitReview" @cancel="reviewOpen = false" /></v-dialog>
  </div>
</template>
<style scoped>
.activity-page { padding-block: 48px 72px; max-width: 1440px; }
.activity-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
h1 { font-size: clamp(2rem, 4vw, 3rem); margin: 4px 0 10px; letter-spacing: -.04em; } h1 span { color: #39c5bb; }
.row-actions { display: flex; align-items: center; gap: 6px; padding-block: 8px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.filters { padding: 24px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.filters :deep(.v-input) { flex: 1 1 170px; }
.table-wrap { overflow-x: auto; } .table-wrap :deep(table) { min-width: 850px; }
.title-cell { min-width: 200px; max-width: 360px; white-space: normal; overflow-wrap: anywhere; padding-block: 12px !important; }
small { display: block; color: var(--site-muted); } a { color: rgb(var(--v-theme-secondary)); }
.empty { padding: 60px 24px; text-align: center; color: var(--site-muted); }
.pagination { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; gap: 12px; }
.detail-content { display: grid; gap: 16px; overflow-wrap: anywhere; }.preserve { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
@media(max-width: 760px) { .activity-heading { align-items: flex-start; flex-direction: column; }.activity-page { padding-block: 30px 48px; }.filters { padding: 16px; }.pagination { flex-direction: column; } }
</style>
