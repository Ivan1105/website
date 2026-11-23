<template>
  <div class="emotion-page site-container">
    <v-btn :to="chatLink" variant="text" color="secondary" prepend-icon="mdi-arrow-left">返回聊天</v-btn>

    <header class="emotion-heading">
      <div>
        <h1>Miku 的情绪状态</h1>
        <p class="muted">查看此刻的五维情绪与近期变化。</p>
      </div>
      <v-btn v-if="appStore.isLoggedIn" variant="tonal" color="secondary"
        prepend-icon="mdi-refresh" :loading="loading" @click="refresh">
        刷新
      </v-btn>
    </header>

    <div v-if="!appStore.authInitialized || loading" class="surface-card emotion-state" role="status">
      <v-progress-circular indeterminate color="secondary" size="24" />
      <span>正在加载情绪状态…</span>
    </div>
    <div v-else-if="!appStore.isLoggedIn" class="surface-card emotion-state">
      <p>登录后可查看 Miku 和你互动时的情绪状态。</p>
      <v-btn to="/login" color="secondary" variant="tonal">前往登录</v-btn>
    </div>
    <div v-else-if="failed" class="surface-card emotion-state" role="alert">
      <p>暂时无法加载情绪状态。</p>
      <v-btn color="secondary" variant="tonal" @click="refresh">重试</v-btn>
    </div>
    <div v-else-if="overview?.status === 'paused'" class="surface-card emotion-state" role="status">
      <v-icon icon="mdi-pause-circle-outline" color="secondary" />
      <div><h2>情绪记录已暂停</h2><p class="muted">长期记忆关闭期间，跨轮情绪暂停读取和更新。</p></div>
    </div>

    <template v-else-if="overview?.status === 'active'">
      <section class="surface-card emotion-panel" aria-labelledby="current-emotion">
        <div class="section-heading">
          <div>
            <h2 id="current-emotion">当前情绪</h2>
            <p v-if="overview.source === 'baseline'" class="muted">尚无已保存的情绪状态，当前显示基线。</p>
          </div>
          <p class="muted">计算于 <time :datetime="overview.asOf">{{ formatTime(overview.asOf) }}</time></p>
        </div>
        <div class="dimension-grid">
          <div v-for="dimension in dimensions" :key="dimension.key" class="dimension">
            <span class="dimension-label">{{ dimension.label }}</span>
            <strong>{{ formatValue(overview.current[dimension.key]) }}</strong>
            <meter :aria-label="dimension.label" :min="dimension.min" :max="1" :value="overview.current[dimension.key]" />
            <div class="dimension-range" aria-hidden="true"><span>{{ dimension.min === -1 ? '−1' : '0' }}</span><span>1</span></div>
          </div>
        </div>
      </section>

      <section class="surface-card emotion-panel" aria-labelledby="emotion-history">
        <div class="section-heading">
          <h2 id="emotion-history">近期变化</h2>
          <p class="muted">最近 7 天 · 最多 30 条</p>
        </div>
        <p v-if="!overview.timeline.length" class="empty-timeline muted">最近 7 天没有记录到情绪事件。</p>
        <ol v-else class="emotion-timeline">
          <li v-for="(entry, index) in overview.timeline" :key="index" class="timeline-entry">
            <time :datetime="entry.appliedAt">{{ formatTime(entry.appliedAt) }}</time>
            <div>
              <p class="event-categories">{{ entry.categories.map(category => categoryLabels[category]).join('、') }}</p>
              <ul class="event-deltas" aria-label="五维变化量">
                <template v-for="dimension in dimensions" :key="dimension.key">
                  <li v-if="entry.delta[dimension.key] !== 0">
                    {{ dimension.label }} <strong>{{ formatDelta(entry.delta[dimension.key]) }}</strong>
                  </li>
                </template>
              </ul>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useChatApi, type EmotionCategoryDTO, type EmotionOverviewDTO, type EmotionValuesDTO } from '@/api/chat'
import { isApiError } from '@/api/http'
import { useAppStore } from '@/stores/app'

useHead({ title: 'Miku 的情绪状态' })

const route = useRoute()
const appStore = useAppStore()
const { chatApi } = useChatApi()
const chatLink = computed(() => ({
  path: '/chatbox',
  query: {
    agent: typeof route.query.agent === 'string' ? route.query.agent : undefined,
    thread: typeof route.query.thread === 'string' ? route.query.thread : undefined,
  },
}))

