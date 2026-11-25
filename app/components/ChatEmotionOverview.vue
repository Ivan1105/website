<template>
  <div class="emotion-overview">
    <header class="emotion-heading">
      <p class="muted">查看此刻的五维情绪与近期变化。</p>
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
        <figure v-if="radar" class="emotion-radar">
          <svg viewBox="0 0 360 290" role="img" :aria-label="radar.label">
            <g class="radar-grid">
              <polygon v-for="ring in radarRings" :key="ring" :points="ring" />
              <line v-for="axis in radarAxes" :key="axis.key"
                :x1="radarCenter.x" :y1="radarCenter.y" :x2="axis.end.x" :y2="axis.end.y" />
            </g>
            <polygon class="radar-shape" :points="radar.points" />
            <circle v-for="axis in radar.axes" :key="axis.key" class="radar-point"
              :cx="axis.point.x" :cy="axis.point.y" r="4" />
            <text v-for="axis in radar.axes" :key="axis.key" class="radar-label"
              :x="axis.labelPosition.x" :y="axis.labelPosition.y" :text-anchor="axis.anchor">
              {{ axis.label }}
              <tspan class="radar-level" :x="axis.labelPosition.x" dy="20">{{ axis.level }}</tspan>
            </text>
          </svg>
        </figure>
      </section>

      <section class="surface-card emotion-panel" aria-labelledby="emotion-history">
        <div class="section-heading">
          <h2 id="emotion-history">近期变化</h2>
          <p class="muted">最近 7 天 · 最多 30 条</p>
        </div>
        <p v-if="!timeline.length" class="empty-timeline muted">最近 7 天没有记录到情绪事件。</p>
        <div v-else class="emotion-timeline-scroll" tabindex="0" role="region" aria-label="情绪变化记录">
          <table class="emotion-timeline" aria-labelledby="emotion-history">
            <thead>
              <tr>
                <th scope="col" class="timeline-time">时间</th>
                <th scope="col" class="timeline-event">事件</th>
                <th v-for="dimension in dimensions" :key="dimension.key" scope="col">{{ dimension.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, index) in timeline" :key="index">
                <td class="timeline-time"><time :datetime="entry.appliedAt">{{ formatTime(entry.appliedAt) }}</time></td>
                <th scope="row" class="timeline-event">{{ entry.categories.map(category => categoryLabels[category]).join('、') }}</th>
                <td v-for="change in entry.changes" :key="change.key">
                  <span role="img" class="timeline-indicator" :class="change.color" :aria-label="change.label">
                    <template v-if="change.icon">
                      <v-icon v-for="arrow in change.count" :key="arrow" :icon="change.icon" size="16" aria-hidden="true" />
                    </template>
                    <template v-else>—</template>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useChatApi, type EmotionCategoryDTO, type EmotionOverviewDTO, type EmotionValuesDTO } from '@/api/chat'
import { isApiError } from '@/api/http'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const { chatApi } = useChatApi()

const dimensions = [
  { key: 'valence', label: '愉悦度', min: -1, levels: ['低落', '略显低落', '平和', '愉快', '很愉快'] },
  { key: 'energy', label: '活跃度', min: 0, levels: ['安静', '较安静', '适中', '活跃', '很活跃'] },
  { key: 'affection', label: '互动温暖度', min: 0, levels: ['疏离', '较克制', '自然', '亲切', '很亲切'] },
  { key: 'curiosity', label: '好奇度', min: 0, levels: ['兴趣较低', '略感兴趣', '有些好奇', '很感兴趣', '强烈好奇'] },
  { key: 'excitement', label: '兴奋度', min: 0, levels: ['很平静', '较平静', '略有兴奋', '兴奋', '很兴奋'] },
] as const satisfies ReadonlyArray<{
  key: keyof EmotionValuesDTO
  label: string
  min: number
  levels: readonly [string, string, string, string, string]
}>

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
const overview = ref<EmotionOverviewDTO>()
const timeline = computed(() => {
  const state = overview.value
  if (state?.status !== 'active') return []

  return state.timeline.map(entry => ({
    ...entry,
    changes: dimensions.map(({ key, min }) => {
      const delta = entry.delta[key]
      if (delta === 0) return { key, icon: null, count: 0, color: 'timeline-unchanged', label: '没有变化' }

      const magnitude = Math.abs(delta) / (1 - min)
      const level = magnitude >= 0.1 ? 3 : magnitude >= 0.03 ? 2 : 1
      const rising = delta > 0
      return {
        key,
        icon: rising ? 'mdi-arrow-up-bold' : 'mdi-arrow-down-bold',
        count: level,
        color: rising ? 'text-success' : 'text-error',
        label: `${(['略有', '明显', '大幅'] as const)[level - 1]}${rising ? '上升' : '下降'}`,
      }
    }),
  }))
})

