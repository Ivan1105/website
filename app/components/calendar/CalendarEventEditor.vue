<template>
  <v-card class="calendar-editor" :title="event ? '编辑日历事件' : '新增日历事件'">
    <v-card-text>
      <v-alert v-if="event?.recurrence === 'yearly'" type="info" variant="tonal" class="mb-4">修改将应用到整个重复事件。</v-alert>
      <v-alert v-if="error" type="error" variant="tonal" class="mb-4" role="alert">{{ error }}</v-alert>
      <v-form id="calendar-event-form" @submit.prevent="save">
        <fieldset :disabled="saving" class="editor-fields">
          <v-text-field v-model="form.title" label="事件标题 *" maxlength="255" />
          <div class="field-grid">
            <v-select v-model="form.event_type" label="事件类型" :items="calendarTypes" />
            <v-select v-model="form.status" label="状态" :items="statuses" />
            <v-text-field v-model="form.start_date" type="date" label="开始日期 *" @update:model-value="adjustEndDate" />
            <v-text-field v-model="form.end_date" type="date" label="结束日期 *" :min="form.start_date" />
          </div>
          <v-switch v-model="form.all_day" label="全天事件" color="primary" hide-details class="mb-4" />
          <div v-if="!form.all_day" class="field-grid">
            <v-text-field v-model="form.start_time" type="time" step="1" label="开始时间 *" />
            <v-text-field v-model="form.end_time" type="time" step="1" label="结束时间（可选）" clearable />
          </div>
          <div class="field-grid">
            <v-combobox v-model="form.timezone" label="事件时区 *" :items="['Asia/Shanghai', 'Asia/Tokyo', 'Asia/Hong_Kong', 'UTC']" />
            <v-select v-model="form.recurrence" label="重复规则" :items="[{ title: '不重复', value: 'none' }, { title: '每年重复', value: 'yearly' }]" />
          </div>
          <v-text-field v-model="form.source_url" label="来源链接" type="url" maxlength="1000" clearable />
          <v-textarea v-model="form.description" label="事件描述" rows="4" maxlength="65535" />
        </fieldset>
      </v-form>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn :disabled="saving" @click="$emit('close')">取消</v-btn>
      <v-btn type="submit" form="calendar-event-form" color="primary" variant="flat" :loading="saving" :disabled="!canManage">保存事件</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { calendarTypes, useCalendarApi, type CalendarEvent, type CalendarInput } from '@/api/calendar'
import { validateCalendarInput } from '@/utils/calendar'

const props = defineProps<{ event: CalendarEvent | null; date: string; canManage: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const api = useCalendarApi()
const statuses = [{ title: '正常', value: 'active' }, { title: '已取消', value: 'cancelled' }]
const form = reactive<CalendarInput>({
  title: props.event?.title ?? '', description: props.event?.description ?? null,
  event_type: props.event?.event_type ?? 'other', start_date: props.event?.start_date ?? props.date,
  end_date: props.event?.end_date ?? props.date, all_day: props.event?.all_day ?? true,
  start_time: props.event?.start_time ?? null, end_time: props.event?.end_time ?? null,
  timezone: props.event?.timezone ?? 'Asia/Shanghai', recurrence: props.event?.recurrence ?? 'none',
  status: props.event?.status ?? 'active', source_url: props.event?.source_url ?? null,
})
const saving = ref(false)
const error = ref('')
function adjustEndDate() { if (form.end_date < form.start_date) form.end_date = form.start_date }
const normalizeTime = (value: string | null) => value ? (value.length === 5 ? `${value}:00` : value) : null
async function save() {
  if (saving.value || !props.canManage || (props.event && props.event.user_id !== null)) return
  const input: CalendarInput = {
    ...form, title: form.title.trim(), timezone: form.timezone?.trim() ?? '',
    description: form.description?.trim() || null, source_url: form.source_url?.trim() || null,
    start_time: form.all_day ? null : normalizeTime(form.start_time),
    end_time: form.all_day ? null : normalizeTime(form.end_time),
  }
  error.value = validateCalendarInput(input) ?? ''
  if (error.value) return
  saving.value = true
  try { await api.save(input, props.event?.id); emit('saved') }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请重试。' }
  finally { saving.value = false }
}
</script>

<style scoped>
.calendar-editor { padding: 12px; }
.editor-fields { border: 0; padding: 0; min-width: 0; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
@media (max-width: 599px) { .field-grid { grid-template-columns: 1fr; } }
</style>
