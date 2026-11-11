<template>
  <div class="site-container calendar-page">
    <header class="calendar-heading">
      <div><p class="eyebrow">CALENDAR / 日历</p><h1>把重要的日子记下来<span>.</span></h1><p class="muted">生日、演出，还有每一个值得期待的时刻。</p></div>
      <v-btn v-if="canManage" color="primary" prepend-icon="mdi-plus" @click="createEvent">新增事件</v-btn>
    </header>

    <v-card v-if="authLoading" class="state-card" role="status"><v-progress-circular indeterminate color="primary" /><p>正在加载账户信息…</p></v-card>
    <v-card v-else-if="!store.isLoggedIn" class="state-card"><v-icon icon="mdi-calendar-lock-outline" size="40" color="secondary" /><h2>登录后查看日历</h2><p class="muted">查看生日、演出和重要事项。</p><v-btn to="/login" color="primary">前往登录</v-btn></v-card>
    <v-card v-else-if="!store.userInfo || store.userInfoError" class="state-card"><p>{{ store.userInfoError || '账户信息暂不可用。' }}</p><v-btn @click="initializeAuth">重新加载</v-btn></v-card>
    <template v-else>
      <div class="calendar-toolbar">
        <div class="month-controls">
          <v-btn icon="mdi-chevron-left" variant="text" aria-label="上个月" :disabled="month <= '1970-01'" @click="moveMonth(-1)" />
          <v-dialog v-model="monthPickerOpen" :max-width="smAndDown ? 380 : 520" :location="smAndDown ? 'bottom' : 'center'" :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" @update:model-value="prepareMonthPicker">
            <template #activator="{ props }">
              <h2 aria-live="polite"><v-btn v-bind="props" variant="text" append-icon="mdi-chevron-down" aria-label="快捷选择年月">{{ monthLabel }}</v-btn></h2>
            </template>
            <v-card class="month-picker" title="选择年月">
                <v-card-text class="month-picker-content">
                  <div class="picker-heading">
                    <v-btn icon="mdi-chevron-left" variant="text" :aria-label="pickerView === 'year' ? '前二十年' : '上一年'" :disabled="pickerView === 'year' ? yearPage <= 1970 : pickerYear <= 1970" @click="shiftPicker(-1)" />
                    <v-btn variant="tonal" color="secondary" :aria-label="pickerView === 'year' ? '返回月份选择' : '选择年份'" @click="pickerView = pickerView === 'year' ? 'months' : 'year'">{{ pickerView === 'year' ? `${yearPage} — ${Math.min(yearPage + 19, 2099)}` : `${pickerYear} 年` }}<v-icon end icon="mdi-chevron-down" /></v-btn>
                    <v-btn icon="mdi-chevron-right" variant="text" :aria-label="pickerView === 'year' ? '后二十年' : '下一年'" :disabled="pickerView === 'year' ? yearPage >= 2090 : pickerYear >= 2099" @click="shiftPicker(1)" />
                  </div>
                  <VDatePickerYears v-if="pickerView === 'year'" :key="yearPage" :model-value="pickerYear" :min="`${yearPage}-01-01`" :max="`${Math.min(yearPage + 19, 2099)}-12-31`" :columns="smAndDown ? 3 : 4" color="primary" @update:model-value="selectPickerYear" @escape="monthPickerOpen = false" />
                  <VDatePickerMonths v-else :model-value="pickerMonth - 1" :year="pickerYear" :columns="3" min="1970-01-01" max="2099-12-31" height="280" color="primary" @update:model-value="value => { pickerMonth = value + 1; monthPickerError = '' }" @escape="monthPickerOpen = false" />
                  <v-alert v-if="monthPickerError" type="error" variant="tonal" density="compact" role="alert">{{ monthPickerError }}</v-alert>
                </v-card-text>
                <v-card-actions><v-spacer /><v-btn @click="monthPickerOpen = false">取消</v-btn><v-btn color="primary" variant="flat" @click="applyMonthPicker">确定</v-btn></v-card-actions>
            </v-card>
          </v-dialog>
          <v-btn icon="mdi-chevron-right" variant="text" aria-label="下个月" :disabled="month >= '2099-12'" @click="moveMonth(1)" />
          <v-btn variant="tonal" @click="goToday">今天</v-btn>
        </div>
        <div class="calendar-filters">
          <v-select v-model="eventType" label="事件类型" :items="calendarTypes" clearable hide-details density="compact" />
          <v-select v-if="canManage" v-model="status" label="事件状态" :items="statusOptions" hide-details density="compact" />
        </div>
      </div>
      <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4" role="alert">{{ loadError }}<v-btn variant="text" @click="loadEvents">重试</v-btn></v-alert>
      <v-progress-linear v-if="loading" indeterminate color="primary" aria-label="正在加载日历" />
      <div class="calendar-layout" :aria-busy="loading">
        <v-card class="month-card">
          <div class="mobile-date"><v-text-field :model-value="selectedDate" type="date" label="选择日期" min="1970-01-01" max="2099-12-31" hide-details @update:model-value="selectMobileDate" /></div>
          <div class="month-grid">
            <div v-for="weekday in weekdays" :key="weekday" class="weekday">{{ weekday }}</div>
            <div v-for="day in days" :key="day" class="day-cell" :class="{ outside: !day.startsWith(month), selected: day === selectedDate }" @click="selectedDate = day">
              <v-btn class="day-number" size="small" :variant="day === today ? 'flat' : 'text'" :color="day === today ? 'primary' : undefined" :aria-label="`${day}，${eventsForDay(day).length} 个事件`" :aria-pressed="day === selectedDate" @click="selectedDate = day">{{ Number(day.slice(8)) }}</v-btn>
              <v-btn v-for="item in eventsForDay(day).slice(0, 2)" :key="`${item.id}:${item.occurrence_start_date}`" class="grid-event" :class="{ cancelled: item.status === 'cancelled' }" size="x-small" variant="tonal" :title="`${calendarTypeLabel(item.event_type)}：${item.title}${item.status === 'cancelled' ? '（已取消）' : ''}`" @click.stop="openEvent(item, day)">{{ item.title }}</v-btn>
              <v-btn v-if="eventsForDay(day).length > 2" class="more-events" size="x-small" variant="text" @click="selectedDate = day">另 {{ eventsForDay(day).length - 2 }} 项</v-btn>
            </div>
          </div>
        </v-card>
        <v-card class="agenda-card">
          <div class="agenda-heading"><p class="eyebrow">当天日程</p><h2>{{ selectedDate }}</h2></div>
          <p v-if="loading" class="muted" role="status">正在获取事件…</p>
          <p v-else-if="loadError" class="muted">加载失败，请重试。</p>
          <div v-else-if="!selectedEvents.length" class="agenda-empty"><v-icon icon="mdi-calendar-blank-outline" size="36" /><p>这一天暂时没有事件</p><v-btn v-if="canManage" variant="text" color="secondary" @click="createEvent">添加一个重要日子</v-btn></div>
          <v-btn v-for="item in selectedEvents" :key="`${item.id}:${item.occurrence_start_date}`" class="agenda-event" variant="text" @click="openEvent(item, selectedDate)">
            <span class="event-copy"><span class="event-meta">{{ calendarTypeLabel(item.event_type) }} · {{ item.all_day ? '全天' : item.start_time }}<span v-if="item.status === 'cancelled'"> · 已取消</span></span><strong :class="{ cancelled: item.status === 'cancelled' }">{{ item.title }}</strong><span class="event-zone">{{ item.timezone }}<span v-if="item.recurrence === 'yearly'"> · 每年重复</span></span></span><v-icon icon="mdi-arrow-top-right" size="18" />
          </v-btn>
        </v-card>
      </div>
    </template>

    <v-dialog v-model="detailOpen" max-width="620" :persistent="mutating">
      <v-card title="事件详情">
        <v-card-text>
          <v-progress-linear v-if="detailLoading" indeterminate color="primary" />
          <v-alert v-if="detailError" type="error" variant="tonal">{{ detailError }}<v-btn v-if="detailId" variant="text" @click="fetchDetail(detailId)">重试</v-btn></v-alert>
          <template v-if="detail && !detailLoading">
            <p class="eyebrow">{{ calendarTypeLabel(detail.event_type) }} · {{ detail.status === 'cancelled' ? '已取消' : '正常' }}</p>
            <h2 class="detail-title">{{ detail.title }}</h2>
            <p>{{ detailOccurrence?.occurrence_start_date ?? detail.start_date }} 至 {{ detailOccurrence?.occurrence_end_date ?? detail.end_date }}</p>
            <p>{{ detail.all_day ? '全天' : `${detail.start_time}${detail.end_time ? ` — ${detail.end_time}` : ''}` }} · {{ detail.timezone }}</p>
            <p v-if="detail.recurrence === 'yearly'" class="muted">每年重复 · 首次日期 {{ detail.start_date }}</p>
            <p v-if="detail.description" class="detail-description">{{ detail.description }}</p>
            <v-btn v-if="safeSourceUrl" :href="safeSourceUrl" target="_blank" rel="noopener noreferrer" variant="text" color="secondary" append-icon="mdi-open-in-new">查看来源</v-btn>
          </template>
        </v-card-text>
        <v-card-actions class="detail-actions">
          <template v-if="canManage && detail && !detailLoading">
            <v-btn color="secondary" :disabled="mutating" @click="editEvent">编辑</v-btn>
            <v-btn :loading="mutating" @click="changeStatus">{{ detail.status === 'active' ? '取消事件' : '恢复事件' }}</v-btn>
            <v-btn color="error" :disabled="mutating" @click="deleteOpen = true">删除</v-btn>
          </template>
          <v-spacer /><v-btn :disabled="mutating" @click="detailOpen = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="editorOpen" max-width="760" persistent scrollable>
      <CalendarEventEditor v-if="editorOpen && canManage" :event="editingEvent" :date="selectedDate" :can-manage="canManage" @close="editorOpen = false" @saved="onSaved" />
    </v-dialog>
    <v-dialog v-model="deleteOpen" max-width="440" :persistent="mutating">
      <v-card title="删除事件？"><v-card-text><p>将永久删除「{{ detail?.title }}」。每年重复事件的所有发生记录也将移除。</p><v-alert v-if="deleteError" type="error" class="mt-4">{{ deleteError }}</v-alert></v-card-text><v-card-actions><v-spacer /><v-btn :disabled="mutating" @click="deleteOpen = false">返回</v-btn><v-btn color="error" :loading="mutating" @click="removeEvent">确认删除</v-btn></v-card-actions></v-card>
    </v-dialog>
    <v-snackbar v-model="noticeOpen" :timeout="4000">{{ notice }}<template #actions><v-btn @click="noticeOpen = false">关闭</v-btn></template></v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { VDatePickerMonths, VDatePickerYears } from 'vuetify/components/VDatePicker'
