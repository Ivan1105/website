<script setup lang="ts">
import type { ActivityDetail } from '@/api/activity'
import { activityLabel, activityLink, activityTime } from '@/utils/activity'
defineProps<{ activity: ActivityDetail }>()
</script>
<template>
  <div class="activity-detail">
    <h3>{{ activity.original_title }}</h3>
    <p>{{ activity.chinese_title || '暂无中文标题' }}</p>
    <p class="preserve">{{ activity.summary || '暂无摘要' }}</p>
    <p>审批：{{ activityLabel(activity.review_status) }} · {{ activityTime(activity.reviewed_at) }}（北京时间）</p>
    <p>审批人编号：{{ activity.reviewed_by ?? '—' }} · 备注：{{ activity.review_note || '—' }}</p>
    <h3>监控页面（{{ activity.monitor_pages.length }}）</h3>
    <p v-if="!activity.monitor_pages.length">未配置页面</p>
    <div v-for="page in activity.monitor_pages" :key="page.id" class="monitor-page">
      <strong>{{ page.name }}</strong>
      <a v-if="activityLink(page.url)" :href="activityLink(page.url)" target="_blank" rel="noopener noreferrer">{{ page.url }}</a>
      <p>最近检查：{{ activityTime(page.last_checked_at) }} · 最近成功：{{ activityTime(page.last_succeeded_at) }}（北京时间）</p>
      <v-alert v-if="page.last_error" type="error" variant="tonal">{{ page.last_error }}</v-alert>
    </div>
    <p>全部页面监控：{{ activity.monitor_enabled ? '开启' : '关闭' }}</p>
    <p>最近检查：{{ activityTime(activity.last_checked_at) }} · 最近成功：{{ activityTime(activity.last_succeeded_at) }}（北京时间）</p>
    <v-alert v-if="activity.last_error" type="error" variant="tonal">{{ activity.last_error }}</v-alert>
    <h3>关联来源</h3>
    <p v-if="!activity.source_items.length">暂无关联来源</p>
    <div v-for="item in activity.source_items" :key="item.id">
      <a v-if="activityLink(item.detail_url)" :href="activityLink(item.detail_url)" target="_blank" rel="noopener noreferrer">{{ item.title }}</a><span v-else>{{ item.title }}</span>
      <p>抓取：{{ activityLabel(item.fetch_status) }} · 归档：{{ activityLabel(item.processing_status) }}</p><p v-if="item.last_error">{{ item.last_error }}</p>
    </div>
    <h3>最近快照</h3>
    <p v-if="!activity.snapshots.length">尚未建立官网基线</p>
    <v-expansion-panels v-else>
      <v-expansion-panel v-for="snapshot in activity.snapshots" :key="snapshot.id" :title="`${snapshot.page_name} · 版本 ${snapshot.version_no} · ${activityTime(snapshot.fetched_at)}（北京时间）`">
        <v-expansion-panel-text><p>{{ snapshot.page_url }}</p><pre class="preserve">{{ snapshot.diff_text || '基线快照，无变更摘要' }}</pre></v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>
<style scoped>
.activity-detail { display: grid; gap: 16px; overflow-wrap: anywhere; }
.preserve { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
a { color: rgb(var(--v-theme-secondary)); }
.monitor-page { display: grid; gap: 8px; border: 1px solid var(--site-border); border-radius: 12px; padding: 16px; }
</style>