const radarCenter = { x: 180, y: 148 }
const radarRadius = 94

function radarPoint(angle: number, radius: number) {
  return {
    x: radarCenter.x + Math.cos(angle) * radius,
    y: radarCenter.y + Math.sin(angle) * radius,
  }
}

const radarAxes = dimensions.map((dimension, index) => {
  const angle = (2 * Math.PI * index) / dimensions.length - Math.PI / 2
  const labelPosition = radarPoint(angle, radarRadius + 12)
  return {
    ...dimension,
    angle,
    end: radarPoint(angle, radarRadius),
    labelPosition: { x: labelPosition.x, y: labelPosition.y - 6 },
    anchor: index === 0 ? 'middle' : index <= 2 ? 'start' : 'end',
  } as const
})

const radarRings = [0.2, 0.4, 0.6, 0.8, 1].map(scale => radarAxes.map(axis => {
  const { x, y } = radarPoint(axis.angle, radarRadius * scale)
  return `${x},${y}`
}).join(' '))

const radar = computed(() => {
  const state = overview.value
  if (state?.status !== 'active') return

  const axes = radarAxes.map(axis => {
    const value = state.current[axis.key]
    const scale = Math.min(1, Math.max(0, (value - axis.min) / (1 - axis.min)))
    const levelIndex = Math.min(axis.levels.length - 1, Math.floor(scale * axis.levels.length))
    const level = axis.levels[levelIndex] ?? axis.levels[0]
    return { ...axis, level, point: radarPoint(axis.angle, radarRadius * scale) }
  })

  return {
    axes,
    points: axes.map(({ point }) => `${point.x},${point.y}`).join(' '),
    label: `五维情绪雷达图。${axes.map(axis => `${axis.label}：${axis.level}`).join('，')}`,
  }
})

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
.emotion-overview { max-width: 1050px; margin-inline: auto; }
.emotion-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 22px; }
.emotion-panel, .emotion-state { margin-bottom: 18px; padding: clamp(16px, 3vw, 26px); }
.emotion-state { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.section-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; align-items: baseline; margin-bottom: 16px; }
.section-heading h2, .emotion-state h2 { font-size: 1.15rem; }
.section-heading p { font-size: .88rem; }
.emotion-radar { width: min(100%, 420px); margin-inline: auto; }
.emotion-radar svg { display: block; width: 100%; height: auto; }
.radar-grid { fill: none; stroke: rgb(var(--v-theme-on-surface)); stroke-opacity: .2; }
.radar-shape { fill: rgb(57 197 187 / .24); stroke: #39c5bb; stroke-width: 2.5; stroke-linejoin: round; }
.radar-point { fill: #39c5bb; stroke: rgb(var(--v-theme-surface)); stroke-width: 1.5; }
.radar-label { fill: rgb(var(--v-theme-on-surface)); font-size: 13px; }
.radar-level { font-size: 16px; font-weight: 700; }
.emotion-timeline-scroll { overflow-x: auto; }
.emotion-timeline {
  width: 100%;
  min-width: 45rem;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: .85rem;
}
.emotion-timeline th, .emotion-timeline td { padding: 10px 6px; text-align: center; }
.emotion-timeline thead th { color: var(--site-muted); font-weight: 650; }
.emotion-timeline tbody tr { border-top: 1px solid var(--site-border); }
.emotion-timeline .timeline-time { width: 10rem; color: var(--site-muted); text-align: left; white-space: nowrap; }
.emotion-timeline .timeline-event { width: 20%; text-align: left; font-weight: 650; }
.timeline-indicator { display: inline-flex; align-items: center; gap: 2px; font-size: 1rem; }
.timeline-unchanged { color: #6b7280; }
.empty-timeline { padding: 8px 0; }
</style>