import { calendarTypes, calendarTypeLabel, useCalendarApi, type CalendarType, type CalendarStatus, type CalendarEvent, type CalendarOccurrence } from '@/api/calendar'
import { calendarDays, eventsOnDate, localDate } from '@/utils/calendar'
import { useAppStore } from '@/stores/app'
import { useAuthSession } from '@/composables/useAuthSession'
import CalendarEventEditor from '@/components/calendar/CalendarEventEditor.vue'

useSeoMeta({ title: '日历 · Ivan1105', description: '查看生日、演出和重要事项。' })
const store = useAppStore()
const { initializeAuth } = useAuthSession()
const api = useCalendarApi()
const mounted = ref(false)
const today = ref('2000-01-01')
const selectedDate = ref(today.value)
const month = ref(today.value.slice(0, 7))
const authLoading = computed(() => !mounted.value || !store.authInitialized || store.userInfoLoading)
const canManage = computed(() => !authLoading.value && !store.userInfoError && store.isLoggedIn && store.userInfo?.role === 'admin')
const canRead = computed(() => !authLoading.value && store.isLoggedIn && !!store.userInfo && !store.userInfoError)
const eventType = ref<CalendarType | null>(null)
const status = ref<CalendarStatus>('active')
const statusOptions = [{ title: '正常事件', value: 'active' }, { title: '已取消事件', value: 'cancelled' }]
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const days = computed(() => calendarDays(month.value))
const monthLabel = computed(() => `${Number(month.value.slice(0, 4))} 年 ${Number(month.value.slice(5))} 月`)
const monthPickerOpen = ref(false)
const { smAndDown } = useDisplay()
const pickerYear = ref(2000)
const pickerMonth = ref(1)
const pickerView = ref<'months' | 'year'>('months')
const yearPage = ref(1990)
const monthPickerError = ref('')
function shiftPicker(direction: number) {
  if (pickerView.value === 'year') yearPage.value = Math.max(1970, Math.min(2090, yearPage.value + direction * 20))
  else { pickerYear.value = Math.max(1970, Math.min(2099, pickerYear.value + direction)); yearPage.value = 1970 + Math.floor((pickerYear.value - 1970) / 20) * 20 }
  monthPickerError.value = ''
}
function selectPickerYear(year: number) { pickerYear.value = year; pickerView.value = 'months'; monthPickerError.value = '' }
function prepareMonthPicker(open: boolean) {
  if (!open) return
  pickerYear.value = Number(month.value.slice(0, 4))
  pickerMonth.value = Number(month.value.slice(5))
  yearPage.value = 1970 + Math.floor((pickerYear.value - 1970) / 20) * 20
  pickerView.value = 'months'
  monthPickerError.value = ''
}
function applyMonthPicker() {
  const year = Number(pickerYear.value)
  const next = `${String(year).padStart(4, '0')}-${String(pickerMonth.value).padStart(2, '0')}`
  if (!Number.isInteger(year) || year < 1970 || year > 2099 || !Number.isInteger(pickerMonth.value) || pickerMonth.value < 1 || pickerMonth.value > 12) {
    monthPickerError.value = '请选择 1970 年至 2099 年之间的年月。'
    return
  }
  month.value = next
  selectedDate.value = `${next}-01`
  monthPickerOpen.value = false
}
const events = ref<CalendarOccurrence[]>([])
const loading = ref(false)
const loadError = ref('')
const selectedEvents = computed(() => eventsOnDate(events.value, selectedDate.value))
const eventsForDay = (date: string) => eventsOnDate(events.value, date)
let requestVersion = 0
async function loadEvents() {
  const version = ++requestVersion
  events.value = []
  loadError.value = ''
  if (!canRead.value) { loading.value = false; return }
  loading.value = true
  try {
    const result = await api.occurrences({ date_from: days.value[0]!, date_to: days.value[41]!, event_type: eventType.value ?? undefined, status: canManage.value ? status.value : 'active' }, canManage.value)
    if (version === requestVersion) events.value = result.items
  } catch (error) { if (version === requestVersion) loadError.value = error instanceof Error ? error.message : '日历加载失败。' }
  finally { if (version === requestVersion) loading.value = false }
}
function moveMonth(delta: number) {
  const date = new Date(`${month.value}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  const next = date.toISOString().slice(0, 7)
  if (next < '1970-01' || next > '2099-12') return
  month.value = next
  selectedDate.value = `${month.value}-01`
}
function goToday() { today.value = localDate(); month.value = today.value.slice(0, 7); selectedDate.value = today.value }
function selectMobileDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1970-01-01' || value > '2099-12-31') return
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) return
  selectedDate.value = value
  month.value = value.slice(0, 7)
}
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailId = ref<number | null>(null)
const detail = ref<CalendarEvent | null>(null)
const detailOccurrence = ref<CalendarOccurrence | null>(null)
let detailVersion = 0
async function openEvent(item: CalendarOccurrence, day: string) {
  selectedDate.value = day
  detailOccurrence.value = item
  detailId.value = item.id
  detailOpen.value = true
  await fetchDetail(item.id)
}
async function fetchDetail(id: number) {
  const version = ++detailVersion
  detailLoading.value = true; detailError.value = ''; detail.value = null
  try { const result = await api.detail(id, canManage.value); if (version === detailVersion) detail.value = result }
  catch (error) { if (version === detailVersion) detailError.value = error instanceof Error ? error.message : '事件加载失败。' }
  finally { if (version === detailVersion) detailLoading.value = false }
}
const safeSourceUrl = computed(() => detail.value?.source_url && /^https?:\/\//i.test(detail.value.source_url) ? detail.value.source_url : null)
const editorOpen = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)
function createEvent() { if (!canManage.value) return; editingEvent.value = null; editorOpen.value = true }
function editEvent() { if (!canManage.value || !detail.value) return; editingEvent.value = detail.value; detailOpen.value = false; editorOpen.value = true }
const mutating = ref(false)
const deleteOpen = ref(false)
const deleteError = ref('')
const notice = ref('')
const noticeOpen = ref(false)
function announce(message: string) { notice.value = message; noticeOpen.value = true }
async function onSaved() { editorOpen.value = false; detailOpen.value = false; announce('事件已保存'); await loadEvents() }
async function changeStatus() {
  if (!canManage.value || !detail.value || mutating.value) return
  mutating.value = true; detailError.value = ''
  try { await api.status(detail.value.id, detail.value.status === 'active' ? 'cancelled' : 'active'); detailOpen.value = false; announce('事件状态已更新'); await loadEvents() }
  catch (error) { detailError.value = error instanceof Error ? error.message : '操作失败。' }
  finally { mutating.value = false }
}
async function removeEvent() {
  if (!canManage.value || !detail.value || mutating.value) return
  mutating.value = true; deleteError.value = ''
  try { await api.remove(detail.value.id); deleteOpen.value = false; detailOpen.value = false; announce('事件已删除'); await loadEvents() }
  catch (error) { deleteError.value = error instanceof Error ? error.message : '删除失败。' }
  finally { mutating.value = false }
}
watch([month, eventType, status, canRead, canManage, () => store.userInfo?.user_id, () => store.token], () => { void loadEvents() })
watch(canRead, value => { if (!value) { detailVersion++; detail.value = null; detailOpen.value = false } })
watch(canManage, value => { if (!value) { editorOpen.value = false; deleteOpen.value = false; status.value = 'active' } })
watch(deleteOpen, value => { if (!value) deleteError.value = '' })
onMounted(async () => { goToday(); mounted.value = true; await initializeAuth() })
onBeforeUnmount(() => { requestVersion++; detailVersion++ })
</script>

<style scoped>
.calendar-page { padding-block: 44px 72px; }
.calendar-heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 32px; }
.calendar-heading h1 { font-size: clamp(1.6rem, 3vw, 2.5rem); letter-spacing: -.045em; margin: 8px 0; }
.calendar-heading h1 span { color: #39c5bb; }
.calendar-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.month-controls { display: flex; align-items: center; gap: 8px; }
.month-controls h2 { font-size: 1.2rem; white-space: nowrap; }
.month-picker { padding: 8px; }
.month-picker-content { padding-inline: 8px; }
.picker-heading { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 12px; }
.month-picker :deep(.v-date-picker-months), .month-picker :deep(.v-date-picker-years) { width: 100%; }
.month-picker :deep(.v-date-picker-years) { height: auto; overflow: visible; }
.month-picker :deep(.v-date-picker-years__content) { grid-template-columns: repeat(var(--v-date-picker-years-columns, 3), minmax(0, 1fr)); gap: 8px 12px; padding-inline: 8px; }
.month-picker :deep(.v-date-picker-months__content) { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 12px; padding-inline: 8px; }
.calendar-filters { display: flex; gap: 12px; min-width: 210px; }
.calendar-filters > * { min-width: 155px; }
.calendar-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 24px; align-items: start; }
.month-card, .agenda-card { border: 1px solid var(--site-border); }
.month-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.weekday { text-align: center; padding: 16px 0; font-size: .8rem; color: var(--site-muted); border-bottom: 1px solid var(--site-border); }
.day-cell { min-height: 125px; padding: 7px; border-right: 1px solid var(--site-border); border-bottom: 1px solid var(--site-border); display: flex; flex-direction: column; align-items: stretch; gap: 4px; min-width: 0; cursor: pointer; }
.day-cell:hover { box-shadow: inset 0 0 0 1px #39c5bb; }
.day-cell:nth-child(7n) { border-right: 0; }
.day-cell.selected { background: color-mix(in srgb, #39c5bb 12%, white); box-shadow: inset 0 0 0 2px #39c5bb; }
.day-cell.outside { background: var(--site-bg); color: var(--site-muted); }
.day-number { align-self: start; min-width: 32px; padding-inline: 6px; }
.grid-event { justify-content: start; width: 100%; min-width: 0; padding-inline: 6px; color: var(--site-text); background: color-mix(in srgb, #39c5bb 13%, white); }
.grid-event :deep(.v-btn__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.more-events { min-width: 0; padding: 0; color: var(--site-muted); }
.agenda-card { padding: 24px 16px; }
.agenda-heading { padding: 0 8px 18px; border-bottom: 1px solid var(--site-border); }
.agenda-heading h2 { font-size: 1.25rem; margin-top: 6px; }
.agenda-empty { padding: 36px 0; text-align: center; color: var(--site-muted); }
.agenda-empty p { margin: 12px 0; }
.agenda-event { width: 100%; height: auto !important; min-height: 100px; padding: 16px 8px; text-align: left; border-bottom: 1px solid var(--site-border); }
.agenda-event :deep(.v-btn__content) { display: flex; width: 100%; justify-content: space-between; white-space: normal; gap: 10px; }
.event-copy { display: grid; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.event-meta, .event-zone { font-size: .75rem; color: var(--site-muted); }
.event-copy strong { font-size: .95rem; }
.cancelled { text-decoration: line-through; opacity: .65; }
.state-card { display: grid; justify-items: center; gap: 18px; padding: 64px 24px; text-align: center; }
.detail-title { margin: 10px 0 16px; overflow-wrap: anywhere; }
.detail-description { white-space: pre-wrap; overflow-wrap: anywhere; margin-block: 20px; }
.detail-actions { flex-wrap: wrap; }
.mobile-date { display: none; }
@media (max-width: 1100px) { .calendar-layout { grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; } .day-cell { padding: 4px; } }
@media (max-width: 959px) { .calendar-layout { grid-template-columns: 1fr; } }
@media (max-width: 599px) {
  .calendar-page { padding-block: 28px 48px; }
  .calendar-heading { flex-direction: column; align-items: start; }
  .calendar-toolbar, .calendar-filters { width: 100%; }
  .calendar-filters > * { min-width: 0; flex: 1; }
  .month-grid { display: none; }
  .mobile-date { display: block; padding: 20px; }
  .month-controls { gap: 0; }
}
</style>
