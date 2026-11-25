<template>
  <v-dialog :model-value="true" :close-on-back="false" persistent fullscreen
    transition="dialog-bottom-transition" aria-labelledby="chat-proactive-title">
    <v-card class="proactive-page">
      <v-toolbar class="proactive-toolbar" color="surface" flat>
        <v-btn icon="mdi-arrow-left" variant="text" aria-label="返回聊天" :disabled="saving" @click="emit('close')" />
        <v-toolbar-title id="chat-proactive-title">主动提醒设置</v-toolbar-title>
        <v-btn icon="mdi-close" variant="text" aria-label="关闭主动提醒设置" :disabled="saving" @click="emit('close')" />
      </v-toolbar>
      <v-divider />
      <v-card-text class="proactive-content">
        <div class="proactive-shell">
          <header class="proactive-header">
            <h2>{{ agentName }}</h2>
            <p>开启后，符合条件的提醒会通过 QQ 私聊发给你。</p>
          </header>

          <div v-if="loading" class="proactive-loading" role="status">
            <v-progress-circular indeterminate color="secondary" size="26" width="2" />
            正在读取主动提醒设置…
          </div>
          <v-alert v-else-if="loadError" type="error" variant="tonal" role="alert">
            {{ loadError }}
            <template #append><v-btn variant="text" @click="loadSettings">重试</v-btn></template>
          </v-alert>

          <form v-else-if="settings" class="proactive-form" novalidate @submit.prevent="saveSettings">
            <section class="proactive-section" aria-labelledby="proactive-enabled-title">
              <div class="proactive-toggle-row">
                <h3 id="proactive-enabled-title">启用主动提醒</h3>
                <v-switch v-model="draft.enabled" color="secondary" density="compact" hide-details
                  aria-labelledby="proactive-enabled-title" :disabled="saving" />
              </div>
              <div v-if="settings.enabled" class="proactive-next-run">
                <span>下次检查（设备本地时间）</span>
                <time v-if="nextRunTime" :datetime="settings.nextRunAt ?? undefined">{{ nextRunTime }}</time>
                <span v-else>尚未安排</span>
              </div>
            </section>

            <section class="proactive-section" aria-labelledby="proactive-frequency-title">
              <h3 id="proactive-frequency-title">提醒频率</h3>
              <div class="proactive-fields">
                <v-text-field v-model="draft.interval" label="检查间隔" type="number" inputmode="numeric"
                  min="15" max="1440" step="1" suffix="分钟" hint="每隔 15–1440 分钟检查一次"
                  persistent-hint :error-messages="intervalError" :disabled="saving" />
                <v-text-field v-model="draft.cooldown" label="发送冷却" type="number" inputmode="numeric"
                  min="60" max="10080" step="1" suffix="分钟" hint="两次提醒至少相隔 60–10080 分钟"
                  persistent-hint :error-messages="cooldownError" :disabled="saving" />
              </div>
            </section>

            <section class="proactive-section" aria-labelledby="proactive-window-title">
              <h3 id="proactive-window-title">每日允许时段</h3>
              <p class="proactive-description">按个人资料中的时区生效。结束时间早于开始时间时，时段延续到次日。</p>
              <v-radio-group v-model="draft.windowMode" inline hide-details class="proactive-window-mode"
                aria-labelledby="proactive-window-title" :disabled="saving">
                <v-radio label="全天" value="all-day" color="secondary" />
                <v-radio label="自定义" value="custom" color="secondary" />
              </v-radio-group>
              <div v-if="draft.windowMode === 'custom'" class="proactive-fields">
                <v-text-field v-model="draft.start" label="开始时间" type="time" step="60" hide-details="auto"
                  :error-messages="startError" :disabled="saving" />
                <v-text-field v-model="draft.end" label="结束时间" type="time" step="60" hide-details="auto"
                  :error-messages="endError" :disabled="saving" />
              </div>
            </section>

            <v-alert v-if="saveError" type="error" variant="tonal" role="alert">{{ saveError }}</v-alert>
            <v-alert v-if="saved && !dirty" type="success" variant="tonal" role="status">主动提醒设置已保存。</v-alert>
            <div class="proactive-actions">
              <v-btn variant="text" :disabled="saving" @click="emit('close')">取消</v-btn>
              <v-btn type="submit" color="primary" :loading="saving" :disabled="!canSave">保存</v-btn>
            </div>
          </form>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { isApiError, useChatApi } from '@/api'
import type { ProactiveSettingsDTO } from '@/api/chat'

const props = defineProps<{
  agentId: string
  agentName: string
  handleUnauthorized: (error: unknown) => boolean
}>()
const emit = defineEmits<{
  close: []
  loaded: [settings: ProactiveSettingsDTO]
}>()
const { chatApi } = useChatApi()
const settings = shallowRef<ProactiveSettingsDTO | null>(null)
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const loadError = ref('')
const saveError = ref('')
const draft = reactive({
  enabled: false, interval: '', cooldown: '', windowMode: 'all-day' as 'all-day' | 'custom', start: '', end: '',
})
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u
let active = true
let loadController: AbortController | undefined

