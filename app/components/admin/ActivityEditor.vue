<script setup lang="ts">
import ActivityMonitorPageEditor from './ActivityMonitorPageEditor.vue'
import type { ActivityDetail, ActivityPatch } from '@/api/activity'
import { normalizeMonitorUrl, prepareMonitorPages } from '@/utils/activity'
const props = defineProps<{ activity: ActivityDetail; saving: boolean; error: string }>()
const emit = defineEmits<{ save: [patch: ActivityPatch]; cancel: [] }>()
let nextKey = 0
const form = reactive({ original_title: props.activity.original_title, chinese_title: props.activity.chinese_title ?? '', summary: props.activity.summary ?? '',
  pages: props.activity.monitor_pages.map(page => ({ key: nextKey++, name: page.name, url: page.url })),
  official_url_is_specific: !!props.activity.official_url_is_specific, monitor_enabled: !!props.activity.monitor_enabled })
const comparable = (url: string) => { try { return normalizeMonitorUrl(url) } catch { return url.trim() } }
const changed = computed(() => form.pages.map(page => comparable(page.url)).sort().join('\n') !== props.activity.monitor_pages.map(page => page.url).sort().join('\n'))
const canMonitor = computed(() => !changed.value && form.pages.length > 0 && props.activity.review_status === 'approved')
watch(changed, value => { if (value) form.monitor_enabled = false })
const validation = ref('')
function move(index: number, offset: number) {
  const row = form.pages.splice(index, 1)[0]
  if (row) form.pages.splice(index + offset, 0, row)
}
function submit() {
  validation.value = ''
  if (!form.original_title.trim()) { validation.value = '请填写原文标题'; return }
  try {
    const pages = prepareMonitorPages(form.pages)
    emit('save', { original_title: form.original_title.trim(), chinese_title: form.chinese_title.trim() || null, summary: form.summary.trim() || null,
      monitor_pages: pages, official_url_is_specific: pages.length > 0 && form.official_url_is_specific,
      ...(canMonitor.value ? { monitor_enabled: form.monitor_enabled } : {}) })
  } catch (error) { validation.value = error instanceof Error ? error.message : '请检查监控页面配置' }
}
</script>
<template>
  <v-card title="编辑活动信息">
    <v-form :disabled="saving" @submit.prevent="submit">
      <v-card-text>
        <v-alert v-if="error || validation" type="error" variant="tonal" class="mb-4">{{ error || validation }}</v-alert>
        <v-text-field v-model="form.original_title" label="原文标题（必填）" maxlength="1024" />
        <v-text-field v-model="form.chinese_title" label="中文标题" maxlength="1024" />
        <v-textarea v-model="form.summary" label="摘要" maxlength="10000" rows="4" />
        <div class="pages-heading"><h3>监控页面（{{ form.pages.length }}/20）</h3><v-btn variant="tonal" size="small" prepend-icon="mdi-plus" :disabled="form.pages.length >= 20" @click="form.pages.push({ key: nextKey++, name: '', url: '' })">添加页面</v-btn></div>
        <p class="muted">只监控填写的页面，不递归子页面。首项作为活动官网展示；名称和顺序调整不会重建基线。</p>
        <p v-if="!form.pages.length" class="empty-pages">尚未配置页面，可保留为一次性新闻公告。</p>
        <ActivityMonitorPageEditor v-for="(page, index) in form.pages" :key="page.key" :page="page" :index="index" :count="form.pages.length" :disabled="saving" @change="value => Object.assign(page, value)" @move="offset => move(index, offset)" @remove="form.pages.splice(index, 1)" />
        <v-checkbox v-model="form.official_url_is_specific" label="首个页面专属于该届活动" :disabled="!form.pages.length" hide-details />
        <v-switch v-model="form.monitor_enabled" label="持续监控全部页面" :disabled="!canMonitor" color="primary" hide-details />
        <v-alert v-if="changed" type="info" variant="tonal" class="mt-4">地址列表已变化，保存后需重新审批，全部页面监控将暂停。批准后的首次采集会分别建立基线。</v-alert>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn :disabled="saving" @click="emit('cancel')">取消</v-btn><v-btn type="submit" color="primary" variant="flat" :loading="saving">保存</v-btn></v-card-actions>
    </v-form>
  </v-card>
</template>
<style scoped>
form { display: flex; flex-direction: column; max-height: calc(100dvh - 120px); }
.v-card-text { overflow-y: auto; }
.pages-heading { display: flex; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.empty-pages { padding-block: 16px; }
</style>
