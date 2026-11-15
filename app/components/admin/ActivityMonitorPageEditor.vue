<script setup lang="ts">
import type { MonitorPageInput } from '@/api/activity'
const props = defineProps<{ page: MonitorPageInput; index: number; count: number; disabled: boolean }>()
const emit = defineEmits<{ change: [page: MonitorPageInput]; move: [offset: number]; remove: [] }>()
const name = computed({ get: () => props.page.name, set: (value: string) => emit('change', { ...props.page, name: value ?? '' }) })
const url = computed({ get: () => props.page.url, set: (value: string) => emit('change', { ...props.page, url: value ?? '' }) })
</script>
<template>
  <div class="monitor-page">
    <v-text-field v-model="name" :label="'页面 ' + (index + 1) + ' 名称'" placeholder="例如：票务页" maxlength="128" :disabled="disabled" hide-details />
    <v-text-field v-model="url" :label="'页面 ' + (index + 1) + ' URL'" placeholder="https://…" maxlength="2048" :disabled="disabled" hide-details />
    <div class="page-actions">
      <v-btn icon="mdi-arrow-up" variant="text" size="small" :disabled="disabled || index === 0" :aria-label="'上移页面 ' + (index + 1)" @click="emit('move', -1)" />
      <v-btn icon="mdi-arrow-down" variant="text" size="small" :disabled="disabled || index === count - 1" :aria-label="'下移页面 ' + (index + 1)" @click="emit('move', 1)" />
      <v-btn icon="mdi-delete-outline" variant="text" color="error" size="small" :disabled="disabled" :aria-label="'移除页面 ' + (index + 1)" @click="emit('remove')" />
    </div>
  </div>
</template>
<style scoped>
.monitor-page { display: grid; gap: 12px; margin-block: 16px; padding: 16px; border: 1px solid var(--site-border); border-radius: 12px; }
.page-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
