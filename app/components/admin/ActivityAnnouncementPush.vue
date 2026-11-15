<script setup lang="ts">
import { useActivityApi, type ActivityPushOverview, type ActivityDeliveryStatus } from '@/api/activity'
import { isApiError } from '@/api/http'
import { activityTime } from '@/utils/activity'

const props = defineProps<{ announcementId: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useActivityApi()
const overview = shallowRef<ActivityPushOverview | null>(null)
const loading = ref(false), submitting = ref(false), confirmOpen = ref(false)
const error = ref(''), message = ref('')
let version = 0
const labels: Record<ActivityDeliveryStatus, string> = { pending: '等待处理', sending: '等待回执', sent: '发送成功', failed: '失败', unknown: '结果不明（不再重发）', expired: '已过期', cancelled: '已取消' }
const statuses = Object.keys(labels) as ActivityDeliveryStatus[]
async function load() {
  const current = ++version, id = props.announcementId
  loading.value = true; error.value = ''
  try {
    const result = await api.pushOverview(id)
    if (current === version) overview.value = result
  } catch (e) { if (current === version) error.value = e instanceof Error ? e.message : '获取推送状态失败' }
  finally { if (current === version) loading.value = false }
}
async function submit() {
  if (submitting.value || !overview.value?.can_push || loading.value) return
  submitting.value = true; error.value = ''; message.value = ''
  try {
    const batch = await api.push(props.announcementId)
    confirmOpen.value = false
    message.value = `推送批次 #${batch.id} 已创建，将唤醒 miku agent 向 ${batch.target_count} 个订阅群发送。请手动刷新查看结果。`
    emit('changed')
    await load()
  } catch (e) {
    const text = e instanceof Error ? e.message : '创建推送任务失败'
    // A timeout may occur after the server has committed the batch. Always reconcile before another attempt.
    confirmOpen.value = false
    await load()
    error.value = isApiError(e) && e.status === 409 ? `${text}，已刷新推送状态。` : text
    emit('changed')
  } finally { submitting.value = false }
}
watch(() => props.announcementId, () => { overview.value = null; confirmOpen.value = false; message.value = ''; void load() }, { immediate: true })
onBeforeUnmount(() => { version++ })
</script>

<template>
  <section class="push-section" aria-label="公告QQ群推送">
    <div class="d-flex flex-wrap align-center ga-2 mb-3">
      <h3>QQ群推送</h3><v-spacer />
      <v-btn variant="text" :loading="loading" :disabled="submitting" @click="load">刷新推送状态</v-btn>
      <v-btn color="primary" variant="tonal" :disabled="loading || submitting || !!error || !overview?.can_push" @click="confirmOpen = true">推送到订阅群</v-btn>
    </div>
    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}<v-btn variant="text" :disabled="submitting" @click="load">重试查询</v-btn></v-alert>
    <v-alert v-if="message" type="success" variant="tonal" class="mb-3">{{ message }}</v-alert>
    <template v-if="overview">
      <p v-if="!overview.batch">尚未推送 · 当前可用的演出订阅群：{{ overview.target_count }} 个。{{ overview.reason }}</p>
      <template v-else>
        <p>批次 #{{ overview.batch.id }} · {{ overview.batch.trigger_type === 'automatic' ? '高重要度自动触发' : '管理员手动触发' }} · 共 {{ overview.batch.target_count }} 个群</p>
        <p>创建：{{ activityTime(overview.batch.created_at) }} · 到期：{{ activityTime(overview.batch.expires_at) }}（北京时间）</p>
        <div class="d-flex flex-wrap ga-2 my-3"><template v-for="status in statuses" :key="status"><v-chip v-if="overview.counts[status]" size="small" :color="status === 'sent' ? 'success' : status === 'unknown' || status === 'failed' ? 'warning' : undefined">{{ labels[status] }} {{ overview.counts[status] }}</v-chip></template></div>
        <v-table density="compact"><thead><tr><th>订阅群</th><th>投递状态</th><th>QQ发送次数</th><th>发送时间（北京时间）</th><th>说明</th></tr></thead><tbody><tr v-for="delivery in overview.deliveries" :key="delivery.id"><td>{{ delivery.group_name }}（#{{ delivery.group_user_id }}）</td><td>{{ labels[delivery.status] }}</td><td>{{ delivery.attempt_count }}</td><td>{{ activityTime(delivery.sent_at) }}</td><td>{{ delivery.last_error || '—' }}</td></tr></tbody></v-table>
        <p class="text-medium-emphasis mt-3">每条公告只能创建一次推送批次。失败、过期或结果不明均不能再次手动推送；结果不明的消息不会自动重发。</p>
      </template>
    </template>
    <v-dialog v-model="confirmOpen" max-width="540" :persistent="submitting">
      <v-card title="确认推送公告">
        <v-card-text>将唤醒 miku agent，向当前全部 {{ overview?.target_count ?? 0 }} 个演出订阅QQ群发送此公告。每条公告只能推送一次，创建后不能撤销或再次触发。实际群数以提交时为准。</v-card-text>
        <v-card-actions><v-spacer /><v-btn :disabled="submitting" @click="confirmOpen = false">取消</v-btn><v-btn color="primary" :loading="submitting" :disabled="loading || !overview?.can_push" @click="submit">确认推送</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.push-section { margin-top: 24px; border-top: 1px solid rgba(var(--v-theme-on-surface), .12); padding-top: 20px; }
</style>