const dimensions = [
  { key: 'valence', label: '愉悦度', min: -1 },
  { key: 'energy', label: '活跃度', min: 0 },
  { key: 'affection', label: '互动温暖度', min: 0 },
  { key: 'curiosity', label: '好奇度', min: 0 },
  { key: 'excitement', label: '兴奋度', min: 0 },
] as const satisfies ReadonlyArray<{ key: keyof EmotionValuesDTO; label: string; min: number }>

const categoryLabels: Record<EmotionCategoryDTO, string> = {
  shared_joy: '分享喜悦',
  user_distress: '用户表达困扰',
  warm_interaction: '温暖互动',
  music_engagement: '聊到音乐',
  novel_topic: '新话题',
  criticism: '批评',
  hostility: '敌意言语',
}

const timeFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
const formatTime = (value: string) => timeFormat.format(new Date(value))
const formatValue = (value: number) => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2)
const formatDelta = (value: number) => {
  const sign = value > 0 ? '+' : '−'
  return Math.abs(value) < 0.001
    ? `${sign}<0.001`
    : `${sign}${Math.abs(value).toFixed(3)}`
}

const overview = ref<EmotionOverviewDTO>()
const loading = ref(false)
const failed = ref(false)
let activeRequest: AbortController | undefined

async function refresh() {
  activeRequest?.abort()
  overview.value = undefined
  failed.value = false
  loading.value = appStore.isLoggedIn
  if (!appStore.isLoggedIn) return

  const request = new AbortController()
  activeRequest = request
  try {
    const data = await chatApi.getEmotionOverview(request.signal)
    if (!request.signal.aborted) overview.value = data
  } catch (error) {
    if (request.signal.aborted) return
    if (isApiError(error) && error.status === 401) appStore.clearAuth()
    else failed.value = true
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

onMounted(() => {
  watch(() => appStore.token, refresh, { immediate: true, flush: 'sync' })
})
onBeforeUnmount(() => activeRequest?.abort())
</script>

<style scoped>
.emotion-page { max-width: 1050px; padding-block: clamp(20px, 4vw, 48px); }
.emotion-heading { display: flex; align-items: end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin: 22px 0; }
.emotion-heading h1 { font-size: clamp(1.8rem, 5vw, 2.75rem); line-height: 1.15; margin-bottom: 8px; }
.emotion-panel, .emotion-state { margin-bottom: 18px; padding: clamp(16px, 3vw, 26px); }
.emotion-state { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.section-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; align-items: baseline; margin-bottom: 16px; }
.section-heading h2, .emotion-state h2 { font-size: 1.15rem; }
.section-heading p { font-size: .88rem; }
.dimension-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 135px), 1fr)); gap: 10px; }
.dimension { display: grid; gap: 4px; padding: 14px; border-radius: 16px; background: rgb(var(--v-theme-surface-variant)); }
.dimension-label { font-size: .88rem; }
.dimension strong { font-size: 1.65rem; line-height: 1.25; font-variant-numeric: tabular-nums; }
.dimension meter { width: 100%; height: 8px; appearance: none; accent-color: rgb(var(--v-theme-secondary)); }
.dimension meter::-webkit-meter-bar { background: rgb(var(--v-theme-surface)); border: 0; border-radius: 8px; }
.dimension meter::-webkit-meter-optimum-value { background: rgb(var(--v-theme-secondary)); border-radius: 8px; }
.dimension meter::-moz-meter-bar { background: rgb(var(--v-theme-secondary)); border-radius: 8px; }
.dimension-range { display: flex; justify-content: space-between; color: var(--site-muted); font-size: .75rem; }
.emotion-timeline, .event-deltas { list-style: none; padding: 0; }
.timeline-entry { display: grid; grid-template-columns: minmax(130px, 1fr) 4fr; gap: 6px 16px; border-top: 1px solid var(--site-border); padding: 14px 0; }
.timeline-entry:last-child { padding-bottom: 0; }
.timeline-entry time { color: var(--site-muted); font-size: .87rem; }
.event-categories { font-weight: 650; }
.event-deltas { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 5px; font-size: .85rem; color: var(--site-muted); }
.event-deltas strong { color: rgb(var(--v-theme-on-surface)); font-variant-numeric: tabular-nums; }
.empty-timeline { padding: 8px 0; }

@media (max-width: 600px) {
  .timeline-entry { grid-template-columns: 1fr; }
}
</style>
