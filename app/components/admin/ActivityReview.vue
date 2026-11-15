<script setup lang="ts">
import type { ActivityDetail } from '@/api/activity'
defineProps<{ activity: ActivityDetail; status: 'approved' | 'rejected'; saving: boolean; error: string }>()
const emit = defineEmits<{ submit: [note: string]; cancel: [] }>()
const note = ref('')
</script>
<template>
  <v-card :title="status === 'approved' ? '批准活动' : '拒绝活动'">
    <v-form :disabled="saving" @submit.prevent="emit('submit', note)">
      <v-card-text>
        <p class="mb-4">{{ activity.chinese_title || activity.original_title }}</p>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <v-alert type="info" variant="tonal" class="mb-4">{{ status === 'rejected' ? '拒绝后将停止全部页面监控，已生成公告保留。' : activity.activity_status === 'ended' ? '活动已结束，批准不会开启任何页面监控。' : activity.review_status === 'approved' ? '该活动已批准，再次确认不会重建基线，也不会恢复已手动关闭的监控。' : activity.monitor_pages.length ? `批准后将监控 ${activity.monitor_pages.length} 个页面，各页面首次抓取只建立基线。` : '该记录没有监控页面，批准后只保留一次性公告。' }}</v-alert>
        <v-textarea v-model="note" label="审批备注" maxlength="4000" rows="3" />
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn :disabled="saving" @click="emit('cancel')">取消</v-btn><v-btn type="submit" :color="status === 'approved' ? 'primary' : 'error'" variant="flat" :loading="saving">确认{{ status === 'approved' ? '批准' : '拒绝' }}</v-btn></v-card-actions>
    </v-form>
  </v-card>
</template>