function validMinutes(value: string, minimum: number, maximum: number): boolean {
  return /^\d+$/u.test(value) && Number(value) >= minimum && Number(value) <= maximum
}

const customWindow = computed(() => draft.windowMode === 'custom')
const intervalError = computed(() => validMinutes(draft.interval, 15, 1440) ? '' : '请输入 15–1440 之间的整数。')
const cooldownError = computed(() => validMinutes(draft.cooldown, 60, 10080) ? '' : '请输入 60–10080 之间的整数。')
const startError = computed(() => customWindow.value && !timePattern.test(draft.start) ? '请选择开始时间。' : '')
const endError = computed(() => {
  if (!customWindow.value) return ''
  if (!timePattern.test(draft.end)) return '请选择结束时间。'
  return draft.end === draft.start ? '结束时间须与开始时间不同。' : ''
})
const allowedWindow = computed(() => customWindow.value ? { start: draft.start, end: draft.end } : null)
const dirty = computed(() => {
  const original = settings.value
  if (!original) return false
  return draft.enabled !== original.enabled || Number(draft.interval) !== original.intervalMinutes
    || Number(draft.cooldown) !== original.cooldownMinutes || allowedWindow.value?.start !== original.allowedWindow?.start
    || allowedWindow.value?.end !== original.allowedWindow?.end
})
const canSave = computed(() => dirty.value && !saving.value && !loading.value
  && !intervalError.value && !cooldownError.value && !startError.value && !endError.value)
const nextRunTime = computed(() => {
  const value = settings.value?.nextRunAt
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date) : ''
})

function applySettings(value: ProactiveSettingsDTO) {
  settings.value = value
  Object.assign(draft, {
    enabled: value.enabled, interval: String(value.intervalMinutes), cooldown: String(value.cooldownMinutes),
    windowMode: value.allowedWindow ? 'custom' : 'all-day',
    start: value.allowedWindow?.start ?? '', end: value.allowedWindow?.end ?? '',
  })
  emit('loaded', value)
}

async function loadSettings() {
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  loading.value = true
  loadError.value = ''
  try {
    const value = await chatApi.getProactiveSettings(props.agentId, controller.signal)
    if (active && loadController === controller) applySettings(value)
  } catch (error) {
    if (active && loadController === controller && !props.handleUnauthorized(error)) {
      loadError.value = '无法读取主动提醒设置，请稍后重试。'
    }
  } finally {
    if (active && loadController === controller) loading.value = false
  }
}

async function saveSettings() {
  if (!canSave.value) return
  saving.value = true
  saved.value = false
  saveError.value = ''
  try {
    const value = await chatApi.updateProactive({
      agentId: props.agentId, enabled: draft.enabled, intervalMinutes: Number(draft.interval),
      cooldownMinutes: Number(draft.cooldown), allowedWindow: allowedWindow.value,
    })
    if (!active) return
    applySettings(value)
    saved.value = true
  } catch (error) {
    if (active && !props.handleUnauthorized(error)) {
      saveError.value = isApiError(error) && error.status === 400 ? error.message : '无法保存主动提醒设置，请稍后重试。'
    }
  } finally {
    if (active) saving.value = false
  }
}

onMounted(loadSettings)
onBeforeUnmount(() => {
  active = false
  loadController?.abort()
})
</script>

<style scoped>
.proactive-page { background: var(--site-bg) !important; }
.proactive-toolbar { flex: 0 0 auto; }
.proactive-toolbar :deep(.v-toolbar-title) { text-align: center; font-size: 1rem; font-weight: 700; }
.proactive-content { overflow-y: auto; padding: clamp(16px, 4vw, 44px); }
.proactive-shell { max-width: 680px; margin-inline: auto; }
.proactive-header { margin-bottom: 24px; }
.proactive-header h2 { font-size: clamp(24px, 4vw, 32px); font-weight: 700; }
.proactive-header p, .proactive-description { margin-top: 4px; font-size: 0.875rem; opacity: 0.78; }
.proactive-loading { display: flex; align-items: center; gap: 12px; padding-block: 16px; }
.proactive-form { display: grid; gap: 16px; }
.proactive-section { padding: 16px 20px; background: var(--site-surface); border: thin solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; }
.proactive-section h3 { font-size: 1rem; font-weight: 700; }
.proactive-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proactive-toggle-row .v-switch { flex: 0 0 auto; }
.proactive-next-run { display: flex; flex-wrap: wrap; column-gap: 12px; row-gap: 4px; font-size: 0.875rem; }
.proactive-next-run time { font-variant-numeric: tabular-nums; }
.proactive-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 12px; }
.proactive-window-mode { margin-top: 6px; }
.proactive-actions { display: flex; justify-content: flex-end; gap: 8px; padding-bottom: env(safe-area-inset-bottom); }

@media (max-width: 560px) {
  .proactive-section { padding: 14px 16px; }
  .proactive-fields { grid-template-columns: minmax(0, 1fr); gap: 12px; }
}
</style>
